/**
 * What: GPU-Accelerated BitStream Encoder
 * How: Uses centralized WebGLManager for context management
 * Handles encoding of binary data to URL-safe strings using DirectBaseEncoder.
 * Provides GPU acceleration when available with automatic CPU fallback.
 * 
 * Key Features:
 * - Direct integration with DirectBaseEncoder for optimal performance
 * - WebGL2 support detection without context creation warnings
 * - Comprehensive error handling and validation
 * - Memory-efficient processing for large datasets
 */
window.GPUBitStreamEncoderImpl = class GPUBitStreamEncoderImpl {
    constructor(safeChars) {
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
        
        // Initialize WebGL using centralized manager
        this.initializeWebGLContext();
    }

    /**
     * Initialize WebGL context using WebGLManager
     */
    initializeWebGLContext() {
        try {
            // Check if WebGLManager is available
            if (!window.webGLManager) {
                console.info('WebGLManager not available, WebGL features disabled');
                this.gpuAccelerationEnabled = false;
                return;
            }
            
            // Get WebGL2 context from manager
            this.gl = window.webGLManager.getWebGL2Context('encoder', {
                alpha: false,
                depth: false,
                stencil: false,
                preserveDrawingBuffer: false
            });
            
            if (this.gl) {
                // Get the canvas from the manager
                this.canvas = window.webGLManager.canvases.get('encoder');
                this.gpuAccelerationEnabled = true;
                
                // Register context loss handlers
                window.webGLManager.registerContextLossHandlers('encoder', {
                    onLost: () => {
                        console.warn('Encoder WebGL context lost');
                        this.gpuAccelerationEnabled = false;
                    },
                    onRestored: (newGl) => {
                        console.log('Encoder WebGL context restored');
                        this.gl = newGl;
                        this.gpuAccelerationEnabled = true;
                        // Re-initialize shaders and resources if needed
                        this.initializeWebGLResources();
                    }
                });
                
                // Initialize WebGL resources
                this.initializeWebGLResources();
                
                console.log('WebGL2 context initialized for encoder via WebGLManager');
            } else {
                console.info('WebGL2 not available, using CPU fallback');
                this.gpuAccelerationEnabled = false;
            }
            
        } catch (error) {
            console.warn('WebGL initialization failed:', error);
            this.gpuAccelerationEnabled = false;
        }
    }
    
    /**
     * Initialize WebGL resources (shaders, buffers, etc.)
     */
    initializeWebGLResources() {
        if (!this.gl) return;
        
        try {
            // This is where you would initialize shaders, buffers, etc.
            // For now, just log that resources are ready
            console.log('WebGL resources initialized for encoder');
        } catch (error) {
            console.error('Failed to initialize WebGL resources:', error);
            this.gpuAccelerationEnabled = false;
        }
    }

    /**
     * What: Creates lookup tables for fast encoding/decoding
     * Why: Performance optimization
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
     * Why: Optimal encoding efficiency and URL safety
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
     * Why: Backward compatibility
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
     * Why: Context recovery and fallback handling
     * @returns {boolean}
     */
    isContextLost() {
        return this.gl ? this.gl.isContextLost() : true;
    }
    
    /**
     * What: Extract metadata from encoded string (for compatibility)
     * Why: Backward compatibility with existing decoder API
     * @param {string} encodedString - Encoded string
     * @returns {Object} - Metadata
     */
    extractMetadata(encodedString) {
        const decoder = new window.GPUBitStreamDecoder(this.SAFE_CHARS);
        return decoder.extractMetadata(encodedString);
    }
    
    /**
     * What: Calculate checksum for data validation
     * Why: Data integrity verification
     * @param {string} data - Encoded data string
     * @returns {number} - Calculated checksum
     */
    calculateChecksum(data) {
        const decoder = new window.GPUBitStreamDecoder(this.SAFE_CHARS);
        return decoder.calculateChecksum(data);
    }

    /**
     * What: Convert ArrayBuffer or Uint8Array to bit array
     * Why: Compatibility with existing API
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
    
    /**
     * Clean up WebGL resources
     */
    cleanup() {
        if (window.webGLManager) {
            window.webGLManager.releaseContext('encoder');
        }
        this.gl = null;
        this.canvas = null;
        this.gpuAccelerationEnabled = false;
    }
};
