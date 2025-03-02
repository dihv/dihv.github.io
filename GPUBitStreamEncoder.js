/**
 * GPU-Accelerated BitStream Encoder Architecture with CPU Fallbacks
 * File Name: GPUBitStreamEncoder.js
 *
 * Core Components:
 * 1. WebGL2 Context Setup - Provides integer processing capabilities (with CPU fallback)
 * 2. Shader Programs - Handle parallel data processing
 * 3. Texture Management - Efficient binary data handling
 * 4. Base Conversion - GPU-accelerated radix conversion (with CPU fallback)
 * 5. Error Detection - Built-in checksum calculation
 */
window.GPUBitStreamEncoder = class GPUBitStreamEncoder {
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
        
        // Initialize lookup tables early for CPU fallbacks
        this.createLookupTables();
        
        // Track whether GPU acceleration is available
        this.gpuAccelerationEnabled = false;
        
        // Try GPU initialization, fall back to CPU if not available
        try {
            this.initializeWebGL();
            this.initializeShaders();
            this.createBuffers();
            this.initializeContextListeners();
            this.gpuAccelerationEnabled = true;
            console.log('GPU acceleration enabled for BitStream encoding/decoding');
        } catch (error) {
            console.warn(`GPU acceleration unavailable: ${error.message}. Falling back to CPU implementation.`);
            // Continue with CPU fallback - no need to throw an error since we have fallbacks
        }
    }

    initializeContextListeners() {
        if (!this.gl || !this.canvas) return;
        
        // Handle context loss
        this.canvas.addEventListener('webglcontextlost', (event) => {
            event.preventDefault(); // Allows for context restoration
            console.warn('WebGL context lost. GPU acceleration disabled until context is restored.');
            this.gpuAccelerationEnabled = false;
        }, false);
        
        // Handle context restoration
        this.canvas.addEventListener('webglcontextrestored', (event) => {
            console.log('WebGL context restored. Reinitializing GPU resources...');
            try {
                // Reinitialize WebGL resources
                this.initializeShaders();
                this.createBuffers();
                this.gpuAccelerationEnabled = true;
                console.log('GPU acceleration re-enabled successfully');
            } catch (error) {
                console.error('Failed to reinitialize after context restoration:', error);
                // Remain in CPU fallback mode
            }
        }, false);
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
            'OES_texture_float_linear',   // For linear filtering of float textures
            'EXT_color_buffer_integer'    // For integer texture support
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
        if (!this.gl) return; // Skip if WebGL is not available
        
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
        
        // Create decoder shader if we're going to actually implement GPU decoding
        this.initializeDecoderShaders();
    }
    
    /**
     * Initialize decoder shaders for GPU-accelerated decoding
     */
    initializeDecoderShaders() {
        if (!this.gl) return; // Skip if WebGL is not available
        
        // Vertex shader (same as for encoding)
        const vertexShaderSource = `#version 300 es
            layout(location = 0) in vec2 a_position;
            layout(location = 1) in vec2 a_texCoord;
            out vec2 v_texCoord;
            
            void main() {
                v_texCoord = a_texCoord;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }`;

        // Fragment shader for decoding
        const fragmentShaderSource = `#version 300 es
            precision highp float;
            precision highp int;
            precision highp usampler2D;
            
            in vec2 v_texCoord;
            
            uniform usampler2D u_sourceData;   // Source encoded data
            uniform uint u_radix;              // Base for conversion
            uniform uint u_outputLength;       // Expected output length
            
            layout(location = 0) out uvec4 decodedOutput;
            
            void main() {
                // Calculate position in data
                ivec2 texelCoord = ivec2(gl_FragCoord.xy);
                uint pixelIndex = uint(texelCoord.y * textureSize(u_sourceData, 0).x + texelCoord.x);
                
                // Check if we're within valid data range
                if (pixelIndex * 4u >= u_outputLength) {
                    decodedOutput = uvec4(0u);
                    return;
                }
                
                // Read source encoded values
                uvec4 encodedValues = texelFetch(u_sourceData, texelCoord, 0);
                
                // Convert back from base to binary
                uint value = encodedValues.x + 
                           (encodedValues.y * u_radix) + 
                           (encodedValues.z * u_radix * u_radix) + 
                           (encodedValues.w * u_radix * u_radix * u_radix);
                
                // Extract individual bytes in little-endian order
                decodedOutput.x = value & 0xFFu;
                decodedOutput.y = (value >> 8u) & 0xFFu;
                decodedOutput.z = (value >> 16u) & 0xFFu;
                decodedOutput.w = (value >> 24u) & 0xFFu;
            }`;

        // Create, link, and compile decoder shader program
        const program = this.createShaderProgram(vertexShaderSource, fragmentShaderSource);
        
        // Store program and locations of uniforms for efficient updates
        this.decoderProgram = {
            program: program,
            locations: {
                position: this.gl.getAttribLocation(program, 'a_position'),
                texCoord: this.gl.getAttribLocation(program, 'a_texCoord'),
                sourceData: this.gl.getUniformLocation(program, 'u_sourceData'),
                radix: this.gl.getUniformLocation(program, 'u_radix'),
                outputLength: this.gl.getUniformLocation(program, 'u_outputLength')
            }
        };
    }

    // Create vertex buffers for rendering
    createBuffers() {
        if (!this.gl) return; // Skip if WebGL is not available
        
        const gl = this.gl;
        
        // Create vertex buffer with positions for a full-screen quad
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        const positions = new Float32Array([
            -1.0, -1.0,  // bottom left
             1.0, -1.0,  // bottom right
            -1.0,  1.0,  // top left
             1.0,  1.0   // top right
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        
        // Create texture coordinate buffer
        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        const texCoords = new Float32Array([
            0.0, 0.0,  // bottom left
            1.0, 0.0,  // bottom right
            0.0, 1.0,  // top left
            1.0, 1.0   // top right
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
        
        // Store buffers for later use
        this.buffers = {
            position: positionBuffer,
            texCoord: texCoordBuffer
        };
    }

    // Setup vertex attributes for rendering
    setupVertexAttributes(program) {
        if (!this.gl) return; // Skip if WebGL is not available
        
        const gl = this.gl;
        const locations = program ? program.locations : this.shaderProgram.locations;
        
        // Set up position attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.enableVertexAttribArray(locations.position);
        gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);
        
        // Set up texture coordinate attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.texCoord);
        gl.enableVertexAttribArray(locations.texCoord);
        gl.vertexAttribPointer(locations.texCoord, 2, gl.FLOAT, false, 0, 0);
    }

    toBitArray(buffer) {
        // Convert ArrayBuffer to Uint8Array if needed
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        
        // Create a bit array from bytes
        const bits = new Uint8Array(bytes.length * 8);
        
        for (let i = 0; i < bytes.length; i++) {
            const byte = bytes[i];
            // Process each bit in little-endian order (PTA_3)
            for (let j = 0; j < 8; j++) {
                bits[i * 8 + j] = (byte >> j) & 1;
            }
        }
        
        return bits;
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
     * Main encoding function that processes binary data using GPU or CPU
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
        
        // Validate input size
        if (bytes.length === 0) {
            throw new Error('Input data cannot be empty');
        }

        // Choose implementation based on GPU availability
        if (this.gpuAccelerationEnabled && this.gl && !this.gl.isContextLost()) {
            try {
                return await this.encodeWithGPU(bytes);
            } catch (error) {
                console.warn(`GPU encoding failed: ${error.message}. Falling back to CPU implementation.`);
                return this.encodeWithCPU(bytes);
            }
        } else {
            return this.encodeWithCPU(bytes);
        }
    }

    /**
     * GPU-accelerated encoding implementation
     */
    async encodeWithGPU(bytes) {
        const maxGPUTextureSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
        const maxBytes = maxGPUTextureSize * maxGPUTextureSize * 4; // 4 bytes per pixel
        
        if (bytes.length > maxBytes) {
            throw new Error(`Input data size (${bytes.length} bytes) exceeds maximum GPU texture capacity`);
        }
        
        // Calculate optimal texture size for GPU processing
        const { width, height } = this.calculateTextureDimensions(bytes.length);
        if (width > maxGPUTextureSize || height > maxGPUTextureSize) {
            throw new Error('Required texture dimensions exceed GPU capabilities');
        }
        
        // Prepare GPU resources
        const { inputTexture, outputTexture, framebuffer } = this.prepareGPUResources(width, height);
        
        try {
            // Upload and process data in parallel on GPU
            const processedData = await this.processDataOnGPU(
                bytes, width, height, inputTexture, framebuffer);
            
            // Convert GPU output to URL-safe string with metadata
            return this.convertToString(processedData, bytes.length);
        } finally {
            // Release GPU resources
            this.cleanupGPUResources(inputTexture, outputTexture, framebuffer);
        }
    }

    /**
     * CPU-based encoding implementation for fallback
     */
    encodeWithCPU(bytes) {
        const BYTE_SIZE = window.CONFIG.BYTE_SIZE || 4;
        const processedData = new Uint32Array(bytes.length * BYTE_SIZE);
        
        // Process each byte group
        for (let i = 0; i < bytes.length; i += BYTE_SIZE) {
            // Read up to 4 bytes (padded with zeros if needed)
            const byteValues = [
                i < bytes.length ? bytes[i] : 0,
                i + 1 < bytes.length ? bytes[i + 1] : 0,
                i + 2 < bytes.length ? bytes[i + 2] : 0,
                i + 3 < bytes.length ? bytes[i + 3] : 0
            ];
            
            // Combine bytes into a 32-bit integer (little-endian)
            const combined = byteValues[0] | 
                           (byteValues[1] << 8) | 
                           (byteValues[2] << 16) | 
                           (byteValues[3] << 24);
            
            // Convert to base-N representation
            let value = combined;
            const resultIndex = i * BYTE_SIZE;
            for (let j = 0; j < BYTE_SIZE; j++) {
                processedData[resultIndex + j] = value % this.RADIX;
                value = Math.floor(value / this.RADIX);
            }
        }
        
        return this.convertToString(processedData, bytes.length);
    }

    async decodeBits(encodedString) {
        if (!encodedString) {
            throw new Error('No encoded data provided');
        }
    
        // Extract metadata length
        const metadataLengthChar = encodedString[0];
        const metadataLength = this.charToIndex.get(metadataLengthChar);
        
        // Extract metadata section
        const metadataSection = encodedString.slice(1, metadataLength + 1);
        const dataSection = encodedString.slice(metadataLength + 1);
        
        // Parse length from metadata
        const lengthStr = metadataSection.slice(0, -1); // Exclude checksum
        let originalLength = 0;
        for (const char of lengthStr) {
            originalLength = originalLength * this.RADIX + this.charToIndex.get(char);
        }
    
        // Verify checksum
        const checksumChar = metadataSection[metadataSection.length - 1];
        const expectedChecksum = this.charToIndex.get(checksumChar);
        
        // Compute actual checksum of data section
        let actualChecksum = 0;
        for (const char of dataSection) {
            const value = this.charToIndex.get(char);
            actualChecksum = (actualChecksum + value) % this.RADIX;
        }
        
        if (expectedChecksum !== actualChecksum) {
            console.warn('Checksum verification failed, data may be corrupted');
        }
    
        // Choose implementation based on GPU availability - similar to encodeBits
        if (this.gpuAccelerationEnabled && this.gl && !this.gl.isContextLost()) {
            try {
                return await this.decodeWithGPU(dataSection, originalLength);
            } catch (error) {
                console.warn(`GPU decoding failed: ${error.message}. Falling back to CPU implementation.`);
                return this.decodeWithCPU(dataSection, originalLength);
            }
        } else {
            return this.decodeWithCPU(dataSection, originalLength);
        }
    }

    decodeWithCPU(encodedData, originalLength) {
        // Fixed: Use CONFIG.BYTE_SIZE for consistency instead of hardcoded value
        const BYTE_SIZE = window.CONFIG.BYTE_SIZE || 4;
        const CHARS_PER_GROUP = BYTE_SIZE; // Typically 4 chars per 4 bytes
        
        const result = new Uint8Array(originalLength);
        let byteIndex = 0;
        
        // Process characters in groups 
        for (let i = 0; i < encodedData.length; i += CHARS_PER_GROUP) {
            if (byteIndex >= originalLength) break;
            
            // Read up to CHARS_PER_GROUP characters (handle partial groups at the end)
            const groupSize = Math.min(CHARS_PER_GROUP, encodedData.length - i);
            
            // Convert chars to values and calculate decimal value
            let value = 0;
            for (let j = 0; j < groupSize; j++) {
                const charIndex = i + j;
                if (charIndex < encodedData.length) {
                    const digitValue = this.charToIndex.get(encodedData[charIndex]);
                    value += digitValue * Math.pow(this.RADIX, j);
                }
            }
            
            // Extract bytes in little-endian order
            const bytesToExtract = Math.min(BYTE_SIZE, originalLength - byteIndex);
            for (let j = 0; j < bytesToExtract; j++) {
                result[byteIndex++] = (value >> (j * 8)) & 0xFF;
            }
        }
        
        return result.buffer;
    }

    async decodeWithGPU(encodedData, originalLength) {
        // Check if we have actual GPU decoding capability
        if (!this.gl || !this.decoderProgram) {
            throw new Error('GPU decoding not available, falling back to CPU');
        }
        
        // Validate GPU capacity
        const maxGPUTextureSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE);
        const maxBytes = maxGPUTextureSize * maxGPUTextureSize * 4; // 4 bytes per pixel
        
        if (originalLength > maxBytes) {
            throw new Error(`Data size (${originalLength} bytes) exceeds maximum GPU texture capacity`);
        }
        
        // Convert encoded string to indices
        const encodedIndices = new Uint32Array(encodedData.length);
        for (let i = 0; i < encodedData.length; i++) {
            encodedIndices[i] = this.charToIndex.get(encodedData[i]);
        }
        
        // Calculate dimensions for output
        const bytesPerPixel = 4; // RGBA = 4 bytes
        const pixelsNeeded = Math.ceil(originalLength / bytesPerPixel);
        const outputWidth = Math.min(maxGPUTextureSize, Math.ceil(Math.sqrt(pixelsNeeded)));
        const outputHeight = Math.ceil(pixelsNeeded / outputWidth);
        
        // Calculate dimensions for input
        const BYTE_SIZE = window.CONFIG.BYTE_SIZE || 4;
        const charsPerPixel = BYTE_SIZE; // Typically 4 chars per pixel
        const inputPixelsNeeded = Math.ceil(encodedData.length / charsPerPixel);
        const inputWidth = Math.min(maxGPUTextureSize, Math.ceil(Math.sqrt(inputPixelsNeeded)));
        const inputHeight = Math.ceil(inputPixelsNeeded / inputWidth);
        
        // Prepare GPU resources
        const gl = this.gl;
        
        // Create input texture for encoded data
        const inputTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        // Convert encoded data to texture format (4 indices per pixel)
        const paddedIndices = new Uint32Array(inputWidth * inputHeight * 4);
        for (let i = 0; i < encodedIndices.length; i++) {
            paddedIndices[i] = encodedIndices[i];
        }
        
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA32UI,
            inputWidth,
            inputHeight,
            0,
            gl.RGBA_INTEGER,
            gl.UNSIGNED_INT,
            paddedIndices
        );
        
        // Create output texture
        const outputTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, outputTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA8UI,
            outputWidth,
            outputHeight,
            0,
            gl.RGBA_INTEGER,
            gl.UNSIGNED_BYTE,
            null
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        
        // Create framebuffer for output
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            outputTexture,
            0
        );
        
        // Check framebuffer status
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error(`Framebuffer is incomplete: ${status}`);
        }
        
        try {
            // Set up GPU for decoding
            gl.viewport(0, 0, outputWidth, outputHeight);
            gl.useProgram(this.decoderProgram.program);
            
            // Setup vertex attributes
            this.setupVertexAttributes(this.decoderProgram);
            
            // Set uniforms
            gl.uniform1ui(this.decoderProgram.locations.radix, this.RADIX);
            gl.uniform1ui(this.decoderProgram.locations.outputLength, originalLength);
            
            // Bind input texture
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, inputTexture);
            gl.uniform1i(this.decoderProgram.locations.sourceData, 0);
            
            // Execute GPU processing
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            
            // Read back result
            const result = new Uint8Array(outputWidth * outputHeight * 4);
            gl.readPixels(
                0, 0, outputWidth, outputHeight,
                gl.RGBA_INTEGER,
                gl.UNSIGNED_BYTE,
                result
            );
            
            // Create final result with correct length
            const finalResult = new Uint8Array(originalLength);
            finalResult.set(result.subarray(0, originalLength));
            
            return finalResult.buffer;
        } finally {
            // Clean up resources
            gl.deleteTexture(inputTexture);
            gl.deleteTexture(outputTexture);
            gl.deleteFramebuffer(framebuffer);
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
        if (!this.gl) {
            throw new Error('WebGL context not available');
        }
        
        const gl = this.gl;
        
        // Create and configure input texture
        const inputTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Create output texture for framebuffer attachment
        const outputTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, outputTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA32UI, // Use unsigned integer format
            width,
            height,
            0,
            gl.RGBA_INTEGER,
            gl.UNSIGNED_INT,
            null
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        // Create and setup framebuffer
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            outputTexture,
            0
        );

        // Verify framebuffer is complete
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error(`Framebuffer is incomplete: ${status}`);
        }

        return { inputTexture, outputTexture, framebuffer};
    }

    calculateChecksum(bytes, radix) {
        // Use a running sum with periodic modulo to prevent overflow
        return bytes.reduce((sum, byte) => {
            // Apply modulo every step to maintain numerical stability
            const partialSum = (sum + byte) % radix;
            // Ensure we always return a positive remainder
            return partialSum < 0 ? partialSum + radix : partialSum;
        }, 0);
    }

    /**
     * Data Processing Flow:
     * 1. Input binary data is uploaded as RGBA texture
     * 2. GPU processes multiple pixels in parallel
     * 3. Each pixel processes 4 bytes
     * 4. Results are read back as encoded values
     */
    async processDataOnGPU(bytes, width, height, inputTexture, framebuffer) {
        if (!this.gl) {
            throw new Error('WebGL context not available');
        }
        
        const gl = this.gl;
        
        // Verify WebGL context is still available
        if (gl.isContextLost()) {
            throw new Error('WebGL context was lost');
        }

        try{
            // Upload data to GPU memory
            const paddedData = new Uint8Array(width * height * window.CONFIG.BYTE_SIZE); // RGBA = 4 bytes per pixel
            paddedData.set(bytes);
            
            gl.bindTexture(gl.TEXTURE_2D, inputTexture);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA8UI,
                width,
                height,
                0,
                gl.RGBA_INTEGER,
                gl.UNSIGNED_BYTE,
                paddedData
            );

            // Verify texture upload was successful
            const error = gl.getError();
            if (error !== gl.NO_ERROR) {
                throw new Error(`WebGL error during texture upload: ${error}`);
            }
            // Bind framebuffer and set viewport
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.viewport(0, 0, width, height);
    
            // Set up shader program to use GPU processing
            gl.useProgram(this.shaderProgram.program);
            
            // Setup vertex attributes
            this.setupVertexAttributes();
            
            // Set uniforms (processing parameters)
            gl.uniform1ui(this.shaderProgram.locations.radix, this.RADIX);
            gl.uniform1ui(this.shaderProgram.locations.dataLength, bytes.length);
            
            // Calculate and set initial checksum
            const checksum = this.calculateChecksum(bytes, this.RADIX);
            gl.uniform1ui(this.shaderProgram.locations.checksum, checksum);
    
            // Execute GPU processing to draw and read back results
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    
            // Read back processed results
            const results = new Uint32Array(width * height * window.CONFIG.BYTE_SIZE);
            gl.readPixels(
                0, 0, width, height,
                gl.RGBA_INTEGER,
                gl.UNSIGNED_INT,
                results
            );

            // Verify read was successful
            const readError = gl.getError();
            if (readError !== gl.NO_ERROR) {
                throw new Error(`WebGL error during pixel read: ${readError}`);
            }
            return results;

        } catch (error){
            throw new Error(`GPU processing failed: ${error.message}`);
        }
    }

    convertToString(processedData, originalLength) {
        let result = '';
        let checksum = 0;
        
        // Calculate how many complete groups we need to process
        const BYTE_SIZE = window.CONFIG.BYTE_SIZE || 4;
        const completeGroups = Math.floor(originalLength / BYTE_SIZE);
        const remainingBytes = originalLength % BYTE_SIZE;
        
        // Process complete groups
        for (let i = 0; i < completeGroups; i++) {
            const baseIndex = i * BYTE_SIZE;
            
            // Add main digits to result
            for (let j = 0; j < BYTE_SIZE; j++) {
                const value = processedData[baseIndex + j]; // Window of width BYTE_SIZE bits processing the processedData in these chunks
                if (value > 0 || result.length > 0) { // Skip leading zeros only
                    // It prevents empty strings when values are zero and ensures proper number representation.
                    result += this.indexToChar.get(value); // The shader program in processDataOnGPU already performs the modulo operation.
                }
                // Update checksum. While each individual value is guaranteed to be within range, the checksum itself grows as we add more values to it.
                checksum = (checksum + value) % this.RADIX; // Without the modulo operation, it could exceed our RADIX after multiple additions.
            }
        }

        // Handle remaining bytes if any
        if (remainingBytes > 0) {
            const baseIndex = completeGroups * BYTE_SIZE; // Have window of width BYTE_SIZE bits resume processing the end of processedData to get last missed part
            for (let j = 0; j < remainingBytes; j++) {
                const value = processedData[baseIndex + j];
                if (value > 0 || result.length > 0) { // Keep consistent with zero-handling logic
                    result += this.indexToChar.get(value);
                }
                checksum = (checksum + value) % this.RADIX;
            }
        }
        
        // Append length and checksum information to encode metadata used in decoding
        const metadata = this.encodeMetadata(originalLength, checksum);
        
        return metadata + result;
    }

    encodeMetadata(length, checksum) {
        // Encode length and checksum in a format of fixed-width of base-N where N is the radix
        const numDigits = Math.ceil(Math.log(length) / Math.log(this.RADIX));
        let metadata = '';
        
        // Add length prefix
        let remainingLength = length;
        for (let i = 0; i < numDigits; i++) {
            const digit = remainingLength % this.RADIX;
            metadata = this.indexToChar.get(digit) + metadata;
            remainingLength = Math.floor(remainingLength / this.RADIX);
        }

        // Pad with leading zeros if necessary
        while (metadata.length < numDigits) {
            metadata = this.indexToChar.get(0) + metadata;
        }
        
        // Add checksum
        metadata += this.indexToChar.get(checksum);
        
        // Add metadata length indicator
        return this.indexToChar.get(metadata.length) + metadata;
    }

    cleanupGPUResources(inputTexture, outputTexture, framebuffer) {
        if (!this.gl) return; // Skip if WebGL is not available
        
        const gl = this.gl;
        if (inputTexture) gl.deleteTexture(inputTexture);
        if (outputTexture) gl.deleteTexture(outputTexture);
        if (framebuffer) gl.deleteFramebuffer(framebuffer);
    }

    // Helper methods for shader compilation
    createShaderProgram(vertexSource, fragmentSource) {
        if (!this.gl) {
            throw new Error('WebGL context not available');
        }
        
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
        if (!this.gl) {
            throw new Error('WebGL context not available');
        }
        
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
