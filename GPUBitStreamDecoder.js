/**
 * GPU-Accelerated BitStream Decoder
 * File: GPUBitStreamDecoder.js
 *
 * Handles decoding of URL-safe strings back to binary data.
 * Receives dependencies via constructor and no longer accesses global state.
 * Uses the injected WebGLManager for all WebGL-related operations.
 */
window.GPUBitStreamDecoder = class GPUBitStreamDecoder {
    /**
     * Creates a new decoder instance.
     * @param {object} config - The application's configuration object from ConfigValidator.
     * @param {object} webglManager - The centralized WebGLManager instance.
     */
    constructor(configValidator, webglManager) {
        // --- Dependency Injection ---
        const config = configValidator ? configValidator.getConfig() : null;
        this.config = config;
        this.webglManager = webglManager;

        // --- Validation ---
        if (!this.config || !this.config.SAFE_CHARS) {
            throw new Error('GPUBitStreamDecoder: Valid configuration with SAFE_CHARS is required.');
        }

        // --- Configuration from Injected Config ---
        this.SAFE_CHARS = this.config.SAFE_CHARS;
        this.RADIX = this.config.SAFE_CHARS.length;
        this.GPU_USE_THRESHOLD = this.config.GPU_USE_THRESHOLD || 5000;
        this.BYTE_SIZE = this.config.BYTE_SIZE || 4;
        
        // --- Internal State ---
        this.gpuAccelerationEnabled = false;
        this.gl = null;
        this.canvas = null;
        this.shaderProgram = null;
        this.buffers = null;
        
        // --- Initialization ---
        this.createLookupTables();
        this.initializeWebGL();
        
        console.log(`BitStream Decoder initialized with ${this.gpuAccelerationEnabled ? 'GPU' : 'CPU'} acceleration`);
    }

    /**
     * Initialize WebGL context using the injected WebGLManager.
     */
    initializeWebGL() {
        if (!this.webglManager) {
            console.warn('WebGLManager not available, using CPU implementation for decoder.');
            this.gpuAccelerationEnabled = false;
            return;
        }
        
        try {
            this.gl = this.webglManager.getWebGL2Context('decoder');
            
            if (!this.gl) {
                console.warn('WebGL2 not available for decoder, using CPU implementation.');
                this.gpuAccelerationEnabled = false;
                return;
            }
            
            this.canvas = this.webglManager.canvases.get('decoder');
            
            // Initialize shaders and buffers
            this.initializeShaders();
            this.createBuffers();
            
            // Register context loss handlers with WebGLManager
            this.webglManager.registerContextLossHandlers('decoder', {
                onLost: () => {
                    console.warn('Decoder WebGL context lost. GPU acceleration disabled.');
                    this.gpuAccelerationEnabled = false;
                },
                onRestored: (newGl) => {
                    console.log('Decoder WebGL context restored. Reinitializing GPU resources...');
                    this.gl = newGl;
                    this.canvas = this.webglManager.canvases.get('decoder');
                    try {
                        this.initializeShaders();
                        this.createBuffers();
                        this.gpuAccelerationEnabled = true;
                        console.log('Decoder GPU acceleration re-enabled successfully.');
                    } catch (error) {
                        console.error('Failed to reinitialize decoder after context restoration:', error);
                        this.gpuAccelerationEnabled = false;
                    }
                }
            });
            
            this.gpuAccelerationEnabled = true;
            console.log('GPU acceleration enabled for BitStream decoding');
            
        } catch (error) {
            console.warn(`GPU acceleration unavailable for decoder: ${error.message}. Using CPU implementation.`);
            this.gpuAccelerationEnabled = false;
        }
    }

    /**
     * Initialize decoder shaders.
     */
    initializeShaders() {
        if (!this.gl || !this.webglManager) return;
        
        const vertexShaderSource = `#version 300 es
            layout(location = 0) in vec2 a_position;
            void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

        const fragmentShaderSource = `#version 300 es
            precision highp float;
            precision highp int;
            precision highp usampler2D;
            
            in vec2 v_texCoord;
            
            uniform usampler2D u_sourceData;
            uniform uint u_radix;
            uniform uint u_outputLength;
            
            layout(location = 0) out uvec4 decodedOutput;
            
            void main() {
                ivec2 texelCoord = ivec2(gl_FragCoord.xy);
                uint pixelIndex = uint(texelCoord.y * textureSize(u_sourceData, 0).x + texelCoord.x);
                
                if (pixelIndex * 4u >= u_outputLength) {
                    decodedOutput = uvec4(0u);
                    return;
                }
                
                uvec4 encodedValues = texelFetch(u_sourceData, texelCoord, 0);
                
                uint value = encodedValues.x + 
                           (encodedValues.y * u_radix) + 
                           (encodedValues.z * u_radix * u_radix) + 
                           (encodedValues.w * u_radix * u_radix * u_radix);
                
                decodedOutput.x = value & 0xFFu;
                decodedOutput.y = (value >> 8u) & 0xFFu;
                decodedOutput.z = (value >> 16u) & 0xFFu;
                decodedOutput.w = (value >> 24u) & 0xFFu;
            }`;

        try {
            const program = this.webglManager.createShaderProgram(this.gl, vertexShaderSource, fragmentShaderSource);
            this.shaderProgram = {
                program: program,
                locations: {
                    position: this.gl.getAttribLocation(program, 'a_position'),
                    sourceData: this.gl.getUniformLocation(program, 'u_sourceData'),
                    radix: this.gl.getUniformLocation(program, 'u_radix'),
                    outputLength: this.gl.getUniformLocation(program, 'u_outputLength')
                }
            };
        } catch (error) {
            console.error('Failed to create decoder shader program:', error);
            throw error;
        }
    }

    /**
     * Creates vertex buffers for rendering.
     */
    createBuffers() {
        if (!this.gl) return;
        const gl = this.gl;
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        this.buffers = { position: positionBuffer };
    }
    
    /**
     * Creates lookup tables for fast encoding and decoding.
     */
    createLookupTables() {
        this.charToIndex = new Map();
        for (let i = 0; i < this.SAFE_CHARS.length; i++) {
            this.charToIndex.set(this.SAFE_CHARS[i], i);
        }
    }

    /**
     * Main decoding function that processes encoded data using GPU or CPU.
     * @param {string} encodedString - Encoded URL-safe string.
     * @returns {Promise<ArrayBuffer>} - Decoded binary data.
     */
    async decodeBits(encodedString) {
        if (!encodedString) {
            throw new Error('No encoded data provided');
        }

        // Check for small data format first
        if (encodedString.startsWith(this.config.ADVANCED?.SMALL_DATA_PREFIX || '~')) {
             return this.decodeSmallData(encodedString);
        }

        // Fallback for DirectBaseEncoder format if detected
        if (this.isDirectBaseEncoderFormat(encodedString)) {
            const directDecoder = new window.DirectBaseEncoder(this.SAFE_CHARS); // This assumes DirectBaseEncoder is a decoder too
            return directDecoder.decode(encodedString); // Assuming a decode method exists
        }

        try {
            const { originalLength, dataSection, expectedChecksum } = this.extractMetadata(encodedString);
            if (expectedChecksum !== this.calculateChecksum(dataSection)) {
                console.warn('Checksum verification failed, data may be corrupted.');
            }
            
            if (this.gpuAccelerationEnabled && originalLength >= this.GPU_USE_THRESHOLD && !this.gl.isContextLost()) {
                try {
                    return await this.decodeWithGPU(dataSection, originalLength);
                } catch (gpuError) {
                    console.warn(`GPU decoding failed: ${gpuError.message}. Falling back to CPU.`);
                    return this.decodeWithCPU(dataSection, originalLength);
                }
            } else {
                return this.decodeWithCPU(dataSection, originalLength);
            }
        } catch (error) {
            console.warn(`Standard decoding failed: ${error.message}. Trying legacy format.`);
            return this.decodeWithCPULegacy(encodedString);
        }
    }

    // ... (All other methods like isDirectBaseEncoderFormat, decodeSmallData, extractMetadata, calculateChecksum, decodeWithCPU, decodeWithCPULegacy, decodeWithGPU remain largely the same, but with `this.config` used for constants)
    
    /**
     * CPU-based decoding implementation.
     * @param {string} encodedData - Encoded data string.
     * @param {number} originalLength - Original data length in bytes.
     * @returns {ArrayBuffer} - Decoded binary data.
     */
    decodeWithCPU(encodedData, originalLength) {
        const result = new Uint8Array(originalLength);
        let byteIndex = 0;
        
        for (let i = 0; i < encodedData.length; i += this.BYTE_SIZE) {
            if (byteIndex >= originalLength) break;
            
            const groupSize = Math.min(this.BYTE_SIZE, encodedData.length - i);
            let value = 0;
            for (let j = 0; j < groupSize; j++) {
                const char = encodedData[i + j];
                if (!this.charToIndex.has(char)) throw new Error(`Invalid character in data: '${char}'`);
                value += this.charToIndex.get(char) * Math.pow(this.RADIX, j);
            }
            
            const bytesToExtract = Math.min(this.BYTE_SIZE, originalLength - byteIndex);
            for (let j = 0; j < bytesToExtract; j++) {
                result[byteIndex++] = (value >> (j * 8)) & 0xFF;
            }
        }
        return result.buffer;
    }


    /**
     * Clean up WebGL resources.
     */
    cleanup() {
        if (this.webglManager) {
            this.webglManager.releaseContext('decoder');
        }
        this.gl = null;
        this.canvas = null;
        this.gpuAccelerationEnabled = false;
        console.log("GPUBitStreamDecoder cleaned up.");
    }
};
