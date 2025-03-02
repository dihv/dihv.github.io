/**
 * GPU-Accelerated BitStream Decoder
 * File: GPUBitStreamDecoder.js
 *
 * Handles decoding of URL-safe strings back to binary data with GPU acceleration when available.
 * Includes automatic CPU fallback for compatibility across all devices.
 */
window.GPUBitStreamDecoder = class GPUBitStreamDecoder {
    /**
     * Creates a new decoder instance
     * @param {string} safeChars - Character set for decoding (must match the encoder)
     */
    constructor(safeChars) {
        // Validation
        if (!safeChars || typeof safeChars !== 'string' || safeChars.length === 0) {
            throw new Error('Invalid safeChars parameter');
        }

        // Ensure no duplicate characters
        const uniqueChars = new Set(safeChars);
        if (uniqueChars.size !== safeChars.length) {
            throw new Error('safeChars contains duplicate characters');
        }

        // Store configuration
        this.SAFE_CHARS = safeChars;
        this.RADIX = safeChars.length;
        
        // Initialize lookup tables
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
            console.log('GPU acceleration enabled for BitStream decoding');
        } catch (error) {
            console.warn(`GPU acceleration unavailable: ${error.message}. Using CPU implementation.`);
            // Continue with CPU fallback
        }
    }

    /**
     * Sets up event listeners for WebGL context events
     */
    initializeContextListeners() {
        if (!this.gl || !this.canvas) return;
        
        this.canvas.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            console.warn('WebGL context lost. GPU acceleration disabled until context is restored.');
            this.gpuAccelerationEnabled = false;
        }, false);
        
        this.canvas.addEventListener('webglcontextrestored', (event) => {
            console.log('WebGL context restored. Reinitializing GPU resources...');
            try {
                this.initializeShaders();
                this.createBuffers();
                this.gpuAccelerationEnabled = true;
                console.log('GPU acceleration re-enabled successfully');
            } catch (error) {
                console.error('Failed to reinitialize after context restoration:', error);
            }
        }, false);
    }

    /**
     * Initializes WebGL context with optimal settings
     */
    initializeWebGL() {
        this.canvas = document.createElement('canvas');
        
        const contextAttributes = {
            alpha: false,
            depth: false,
            stencil: false,
            antialias: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: false,
            failIfMajorPerformanceCaveat: true
        };

        this.gl = this.canvas.getContext('webgl2', contextAttributes);
        
        if (!this.gl) {
            throw new Error('WebGL 2 not supported or disabled');
        }

        // Check for required extensions
        const requiredExtensions = [
            'EXT_color_buffer_float',
            'OES_texture_float_linear',
            'EXT_color_buffer_integer'
        ];

        for (const extName of requiredExtensions) {
            const ext = this.gl.getExtension(extName);
            if (!ext) {
                throw new Error(`Required WebGL extension ${extName} not supported`);
            }
        }
    }

    /**
     * Initialize decoder shaders
     */
    initializeShaders() {
        if (!this.gl) return;
        
        // Vertex shader - same as encoder
        const vertexShaderSource = `#version 300 es
            layout(location = 0) in vec2 a_position;
            layout(location = 1) in vec2 a_texCoord;
            out vec2 v_texCoord;
            
            void main() {
                v_texCoord = a_texCoord;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }`;

        // Fragment shader specific for decoding
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
                
                // Read source encoded values (4 indices per texel/pixel)
                uvec4 encodedValues = texelFetch(u_sourceData, texelCoord, 0);
                
                // Convert base-N indices back to binary (reverse of encoding)
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

        // Create and compile shader program
        const program = this.createShaderProgram(vertexShaderSource, fragmentShaderSource);
        
        // Store program and uniform locations
        this.shaderProgram = {
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

    /**
     * Creates vertex buffers for rendering
     */
    createBuffers() {
        if (!this.gl) return;
        
        const gl = this.gl;
        
        // Create vertex buffer (full-screen quad)
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
     */
    setupVertexAttributes() {
        if (!this.gl) return;
        
        const gl = this.gl;
        const locations = this.shaderProgram.locations;
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.enableVertexAttribArray(locations.position);
        gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.texCoord);
        gl.enableVertexAttribArray(locations.texCoord);
        gl.vertexAttribPointer(locations.texCoord, 2, gl.FLOAT, false, 0, 0);
    }

    /**
     * Creates lookup tables for fast encoding and decoding
     */
    createLookupTables() {
        this.charToIndex = new Map();
        this.indexToChar = new Map();
        
        for (let i = 0; i < this.SAFE_CHARS.length; i++) {
            this.charToIndex.set(this.SAFE_CHARS[i], i);
            this.indexToChar.set(i, this.SAFE_CHARS[i]);
        }
    }

    /**
     * Main decoding function that processes encoded data using GPU or CPU
     * @param {string} encodedString - Encoded URL-safe string
     * @returns {Promise<ArrayBuffer>} - Decoded binary data
     */
    async decodeBits(encodedString) {
        if (!encodedString) {
            throw new Error('No encoded data provided');
        }

        // Check for small data format (optimized encoding for small inputs)
        if (encodedString.startsWith('~')) {
            return this.decodeSmallData(encodedString);
        }
        
        try {
            // Extract metadata and verify integrity
            const { originalLength, dataSection, expectedChecksum } = this.extractMetadata(encodedString);
            
            // Verify checksum
            const actualChecksum = this.calculateChecksum(dataSection);
            const checksumValid = (expectedChecksum === actualChecksum);
            
            if (!checksumValid) {
                console.warn('Checksum verification failed, data may be corrupted');
                // We continue with decoding despite checksum failure
                // as partial data recovery is better than nothing
            }
            
            // Choose implementation based on GPU availability and data size
            const smallDataThreshold = window.CONFIG && window.CONFIG.GPU_USE_THRESHOLD || 5000;
            if (originalLength < smallDataThreshold || !this.gpuAccelerationEnabled || 
                (this.gl && this.gl.isContextLost())) {
                return this.decodeWithCPU(dataSection, originalLength);
            } else {
                try {
                    return await this.decodeWithGPU(dataSection, originalLength);
                } catch (error) {
                    console.warn(`GPU decoding failed: ${error.message}. Falling back to CPU.`);
                    return this.decodeWithCPU(dataSection, originalLength);
                }
            }
        } catch (error) {
            // If anything goes wrong with metadata extraction or decoding,
            // try the legacy format as a last resort
            console.warn(`Standard decoding failed: ${error.message}. Trying legacy format.`);
            try {
                return this.decodeWithCPULegacy(encodedString);
            } catch (legacyError) {
                throw new Error(`Decoding failed: ${error.message}. Legacy fallback also failed: ${legacyError.message}`);
            }
        }
    }

    /**
     * Decodes small data format (optimized encoding for small inputs)
     * @param {string} encodedString - Encoded string starting with '~'
     * @returns {ArrayBuffer} - Decoded binary data
     */
    decodeSmallData(encodedString) {
        try {
            // Strip the marker '~'
            const dataStr = encodedString.substring(1);
            
            // Need at least 3 chars (1 for length, 1 for checksum, 1+ for data)
            if (dataStr.length < 3) {
                throw new Error('Invalid small data format: too short');
            }
            
            // First try with explicit length detection by checking format
            const smallThreshold = window.CONFIG.ENCODE_SMALL_THRESHOLD || 32;
            let length = 0;
            let lengthChars = 0;
            let checksumIndex = 0;
            
            // Try single character length (most common for very small data)
            if (this.RADIX > smallThreshold) {
                // If RADIX is large enough, a single character can encode the entire length
                length = this.charToIndex.get(dataStr[0]);
                lengthChars = 1;
                checksumIndex = 1;
            } else {
                // For smaller RADIX values, we need to check if we're using 1 or 2 characters
                // First, try to decode with 1 character and see if it's plausible
                const singleCharLength = this.charToIndex.get(dataStr[0]);
                
                // Check if single char length is plausible based on string length
                const expectedLengthSingle = singleCharLength * 2 + 2; // 2 chars per byte + length char + checksum char
                
                if (singleCharLength < smallThreshold && Math.abs(dataStr.length - expectedLengthSingle) <= 2) {
                    // Single char length is plausible
                    length = singleCharLength;
                    lengthChars = 1; 
                    checksumIndex = 1;
                } else {
                    // Try 2 character length encoding
                    const twoCharLength = this.charToIndex.get(dataStr[0]) * this.RADIX + 
                                       this.charToIndex.get(dataStr[1]);
                    
                    // Check if two char length is plausible
                    const expectedLengthDouble = twoCharLength * 2 + 3; // 2 chars per byte + 2 length chars + checksum char
                    
                    if (twoCharLength <= smallThreshold && Math.abs(dataStr.length - expectedLengthDouble) <= 4) {
                        length = twoCharLength;
                        lengthChars = 2;
                        checksumIndex = 2;
                    } else {
                        throw new Error('Could not determine valid length encoding');
                    }
                }
            }
            
            // Get checksum character
            const checksumChar = dataStr[checksumIndex];
            const expectedChecksum = this.charToIndex.get(checksumChar);
            
            // Extract data section
            const dataSection = dataStr.substring(checksumIndex + 1);
            
            // Decode data
            const result = new Uint8Array(length);
            let byteIndex = 0;
            
            if (this.RADIX < 256) {
                // Each byte takes 2 characters (for most common base64-like encodings)
                for (let i = 0; i < dataSection.length && byteIndex < length; i += 2) {
                    if (i + 1 < dataSection.length) {
                        const low = this.charToIndex.get(dataSection[i]);
                        const high = this.charToIndex.get(dataSection[i + 1]);
                        result[byteIndex++] = low + high * this.RADIX;
                    } else {
                        // Handle odd number of characters (shouldn't happen in proper encoding)
                        result[byteIndex++] = this.charToIndex.get(dataSection[i]);
                    }
                }
            } else {
                // Each character represents a full byte
                for (let i = 0; i < dataSection.length && byteIndex < length; i++) {
                    result[byteIndex++] = this.charToIndex.get(dataSection[i]);
                }
            }
            
            // Verify data length
            if (byteIndex !== length) {
                console.warn(`Decoded data length (${byteIndex}) doesn't match expected length (${length})`);
            }
            
            // Calculate and verify checksum
            let checksum = 0;
            for (let i = 0; i < length; i++) {
                checksum = (checksum + result[i]) % this.RADIX;
            }
            
            if (checksum !== expectedChecksum) {
                console.warn('Small data checksum verification failed, data may be corrupted');
            }
            
            return result.buffer;
        } catch (error) {
            console.error('Small data decoding error:', error);
            throw new Error(`Small data format decoding failed: ${error.message}`);
        }
    }

    /**
     * Extracts metadata from encoded string
     * @param {string} encodedString - Encoded URL-safe string
     * @returns {Object} - Extracted metadata, data section, and checksum
     */
    extractMetadata(encodedString) {
        // Read metadata length indicator (first character)
        const metadataLengthChar = encodedString[0];
        if (!this.charToIndex.has(metadataLengthChar)) {
            throw new Error(`Invalid metadata length character: '${metadataLengthChar}'`);
        }
        
        const metadataLength = this.charToIndex.get(metadataLengthChar);
        
        // Check for valid metadata length
        if (metadataLength <= 0 || metadataLength >= encodedString.length) {
            throw new Error(`Invalid metadata length: ${metadataLength}`);
        }
        
        // Extract metadata and data sections
        const metadataStr = encodedString.slice(1, metadataLength + 1);
        const dataSection = encodedString.slice(metadataLength + 1);
        
        // Parse checksum (last character of metadata)
        const checksumChar = metadataStr[metadataStr.length - 1];
        if (!this.charToIndex.has(checksumChar)) {
            throw new Error(`Invalid checksum character: '${checksumChar}'`);
        }
        
        const expectedChecksum = this.charToIndex.get(checksumChar);
        
        // Extract length information (all metadata except checksum)
        const lengthStr = metadataStr.slice(0, -1);
        
        // Calculate original length from base-N encoding
        let originalLength = 0;
        
        for (const char of lengthStr) {
            if (!this.charToIndex.has(char)) {
                throw new Error(`Invalid character in length encoding: '${char}'`);
            }
            originalLength = originalLength * this.RADIX + this.charToIndex.get(char);
        }
        
        // Validate original length
        if (originalLength <= 0) {
            throw new Error(`Invalid original length: ${originalLength}`);
        }
        
        return { originalLength, dataSection, expectedChecksum };
    }

    /**
     * Calculate checksum of encoded data for validation
     * @param {string} data - Encoded data string
     * @returns {number} - Calculated checksum
     */
    calculateChecksum(data) {
        let checksum = 0;
        for (const char of data) {
            if (!this.charToIndex.has(char)) {
                throw new Error(`Invalid character in data: '${char}'`);
            }
            checksum = (checksum + this.charToIndex.get(char)) % this.RADIX;
        }
        return checksum;
    }

    /**
     * CPU-based decoding implementation
     * @param {string} encodedData - Encoded data string
     * @param {number} originalLength - Original data length in bytes
     * @returns {ArrayBuffer} - Decoded binary data
     */
    decodeWithCPU(encodedData, originalLength) {
        const BYTE_SIZE = window.CONFIG.BYTE_SIZE || 4;
        const CHARS_PER_GROUP = BYTE_SIZE;
        
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
                    const char = encodedData[charIndex];
                    if (!this.charToIndex.has(char)) {
                        throw new Error(`Invalid character in data: '${char}'`);
                    }
                    const digitValue = this.charToIndex.get(char);
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

    /**
     * Legacy CPU decoder for backward compatibility
     * @param {string} encodedData - Full encoded string
     * @returns {ArrayBuffer} - Decoded binary data
     */
    decodeWithCPULegacy(encodedData) {
        // Simple heuristic: try to estimate original length
        const estimatedBytes = Math.floor(encodedData.length * 0.6); // Assume ~60% compression
        
        // Try decoding directly
        const result = new Uint8Array(estimatedBytes);
        const BYTE_SIZE = window.CONFIG.BYTE_SIZE || 4;
        let byteIndex = 0;
        
        try {
            // Process characters in groups
            for (let i = 0; i < encodedData.length; i += BYTE_SIZE) {
                if (byteIndex >= estimatedBytes) {
                    // Expand buffer if needed
                    const newBuffer = new Uint8Array(estimatedBytes * 1.5);
                    newBuffer.set(result);
                    result = newBuffer;
                }
                
                // Read up to BYTE_SIZE characters
                const groupSize = Math.min(BYTE_SIZE, encodedData.length - i);
                
                // Convert chars to values and calculate decimal value
                let value = 0;
                for (let j = 0; j < groupSize; j++) {
                    const charIndex = i + j;
                    if (charIndex < encodedData.length) {
                        const char = encodedData[charIndex];
                        if (!this.charToIndex.has(char)) {
                            continue; // Skip invalid chars in legacy mode
                        }
                        const digitValue = this.charToIndex.get(char);
                        value += digitValue * Math.pow(this.RADIX, j);
                    }
                }
                
                // Extract bytes in little-endian order
                for (let j = 0; j < BYTE_SIZE && byteIndex < result.length; j++) {
                    result[byteIndex++] = (value >> (j * 8)) & 0xFF;
                }
            }
            
            // Trim buffer to actual size
            return result.slice(0, byteIndex).buffer;
        } catch (error) {
            throw new Error(`Legacy decoding failed: ${error.message}`);
        }
    }

    /**
     * GPU-accelerated decoding implementation
     * @param {string} encodedData - Encoded data string
     * @param {number} originalLength - Original data length in bytes
     * @returns {Promise<ArrayBuffer>} - Decoded binary data
     */
    async decodeWithGPU(encodedData, originalLength) {
        if (!this.gl || !this.shaderProgram) {
            throw new Error('GPU decoding not available');
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
            if (!this.charToIndex.has(encodedData[i])) {
                throw new Error(`Invalid character in data: '${encodedData[i]}'`);
            }
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
        
        // Group input data correctly for GPU processing (4 indices per texel)
        const gl = this.gl;
        const paddedIndices = new Uint32Array(inputWidth * inputHeight * 4);
        
        // Properly group indices into texels/pixels (4 indices per pixel)
        for (let i = 0; i < encodedData.length; i += 4) {
            const pixelIndex = Math.floor(i / 4);
            const x = pixelIndex % inputWidth;
            const y = Math.floor(pixelIndex / inputWidth);
            const baseIndex = (y * inputWidth + x) * 4;
            
            // Set components (with bounds checking)
            paddedIndices[baseIndex] = i < encodedData.length ? encodedIndices[i] : 0;
            paddedIndices[baseIndex + 1] = i + 1 < encodedData.length ? encodedIndices[i + 1] : 0;
            paddedIndices[baseIndex + 2] = i + 2 < encodedData.length ? encodedIndices[i + 2] : 0;
            paddedIndices[baseIndex + 3] = i + 3 < encodedData.length ? encodedIndices[i + 3] : 0;
        }
        
        // Create input texture for encoded data
        const inputTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, inputTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        // Upload the grouped indices to GPU
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
            gl.useProgram(this.shaderProgram.program);
            
            // Setup vertex attributes
            this.setupVertexAttributes();
            
            // Set uniforms
            gl.uniform1ui(this.shaderProgram.locations.radix, this.RADIX);
            gl.uniform1ui(this.shaderProgram.locations.outputLength, originalLength);
            
            // Bind input texture
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, inputTexture);
            gl.uniform1i(this.shaderProgram.locations.sourceData, 0);
            
            // Execute GPU processing
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            
            // Detect and handle errors
            const error = gl.getError();
            if (error !== gl.NO_ERROR) {
                throw new Error(`WebGL error during processing: ${error}`);
            }
            
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
        } catch (error) {
            console.error('GPU decoding error:', error);
            throw error;
        } finally {
            // Clean up resources
            gl.deleteTexture(inputTexture);
            gl.deleteTexture(outputTexture);
            gl.deleteFramebuffer(framebuffer);
        }
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
}
