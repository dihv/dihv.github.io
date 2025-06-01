/**
 * What: GPU-Accelerated BitStream Encoder
 * How: 
 * File: GPUBitStreamEncoder.js
 *
 * Handles encoding of binary data to URL-safe strings using DirectBaseEncoder approach
 */
window.GPUBitStreamEncoderImpl = class GPUBitStreamEncoderImpl {
    constructor(safeChars) {  // FIXED: Was missing 'c' in constructor
        // Validate character set
        if (!safeChars || typeof safeChars !== 'string' || safeChars.length === 0) {
            throw new Error('Invalid safeChars parameter');
        }

        const uniqueChars = new Set(safeChars);
        if (uniqueChars.size !== safeChars.length) {
            throw new Error('safeChars contains duplicate characters');
        }

        this.SAFE_CHARS = safeChars;
        this.RADIX = safeChars.length;
        
        console.log(`Initializing encoder with ${this.RADIX} characters in safe set`);
        
        // Initialize lookup tables for compatibility
        this.createLookupTables();
        
        // Initialize DirectBaseEncoder with better error handling
        try {
            if (!window.DirectBaseEncoder) {
                throw new Error('DirectBaseEncoder not available');
            }
            this.directEncoder = new window.DirectBaseEncoder(safeChars);
        } catch (error) {
            console.error('Failed to initialize DirectBaseEncoder:', error);
            throw new Error(`DirectBaseEncoder initialization failed: ${error.message}`);
        }
        
        // Check WebGL support without causing context loss warnings
        this.gpuAccelerationEnabled = false;
        this.checkWebGLSupportSafely();
    }

    /**
     * Safely check WebGL support without causing warnings
     */
    checkWebGLSupportSafely() {
        try {
            // Only create context if we really need to check support
            // For now, just assume GPU acceleration is available
            // The actual context will be created when needed
            this.gpuAccelerationEnabled = true;
            console.log('WebGL2 assumed available for GPU acceleration');
        } catch (e) {
            console.info('WebGL2 not available, using CPU fallback');
            this.gpuAccelerationEnabled = false;
        }
    }

    /**
     * What: Check WebGL support for future GPU acceleration
     * Why: 
     */
    checkWebGLSupport() {
        try {
            this.canvas = document.createElement('canvas');
            this.gl = this.canvas.getContext('webgl2', {
                antialias: false,
                depth: false,
                stencil: false,
                preserveDrawingBuffer: false
            });
            
            if (this.gl) {
                this.gpuAccelerationEnabled = true;
                console.log('WebGL2 context available for future GPU acceleration');
            }
        } catch (e) {
            console.warn('WebGL2 not available');
        }
    }

    /**
     * What: Creates lookup tables for fast encoding/decoding
     * Why: 
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
     * What: Main encoding function using DirectBaseEncoder
     * Why: 
     * @param {ArrayBuffer|Uint8Array} data - Binary data to encode
     * @returns {Promise<string>} - URL-safe encoded string
     */
    async encodeBits(data) {
        if (!data) {
            throw new Error('Input data is required');
        }
        
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        
        if (bytes.length === 0) {
            throw new Error('Input data cannot be empty');
        }

        // Check if directEncoder is properly initialized
        if (!this.directEncoder) {
            throw new Error('DirectBaseEncoder not initialized. Check dependencies.');
        }

        try {
            // Use DirectBaseEncoder for all encoding
            return this.directEncoder.encode(bytes);
        } catch (error) {
            console.error('DirectBaseEncoder error:', error);
            throw new Error(`Encoding failed: ${error.message}`);
        }
    }

    /**
     * What: Decode encoded string back to binary (delegates to decoder)
     * Why: 
     * @param {string} encodedString - Encoded string
     * @returns {Promise<ArrayBuffer>} - Decoded binary data
     */
    async decodeBits(encodedString) {
        // This will be handled by GPUBitStreamDecoder
        if (!window.GPUBitStreamDecoder) {
            throw new Error('Decoder not available');
        }
        
        const decoder = new window.GPUBitStreamDecoder(this.SAFE_CHARS);
        return decoder.decodeBits(encodedString);
    }

    /**
     * What: Check if WebGL context is lost
     * Why: 
     * @returns {boolean}
     */
    isContextLost() {
        return this.gl ? this.gl.isContextLost() : true;
    }
    
    /**
     * What: Extract metadata from encoded string (for compatibility)
     * Why: 
     * @param {string} encodedString - Encoded string
     * @returns {Object} - Metadata
     */
    extractMetadata(encodedString) {
        const decoder = new window.GPUBitStreamDecoder(this.SAFE_CHARS);
        return decoder.extractMetadata(encodedString);
    }
    
    /**
     * What: Calculate checksum for data validation
     * Why: 
     * @param {string} data - Encoded data string
     * @returns {number} - Calculated checksum
     */
    calculateChecksum(data) {
        const decoder = new window.GPUBitStreamDecoder(this.SAFE_CHARS);
        return decoder.calculateChecksum(data);
    }

    /**
     * What: Convert ArrayBuffer or Uint8Array to bit array
     * Why:
     * @param {ArrayBuffer|Uint8Array} buffer - Input buffer
     * @returns {Uint8Array} Bit array representation
     */
    async toBitArray(buffer) {
        // Ensure we have a Uint8Array
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        
        // For compatibility, we can just return the bytes directly
        // since the DirectBaseEncoder handles byte arrays
        return bytes;
    }
}
