/**
 * GPU-Accelerated BitStream Encoder Architecture
 * File Name: GPUBitStreamEncoder.js
 *
 * Core Components:
 * 1. WebGL2 Context Setup - Provides integer processing capabilities
 * 2. Shader Programs - Handle parallel data processing
 * 3. Texture Management - Efficient binary data handling
 * 4. Base Conversion - GPU-accelerated radix conversion
 * 5. Error Detection - Built-in checksum calculation
 */
class OptimizedGPUBitStreamEncoder {
    constructor(safeChars) {
        // Phase 1: Initialization and Validation
        // Validate character set to ensure URL-safe encoding is possible
        if (!safeChars || typeof safeChars !== 'string' || safeChars.length === 0) {
            throw new Error('Invalid safeChars parameter');
        }

        // Ensure no duplicate characters
        const uniqueChars = new Set(safeChars);
        if (uniqueChars.size !== safeChars.length) {
            throw new Error('safeChars contains duplicate characters');
        }

        // Store configuration and set up processing environment
        this.SAFE_CHARS = safeChars;
        this.RADIX = safeChars.length;  // Base for conversion equals character set size
        
        // Phase 2: GPU Context Setup
        this.initializeWebGL();  // Set up WebGL2 for integer processing
        this.initializeShaders(); // Prepare GPU processing programs
        this.createLookupTables(); // Optimize char conversion
    }

    initializeWebGL() {
        this.canvas = document.createElement('canvas');
        
        // Try to get WebGL2 context with specific attributes for better precision
        const contextAttributes = {
            alpha: false,                // Don't need alpha channel in backbuffer
            depth: false,                // Don't need depth buffer
            stencil: false,              // Don't need stencil buffer
            antialias: false,            // Don't need antialiasing
            premultipliedAlpha: false,   // Avoid alpha premultiplication
            preserveDrawingBuffer: false, // Allow clear between frames
            failIfMajorPerformanceCaveat: true // Ensure good performance
        };

        this.gl = this.canvas.getContext('webgl2', contextAttributes);
        
        if (!this.gl) {
            throw new Error('WebGL 2 not supported or disabled');
        }

        // Check for required extensions
        const requiredExtensions = [
            'EXT_color_buffer_float',    // For float texture support
            'OES_texture_float_linear'   // For linear filtering of float textures
        ];

        for (const extName of requiredExtensions) {
            const ext = this.gl.getExtension(extName);
            if (!ext) {
                throw new Error(`Required WebGL extension ${extName} not supported`);
            }
        }
    }

    /**
     * GPU Shader Program:
     * - Processes 4 bytes at a time in parallel
     * - Performs base conversion using GPU's integer arithmetic
     * - Calculates running checksum for error detection
     * - Outputs encoded values directly to framebuffer
     */
    initializeShaders() {
        // Vertex shader - handles coordinate transformation and texture mapping
        const vertexShaderSource = `#version 300 es
            // Input vertex attributes
            layout(location = 0) in vec2 a_position;
            layout(location = 1) in vec2 a_texCoord;
            
            // Output to fragment shader
            out vec2 v_texCoord;
            
            void main() {
                // Pass texture coordinates to fragment shader
                v_texCoord = a_texCoord;
                // Transform vertex position to clip space
                gl_Position = vec4(a_position, 0.0, 1.0);
            }`;

        // Fragment shader - processes binary data with precise integer arithmetic, performs the actual data processing
        const fragmentShaderSource = `#version 300 es
            // Precision declarations for integer and floating-point
            precision highp float;
            precision highp int;
            precision highp usampler2D;
            
            // Input from vertex shader
            in vec2 v_texCoord;
            
            // Uniform inputs
            uniform usampler2D u_sourceData;  // Source binary data
            uniform uint u_radix;             // Base for conversion
            uniform uint u_dataLength;        // Original data length
            uniform uint u_checksum;          // Running checksum
            
            // Output encoded data and metadata
            layout(location = 0) out uvec4 encodedOutput;
            
            // Function to process 4 bytes in little-endian order
            uvec4 processBytes(uvec4 bytes) {
                // Combine bytes into 32-bit value maintaining little-endian order
                uint value = bytes.x | 
                           (bytes.y << 8u) | 
                           (bytes.z << 16u) | 
                           (bytes.w << 24u);
                
                // Calculate remainders for base conversion
                uvec4 result;
                result.x = value % u_radix;           // First digit
                uint quotient = value / u_radix;
                result.y = quotient % u_radix;        // Second digit
                quotient /= u_radix;
                result.z = quotient % u_radix;        // Third digit
                result.w = quotient / u_radix;        // Fourth digit
                
                return result;
            }
            
            void main() {
                // Calculate position in data
                ivec2 texelCoord = ivec2(gl_FragCoord.xy);
                uint pixelIndex = uint(texelCoord.y * textureSize(u_sourceData, 0).x + texelCoord.x);
                
                // Check if we're within valid data range
                if (pixelIndex * 4u >= u_dataLength) {
                    encodedOutput = uvec4(0u);
                    return;
                }
                
                // Read source bytes
                uvec4 sourceBytes = texelFetch(u_sourceData, texelCoord, 0);
                
                // Process bytes and output result
                encodedOutput = processBytes(sourceBytes);
                
                // Update checksum
                // Note: This is a simple checksum, could be replaced with more robust algorithm
                encodedOutput.w = (encodedOutput.x + encodedOutput.y + 
                                 encodedOutput.z + u_checksum) % u_radix;
            }`;

        // Create, link, and compile shader program
        const program = this.createShaderProgram(vertexShaderSource, fragmentShaderSource);
        
        // Store program and locations of uniforms for efficient updates
        this.shaderProgram = {
            program: program,
            locations: {
                position: this.gl.getAttribLocation(program, 'a_position'),
                texCoord: this.gl.getAttribLocation(program, 'a_texCoord'),
                sourceData: this.gl.getUniformLocation(program, 'u_sourceData'),
                radix: this.gl.getUniformLocation(program, 'u_radix'),
                dataLength: this.gl.getUniformLocation(program, 'u_dataLength'),
                checksum: this.gl.getUniformLocation(program, 'u_checksum')
            }
        };
    }

    createLookupTables() {
        // Create lookup tables for fast encoding/decoding
        this.charToIndex = new Map();
        this.indexToChar = new Map();
        
        for (let i = 0; i < this.SAFE_CHARS.length; i++) {
            this.charToIndex.set(this.SAFE_CHARS[i], i);
            this.indexToChar.set(i, this.SAFE_CHARS[i]);
        }
    }

    /**
     * Main encoding function that processes binary data using GPU
     * @param {ArrayBuffer|Uint8Array} data - Binary data to encode
     * @returns {Promise<string>} - URL-safe encoded string
     */
    async encodeBits(data) {
        // Phase 3: Data Preparation
        if (!data) {
            throw new Error('Input data is required');
        }
        
        // Uint8Array provides direct access to raw bytes without any conversion overhead during processing.
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

        // Check maximum size limit based on GPU capabilities
        const maxGPUTextureSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
        const maxBytes = maxGPUTextureSize * maxGPUTextureSize * 4; // 4 bytes per pixel
        
        if (bytes.length > maxBytes) {
            throw new Error(`Input data size (${bytes.length} bytes) exceeds maximum GPU texture capacity`);
        }
        
        // Validate input size
        if (bytes.length === 0) {
            throw new Error('Input data cannot be empty');
        }

         // Phase 4: Resource Allocation
        // Calculate optimal texture size for GPU processing
        const { width, height } = this.calculateTextureDimensions(bytes.length); // Calculate required texture dimensions
        if (width > maxGPUTextureSize || height > maxGPUTextureSize) {
            throw new Error('Required texture dimensions exceed GPU capabilities');
        }
        const { texture, framebuffer } = this.prepareGPUResources(width, height);  // Prepare GPU resources
        
        try {
            // Phase 5: GPU Processing
            // Upload and process data in parallel on GPU
            const processedData = await this.processDataOnGPU(
                bytes, width, height, texture, framebuffer);
            
            // Phase 6: Result Generation
            // Convert GPU output to URL-safe string with metadata
            return this.convertToString(processedData, bytes.length);
        } finally {
            // Phase 7: Cleanup
            // Release GPU resources
            this.cleanupGPUResources(texture, framebuffer);
        }
    }

    calculateTextureDimensions(dataLength) {
        // Calculate dimensions ensuring power of 2 for better GPU performance
        const pixelsNeeded = Math.ceil(dataLength / 4); // 4 bytes per pixel
        const dimension = Math.ceil(Math.sqrt(pixelsNeeded));
        const width = Math.pow(2, Math.ceil(Math.log2(dimension)));
        const height = Math.ceil(pixelsNeeded / width);
        
        return { width, height };
    }

    prepareGPUResources(width, height) {
        // Create and configure input texture
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

        // Create framebuffer for output
        const framebuffer = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);

        return { texture, framebuffer };
    }

    /**
     * Data Processing Flow:
     * 1. Input binary data is uploaded as RGBA texture
     * 2. GPU processes multiple pixels in parallel
     * 3. Each pixel processes 4 bytes
     * 4. Results are read back as encoded values
     */
    async processDataOnGPU(bytes, width, height, texture, framebuffer) {
        // Verify WebGL context is still available
        if (this.gl.isContextLost()) {
            throw new Error('WebGL context was lost');
        }

        try{
            // Upload data to GPU memory
            const paddedData = new Uint8Array(width * height * 4);
            paddedData.set(bytes);
            
            this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
            this.gl.texImage2D(
                this.gl.TEXTURE_2D,
                0,
                this.gl.RGBA8UI,
                width,
                height,
                0,
                this.gl.RGBA_INTEGER,
                this.gl.UNSIGNED_BYTE,
                paddedData
            );

            // Verify texture upload was successful
            
            const error = this.gl.getError();
            if (error !== this.gl.NO_ERROR) {
                throw new Error(`WebGL error during texture upload: ${error}`);
            }
    
            // Set up shader program to use GPU processing
            this.gl.useProgram(this.shaderProgram.program);
            
            // Set uniforms (processing parameters)
            this.gl.uniform1ui(this.shaderProgram.locations.radix, this.RADIX);
            this.gl.uniform1ui(this.shaderProgram.locations.dataLength, bytes.length);
            
            // Calculate and set initial checksum
            const checksum = bytes.reduce((sum, byte) => (sum + byte) % this.RADIX, 0);
            this.gl.uniform1ui(this.shaderProgram.locations.checksum, checksum);
    
            // Execute GPU processing to draw and read back results
            this.gl.viewport(0, 0, width, height);
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    
            // Read back processed results
            const results = new Uint32Array(width * height * 4);
            this.gl.readPixels(
                0, 0, width, height,
                this.gl.RGBA_INTEGER,
                this.gl.UNSIGNED_INT,
                results
            );

        } catch (error){
            throw new Error(`GPU processing failed: ${error.message}`);
        }
        return results;
    }

    convertToString(processedData, originalLength) {
        let result = '';
        let checksum = 0;
        
        // Process each group of 4 values (representing one original byte)
        for (let i = 0; i < originalLength; i += 4) {
            const baseIndex = i * 4;
            
            // Add main digits to result
            for (let j = 0; j < 3; j++) {
                const value = processedData[baseIndex + j];
                if (value > 0 || result.length > 0) { // Skip leading zeros only
                    result += this.indexToChar.get(value);
                }
            }
            
            // Update checksum
            checksum = processedData[baseIndex + 3];
        }
        
        // Append length and checksum information
        const metadata = this.encodeMetadata(originalLength, checksum);
        
        return metadata + result;
    }

    encodeMetadata(length, checksum) {
        // Encode length and checksum in a fixed-width format
        const lengthChars = Math.ceil(Math.log(length) / Math.log(this.RADIX));
        let metadata = '';
        
        // Add length prefix
        let remainingLength = length;
        for (let i = 0; i < lengthChars; i++) {
            const digit = remainingLength % this.RADIX;
            metadata = this.indexToChar.get(digit) + metadata;
            remainingLength = Math.floor(remainingLength / this.RADIX);
        }
        
        // Add checksum
        metadata += this.indexToChar.get(checksum);
        
        // Add metadata length indicator
        return this.indexToChar.get(metadata.length) + metadata;
    }

    cleanupGPUResources(texture, framebuffer) {
        this.gl.deleteTexture(texture);
        this.gl.deleteFramebuffer(framebuffer);
    }

    // Helper methods for shader compilation
    createShaderProgram(vertexSource, fragmentSource) {
        const vertexShader = this.compileShader(this.gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(this.gl.FRAGMENT_SHADER, fragmentSource);
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            const error = this.gl.getProgramInfoLog(program);
            this.gl.deleteProgram(program);
            throw new Error(`Failed to link shader program: ${error}`);
        }
        
        return program;
    }

    compileShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const error = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw new Error(`Failed to compile shader: ${error}`);
        }
        
        return shader;
    }
}
