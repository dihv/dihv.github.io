/**
 * BitStreamAdapter.js
 * 
 * Provides backward compatibility for existing code that uses GPUBitStreamEncoder
 * This adapter transparently routes calls to either the encoder or decoder
 * based on the required functionality.
 */
window.GPUBitStreamEncoder = class GPUBitStreamEncoder {
    constructor(safeChars) {
        console.log('Creating BitStream adapter with backward compatibility');
        
        // Create both encoder and decoder instances
        this._encoder = new window.GPUBitStreamEncoderImpl(safeChars);
        this._decoder = new window.GPUBitStreamDecoder(safeChars);
        
        // Copy properties from encoder for compatibility
        this.SAFE_CHARS = safeChars;
        this.RADIX = safeChars.length;
        this.charToIndex = this._encoder.charToIndex;
        this.indexToChar = this._encoder.indexToChar;
        this.gpuAccelerationEnabled = this._encoder.gpuAccelerationEnabled;
        
        // Reference to WebGL context (if available)
        this.gl = this._encoder.gl;
        this.canvas = this._encoder.canvas;
    }
    
    // Methods forwarded to encoder
    async encodeBits(data) {
        return this._encoder.encodeBits(data);
    }
    
    toBitArray(buffer) {
        return this._encoder.toBitArray(buffer);
    }
    
    createLookupTables() {
        return this._encoder.createLookupTables();
    }
    
    // Methods forwarded to decoder
    async decodeBits(encodedString) {
        return this._decoder.decodeBits(encodedString);
    }
    
    // Additional compatibility methods
    extractMetadata(encodedString) {
        return this._decoder.extractMetadata(encodedString);
    }
    
    verifyChecksum(data, expectedChecksum) {
        const actualChecksum = this._decoder.calculateChecksum(data);
        return actualChecksum === expectedChecksum;
    }
    
    // Handle potential WebGL context loss
    get isContextLost() {
        return this.gl ? this.gl.isContextLost() : true;
    }
};

// Rename original encoder to avoid conflict
window.GPUBitStreamEncoderImpl = window.GPUBitStreamEncoder;
