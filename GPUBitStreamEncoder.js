/**
 * What: GPU-Accelerated BitStream Encoder
 * How: Receives dependencies (config, webglManager) from the SystemManager.
 * This component now acts as a wrapper, delegating the core encoding logic
 * to the highly optimized DirectBaseEncoder.
 * It still manages the WebGL context for potential future GPU-specific optimizations
 * but the primary encoding path is through the CPU-based DirectBaseEncoder
 * for maximum efficiency and simplicity.
 *
 * Key Features:
 * - Decoupled from global objects, receives dependencies via constructor.
 * - Integrates with the new centralized WebGLManager and ConfigValidator.
 * - Correctly delegates encoding to DirectBaseEncoder.
 */
window.GPUBitStreamEncoder = class GPUBitStreamEncoder {
    constructor(configValidator, webglManager) {
        const config = configValidator ? configValidator.getConfig() : null;

        // Validate dependencies
        if (!config || !config.SAFE_CHARS) {
            throw new Error('GPUBitStreamEncoder: Valid configuration object with SAFE_CHARS is required.');
        }

        this.config = config;
        this.webglManager = webglManager;

        this.SAFE_CHARS = this.config.SAFE_CHARS;
        this.RADIX = this.SAFE_CHARS.length;

        console.log(`Initializing encoder with ${this.RADIX} characters in safe set.`);

        // Initialize DirectBaseEncoder, which is expected to be globally available
        if (!window.DirectBaseEncoder) {
            throw new Error('DirectBaseEncoder dependency not found. Ensure it is loaded before GPUBitStreamEncoder.');
        }
        this.directEncoder = new window.DirectBaseEncoder(this.SAFE_CHARS);

        // Initialize WebGL using the provided manager for potential future use
        this.initializeWebGLContext();
    }

    /**
     * Initialize WebGL context using the injected WebGLManager.
     * While the primary encoding is CPU-based, this maintains the WebGL
     * context for any potential future GPU-accelerated tasks.
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
     * Main encoding function that delegates to DirectBaseEncoder for optimal performance.
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