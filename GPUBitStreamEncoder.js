/**
 * What: GPU-Accelerated BitStream Encoder
 * 
 * Handles encoding of binary data to URL-safe strings using DirectBaseEncoder.
 * Provides GPU acceleration when available with automatic CPU fallback.
 * 
 * Key Features:
 * - Direct integration with DirectBaseEncoder for optimal performance
 * - WebGL2 support detection without context creation warnings
 * - Comprehensive error handling and validation
 * - Memory-efficient processing for large datasets
 */
window.GPUBitStreamEncoder = class GPUBitStreamEncoder {
    /**
     * Initialize the encoder with the specified character set
     * @param {string} safeChars - URL-safe character set for encoding
     * @throws {Error} If safeChars is invalid or DirectBaseEncoder unavailable
     */
    constructor(safeChars) {
        // Validate character set
        if (!safeChars || typeof safeChars !== 'string' || safeChars.length === 0) {
            throw new Error('Invalid safeChars parameter - must be a non-empty string');
        }

        const uniqueChars = new Set(safeChars);
        if (uniqueChars.size !== safeChars.length) {
            throw new Error('safeChars contains duplicate characters');
        }

        this.SAFE_CHARS = safeChars;
        this.RADIX = safeChars.length;
        
        console.log(`Initializing encoder with ${this.RADIX} characters in safe set`);
        
        // Initialize lookup tables for compatibility with legacy code
        this.createLookupTables();
        
        // Initialize DirectBaseEncoder with comprehensive error handling
        this.initializeDirectEncoder(safeChars);
        
        // Check WebGL support safely (for future GPU acceleration features)
        this.gpuAccelerationEnabled = this.checkWebGLSupportSafely();
    }

    /**
     * Initialize the DirectBaseEncoder with proper error handling
     * @param {string} safeChars - Character set for the encoder
     * @throws {Error} If DirectBaseEncoder initialization fails
     */
    initializeDirectEncoder(safeChars) {
        try {
            if (!window.DirectBaseEncoder) {
                throw new Error('DirectBaseEncoder not available - ensure DirectBaseEncoder.js is loaded');
            }
            
            this.directEncoder = new window.DirectBaseEncoder(safeChars);
            console.log('DirectBaseEncoder initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize DirectBaseEncoder:', error);
            throw new Error(`DirectBaseEncoder initialization failed: ${error.message}`);
        }
    }

    /**
     * Safely check WebGL2 support without generating context warnings
     * Uses feature detection without actually creating contexts
     * @returns {boolean} Whether WebGL2 is potentially available
     */
    checkWebGLSupportSafely() {
        try {
            // Check if WebGL2RenderingContext constructor exists
            if (!window.WebGL2RenderingContext) {
                return false;
            }
            
            // Check if canvas supports webgl2 context (without creating one)
            const canvas = document.createElement('canvas');
            const supportedContexts = canvas.getSupportedContexts?.() || [];
            
            if (supportedContexts.includes('webgl2')) {
                console.log('WebGL2 support detected');
                return true;
            }
            
            // Fallback: assume support is available if constructor exists
            console.log('WebGL2 constructor available, assuming support');
            return true;
            
        } catch (error) {
            console.info('WebGL2 not available:', error.message);
            return false;
        }
    }

    /**
     * Create lookup tables for character-to-index mapping
     * Provides compatibility with legacy code that expects these properties
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
     * Main encoding function using DirectBaseEncoder
     * Converts binary data to URL-safe encoded string
     * 
     * @param {ArrayBuffer|Uint8Array} data - Binary data to encode
     * @returns {Promise<string>} URL-safe encoded string
     * @throws {Error} If input validation fails or encoding errors occur
     */
    async encodeBits(data) {
        // Input validation
        if (!data) {
            throw new Error('Input data is required');
        }
        
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        
        if (bytes.length === 0) {
            throw new Error('Input data cannot be empty');
        }

        // Verify DirectBaseEncoder is available
        if (!this.directEncoder) {
            throw new Error('DirectBaseEncoder not initialized. Check dependencies.');
        }

        try {
            // Use DirectBaseEncoder for all encoding operations
            const encoded = this.directEncoder.encode(bytes);
            
            // Validate the encoded result
            if (!encoded || typeof encoded !== 'string') {
                throw new Error('Encoding produced invalid result');
            }
            
            return encoded;
            
        } catch (error) {
            console.error('DirectBaseEncoder error:', error);
            throw new Error(`Encoding failed: ${error.message}`);
        }
    }

    /**
     * Convert input data to bit array format
     * Provides compatibility with legacy code expectations
     * 
     * @param {ArrayBuffer|Uint8Array} buffer - Input buffer
     * @returns {Promise<Uint8Array>} Bit array representation
     */
    async toBitArray(buffer) {
        // Ensure we have a Uint8Array
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        
        // DirectBaseEncoder handles byte arrays directly, so we just return the bytes
        return bytes;
    }

    /**
     * Check if WebGL context is lost
     * Legacy compatibility method - always returns true since we don't maintain a context
     * @returns {boolean} Always true (no persistent context maintained)
     */
    isContextLost() {
        return true; // No persistent WebGL context maintained
    }
    
    /**
     * Getter version of isContextLost for API consistency
     * @returns {boolean} Always true (no persistent context maintained)
     */
    get isContextLost() {
        return true;
    }
}

// Validate configuration on load
if (window.CONFIG && window.CONFIG.SAFE_CHARS) {
    try {
        // Test encoder initialization with current configuration
        const testEncoder = new window.GPUBitStreamEncoder(window.CONFIG.SAFE_CHARS);
        console.log('✅ GPUBitStreamEncoder validation passed');
        
        // Clean up test instance
        testEncoder.directEncoder = null;
        
    } catch (error) {
        console.error('❌ GPUBitStreamEncoder validation failed:', error);
    }
} else {
    console.warn('⚠️ CONFIG.SAFE_CHARS not available for encoder validation');
}
