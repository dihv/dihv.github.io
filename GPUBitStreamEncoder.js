/**
 * GPU-Accelerated BitStream Encoder 
 * File: GPUBitStreamEncoder.js
 *
 * Handles encoding of binary data to URL-safe strings with GPU acceleration when available.
 * Includes automatic CPU fallback for compatibility across all devices.
 */
window.GPUBitStreamEncoderImpl = class GPUBitStreamEncoderImpl {
    /**
     * Creates a new encoder instance
     * @param {string} safeChars - Character set for encoding (must be URL-safe)
     */
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
        
        console.log(`Initializing encoder with ${this.RADIX} characters in safe set`);
        
        // Initialize lookup tables early for CPU fallbacks
        this.createLookupTables();

        this.initializeMixingConstants();
        
        // Track whether GPU acceleration is available
        this.gpuAccelerationEnabled = false;
        
        // Try GPU initialization, fall back to CPU if not available
        try {
            this.initializeWebGL();
            this.initializeShaders();
            this.createBuffers();
            this.initializeContextListeners();
            this.gpuAccelerationEnabled = true;
            console.log('GPU acceleration enabled for BitStream encoding');
        } catch (error) {
            console.warn(`GPU acceleration unavailable: ${error.message}. Falling back to CPU implementation.`);
            // Continue with CPU fallback - no need to throw an error since we have fallbacks
        }
    }

    /**
     * Initialize mixing constants for better entropy distribution
     */
    initializeMixingConstants() {
        // Prime numbers for mixing to avoid patterns
        this.MIXING_PRIMES = [31, 37, 41, 43, 47, 53, 59, 61];
        
        // Golden ratio constant for better distribution
        this.PHI = 0x9e3779b9;
        
        // Initialize a simple substitution box for byte mixing
        this.SBOX = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            // Simple non-linear transformation
            this.SBOX[i] = ((i * 31) ^ (i >> 4) ^ 0xA5) & 0xFF;
        }
    }

    /**
     * Mix bytes to improve entropy distribution
     * @param {Uint8Array} bytes - Input bytes
     * @returns {Uint8Array} - Mixed bytes
     */
    mixBytes(bytes) {
        const mixed = new Uint8Array(bytes.length);
        let state = 0x12345678; // Initial state
        
        for (let i = 0; i < bytes.length; i++) {
            // Update state based on previous bytes
            state = (state * this.PHI + bytes[i]) >>> 0;
            
            // Apply substitution and mixing
            const substituted = this.SBOX[bytes[i]];
            const mixed_byte = (substituted ^ (state & 0xFF) ^ (state >> 24)) & 0xFF;
            
            mixed[i] = mixed_byte;
            
            // Rotate state for next iteration
            state = (state << 8) | (state >>> 24);
        }
        
        return mixed;
    }


    /**
     * Sets up event listeners for WebGL context events
     */
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

    /**
     * Initializes WebGL context with optimal settings
     */
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

        // Fragment shader - processes binary data with precise integer arithmetic
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

    /**
     * Creates vertex and index buffers for GPU rendering
     */
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

    /**
     * Sets up vertex attributes for rendering
     * @param {Object} [program=null] - Optional specific shader program to use
     */
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

    /**
     * Convert array buffer to bit array
     * @param {ArrayBuffer|Uint8Array} buffer - Binary data to convert
     * @returns {Uint8Array} - Array of bits
     */
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

    /**
     * Creates lookup tables for fast encoding
     */
    createLookupTables() {
        // Create lookup tables for fast encoding/decoding
        this.charToIndex = new Map();
        this.indexToChar = new Map();
        
        for (let i = 0; i < this.SAFE_CHARS.length; i++) {
            this.charToIndex.set(this.SAFE_CHARS[i], i);
            this.indexToChar.set(i, this.SAFE_CHARS[i]);
        }
        
        // Verify table creation
        if (this.charToIndex.size !== this.SAFE_CHARS.length || 
            this.indexToChar.size !== this.SAFE_CHARS.length) {
            console.error('Failed to create complete lookup tables', {
                safeCharsLength: this.SAFE_CHARS.length,
                charToIndexSize: this.charToIndex.size,
                indexToCharSize: this.indexToChar.size
            });
            throw new Error('Failed to initialize character mapping tables');
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
        
        // Uint8Array provides direct access to raw bytes without conversion overhead
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        
        // Validate input size
        if (bytes.length === 0) {
            throw new Error('Input data cannot be empty');
        }

        // Small data optimization - if data is less than 32 bytes, use direct encoding
        if (bytes.length <= 32) {
            return this.encodeSmallData(bytes);
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
     * @param {Uint8Array} bytes - Binary data to encode
     * @returns {Promise<string>} - Encoded URL-safe string
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
     * CPU-based encoding implementation for fallback or small data
     * @param {Uint8Array} bytes - Binary data to encode
     * @returns {string} - Encoded URL-safe string
     */
    encodeWithCPU(bytes) {
        // Optimization for small inputs - skip metadata for very small payloads
        if (bytes.length <= window.CONFIG.ENCODE_SMALL_THRESHOLD) {
            return this.encodeSmallData(bytes);
        }

        const BYTE_SIZE = window.CONFIG.BYTE_SIZE || 4;
        const processedData = new Uint32Array(Math.ceil(bytes.length / BYTE_SIZE) * BYTE_SIZE);
        
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
            const resultIndex = Math.floor(i / BYTE_SIZE) * BYTE_SIZE;
            for (let j = 0; j < BYTE_SIZE; j++) {
                processedData[resultIndex + j] = value % this.RADIX;
                value = Math.floor(value / this.RADIX);
            }
        }
        
        return this.convertToString(processedData, bytes.length);
    }

    /**
     * Optimized encoding for small data (<= 32 bytes)
     * Uses simpler format without complex metadata
     * @param {Uint8Array} bytes - Small binary data to encode
     * @returns {string} - Encoded string
     */
    encodeSmallData(bytes) {
        let result = '';
        // Use a simple marker to indicate small data format - single tilde character
        result += '~';

        // Encode length as one or two base-N characters
        const lengthChars = this.encodeInteger(bytes.length);
        result += lengthChars;
        
        // Calculate checksum for validation
        let checksum = 0;
        for (let i = 0; i < bytes.length; i++) {
            checksum = (checksum + bytes[i]) % this.RADIX;
        }
        result += this.indexToChar.get(checksum);
        
        // Directly encode each byte
        for (let i = 0; i < bytes.length; i++) {
            const byte = bytes[i];
            
            // Encode each byte as 1-2 characters depending on RADIX
            if (this.RADIX < 256) {
                // Need 2 chars for each byte
                const char1 = this.indexToChar.get(byte % this.RADIX);
                const char2 = this.indexToChar.get(Math.floor(byte / this.RADIX) % this.RADIX);
                result += char1 + char2;
            } else {
                // Single char can encode a full byte
                result += this.indexToChar.get(byte);
            }
        }
        
        return result;
    }

    /**
     * Encode an integer using the encoder's character set
     * @param {number} value - Integer to encode
     * @returns {string} - Encoded value
     */
    encodeInteger(value) {
        if (value === 0) return this.indexToChar.get(0);
        
        let result = '';
        while (value > 0) {
            result = this.indexToChar.get(value % this.RADIX) + result;
            value = Math.floor(value / this.RADIX);
        }
        return result;
    }

    /**
     * Calculate dimensions for optimal texture usage
     * @param {number} dataLength - Length of data in bytes
     * @returns {Object} - Optimal width and height
     */
    calculateTextureDimensions(dataLength) {
        // Calculate dimensions ensuring power of 2 for better GPU performance
        const pixelsNeeded = Math.ceil(dataLength / 4); // 4 bytes per pixel
        const dimension = Math.ceil(Math.sqrt(pixelsNeeded));
        const width = Math.pow(2, Math.ceil(Math.log2(dimension)));
        const height = Math.ceil(pixelsNeeded / width);
        
        return { width, height };
    }

    /**
     * Prepare GPU resources for encoding
     * @param {number} width - Texture width
     * @param {number} height - Texture height
     * @returns {Object} - GPU resources (textures and framebuffer)
     */
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

    /**
     * Calculate checksum for data validation
     * @param {Uint8Array} bytes - Data to checksum
     * @param {number} radix - Base for modulo operation
     * @returns {number} - Checksum value
     */
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
     * 
     * @param {Uint8Array} bytes - Input data
     * @param {number} width - Texture width
     * @param {number} height - Texture height
     * @param {WebGLTexture} inputTexture - Input texture
     * @param {WebGLFramebuffer} framebuffer - Output framebuffer
     * @returns {Promise<Uint32Array>} - Processed data
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
            const paddedData = new Uint8Array(width * height * 4); // RGBA = 4 bytes per pixel
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
            const results = new Uint32Array(width * height * 4);
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

    /**
     * Convert processed data to URL-safe string
     * @param {Uint32Array} processedData - Processed data from GPU or CPU
     * @param {number} originalLength - Original data length in bytes
     * @returns {string} - URL-safe encoded string
     */
    convertToString(processedData, originalLength) {
        let result = '';
        let checksum = 0;
        
        // Ensure we know how many complete groups and remaining bytes
        const BYTE_SIZE = window.CONFIG.BYTE_SIZE || 4;
        const completeGroups = Math.floor(originalLength / BYTE_SIZE);
        const remainingBytes = originalLength % BYTE_SIZE;
        
        // Process complete groups
        for (let i = 0; i < completeGroups; i++) {
            const baseIndex = i * BYTE_SIZE;
            
            // Add main digits to result
            for (let j = 0; j < BYTE_SIZE; j++) {
                const index = baseIndex + j;
                // Only include the value if it's in range
                if (index < processedData.length) {
                    const value = processedData[index];
                    
                    // Ensure value is within valid range for RADIX
                    const safeValue = value % this.RADIX;
                    result += this.indexToChar.get(safeValue);
                    checksum = (checksum + safeValue) % this.RADIX;
                }
            }
        }

        // Handle remaining bytes if any
        if (remainingBytes > 0) {
            const baseIndex = completeGroups * BYTE_SIZE;
            for (let j = 0; j < remainingBytes; j++) {
                const index = baseIndex + j;
                // Only include the value if it's in range
                if (index < processedData.length) {
                    const value = processedData[index];
                    
                    // Ensure value is within valid range for RADIX
                    const safeValue = value % this.RADIX;
                    result += this.indexToChar.get(safeValue);
                    checksum = (checksum + safeValue) % this.RADIX;
                }
            }
        }
        
        // Append metadata
        const metadata = this.encodeMetadata(originalLength, checksum);
        
        return metadata + result;
    }

    /**
     * Encode metadata for decoding
     * @param {number} length - Original data length
     * @param {number} checksum - Calculated checksum
     * @returns {string} - Encoded metadata
     */
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

    /**
     * Clean up GPU resources after processing
     * @param {WebGLTexture} inputTexture - Input texture
     * @param {WebGLTexture} outputTexture - Output texture
     * @param {WebGLFramebuffer} framebuffer - Framebuffer
     */
    cleanupGPUResources(inputTexture, outputTexture, framebuffer) {
        if (!this.gl) return; // Skip if WebGL is not available
        
        const gl = this.gl;
        if (inputTexture) gl.deleteTexture(inputTexture);
        if (outputTexture) gl.deleteTexture(outputTexture);
        if (framebuffer) gl.deleteFramebuffer(framebuffer);
    }

    /**
     * Helper method to create shader program
     * @param {string} vertexSource - Vertex shader source
     * @param {string} fragmentSource - Fragment shader source
     * @returns {WebGLProgram} - Compiled and linked shader program
     */
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

    /**
     * Helper method to compile shader
     * @param {number} type - Shader type (VERTEX_SHADER or FRAGMENT_SHADER)
     * @param {string} source - Shader source code
     * @returns {WebGLShader} - Compiled shader
     */
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
    
    /**
     * Utility method to log information about the character set
     * Used for debugging encoding issues
     */
    logCharSetInfo() {
        console.log(`Character set information:`);
        console.log(`- Total characters: ${this.SAFE_CHARS.length}`);
        console.log(`- RADIX: ${this.RADIX}`);
        console.log(`- First 10 characters: ${this.SAFE_CHARS.substring(0, 10)}`);
        console.log(`- Last 10 characters: ${this.SAFE_CHARS.substring(this.SAFE_CHARS.length - 10)}`);
        
        // Check for URL-unsafe characters
        const unsafeChars = [];
        for (let i = 0; i < this.SAFE_CHARS.length; i++) {
            const char = this.SAFE_CHARS[i];
            if (char === '%' || char === '?' || char === '#' || char === '&') {
                unsafeChars.push(char);
            }
        }
        
        if (unsafeChars.length > 0) {
            console.warn(`Potentially problematic characters found in set: ${unsafeChars.join(', ')}`);
        }
        
        // Test encoding a simple sequence to verify character distribution
        const testBytes = new Uint8Array([65, 66, 67, 68, 69]); // ABCDE
        console.log(`Test encoding ABCDE: ${this.encodeSmallData(testBytes)}`);
    }
}
