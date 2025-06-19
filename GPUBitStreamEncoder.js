/**
 * What: GPU-Accelerated BitStream Encoder
 * How: Receives dependencies (config, webglManager) from the SystemManager.
 * Handles encoding of binary data to URL-safe strings using DirectBaseEncoder.
 * Provides GPU acceleration when available with automatic CPU fallback.
 *
 * Key Features:
 * - Decoupled from global objects, receives dependencies via constructor.
 * - Integrates with the new centralized WebGLManager and ConfigValidator.
 * - Preserves the core, efficient encoding logic.
 */
window.GPUBitStreamEncoder = class GPUBitStreamEncoder {
    constructor(config, webglManager) {
        // Validate dependencies
        if (!config || !config.SAFE_CHARS) {
            throw new Error('GPUBitStreamEncoder: Valid configuration object with SAFE_CHARS is required.');
        }

        this.config = config;
        this.webglManager = webglManager;

        this.SAFE_CHARS = this.config.SAFE_CHARS;
        this.RADIX = this.SAFE_CHARS.length;
        
        console.log(`Initializing encoder with ${this.RADIX} characters in safe set.`);
        
        // Initialize lookup tables
        this.createLookupTables();
        
        // Initialize DirectBaseEncoder, which is expected to be globally available
        if (!window.DirectBaseEncoder) {
            throw new Error('DirectBaseEncoder dependency not found. Ensure it is loaded before GPUBitStreamEncoder.');
        }
        this.directEncoder = new window.DirectBaseEncoder(this.SAFE_CHARS);
        
        // Initialize WebGL using the provided manager
        this.initializeWebGLContext();
    }

    /**
     * Initialize WebGL context using the injected WebGLManager
     */
    initializeWebGLContext() {
        try {
            if (!this.webglManager) {
                console.info('WebGLManager not available, GPU acceleration disabled for encoder.');
                this.gpuAccelerationEnabled = false;
                return;
            }
            
            this.gl = this.webglManager.getWebGL2Context('encoder', {
                alpha: false,
                depth: false,
                stencil: false,
                preserveDrawingBuffer: false
            });
            
            if (this.gl) {
                this.canvas = this.webglManager.canvases.get('encoder');
                this.gpuAccelerationEnabled = true;
                
                // Register context loss handlers via the manager
                this.webglManager.registerContextLossHandlers('encoder', {
                    onLost: () => {
                        console.warn('Encoder WebGL context lost. GPU acceleration disabled.');
                        this.gpuAccelerationEnabled = false;
                    },
                    onRestored: (newGl) => {
                        console.log('Encoder WebGL context restored. Re-enabling GPU acceleration.');
                        this.gl = newGl;
                        this.gpuAccelerationEnabled = true;
                    }
                });
                
                console.log('WebGL2 context initialized for encoder via WebGLManager.');
            } else {
                console.info('WebGL2 not available for encoder, using CPU fallback.');
                this.gpuAccelerationEnabled = false;
            }
            
        } catch (error) {
            console.warn('Encoder WebGL initialization failed:', error);
            this.gpuAccelerationEnabled = false;
        }
    }

    /**
     * Creates lookup tables for fast encoding/decoding.
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
     * Main encoding function using DirectBaseEncoder for optimal performance.
     * @param {ArrayBuffer|Uint8Array} data - Binary data to encode.
     * @returns {Promise<string>} - URL-safe encoded string.
     */
    async encodeBits(data) {
        if (!data) {
            throw new Error('Input data is required for encoding.');
        }
        
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        
        if (bytes.length === 0) {
            // Returning an empty string for empty input is a reasonable default.
            return '';
        }

        try {
            // The core logic is delegated to the highly optimized DirectBaseEncoder.
            return this.directEncoder.encode(bytes);
        } catch (error) {
            console.error('DirectBaseEncoder error during encodeBits:', error);
            throw new Error(`Encoding failed: ${error.message}`);
        }
    }

    /**
     * Converts an ArrayBuffer or Uint8Array to a bit array representation.
     * For compatibility with the refactored system, this simply returns the byte array
     * as DirectBaseEncoder operates directly on bytes.
     * @param {ArrayBuffer|Uint8Array} buffer - Input buffer.
     * @returns {Promise<Uint8Array>} - The byte array.
     */
    async toBitArray(buffer) {
        return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    }

    /**
     * Checks if the WebGL context is lost.
     * @returns {boolean} - True if the context is lost or unavailable.
     */
    isContextLost() {
        return this.gl ? this.gl.isContextLost() : true;
    }
    
    /**
     * Cleans up WebGL resources associated with this component.
     */
    cleanup() {
        if (this.webglManager) {
            this.webglManager.releaseContext('encoder');
        }
        this.gl = null;
        this.canvas = null;
        this.gpuAccelerationEnabled = false;
        console.log('GPUBitStreamEncoder cleaned up.');
    }
};