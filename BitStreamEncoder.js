/**
 * What: BitStream Encoder
 * How: This component acts as a wrapper, delegating the core encoding logic
 * to the highly optimized DirectBaseEncoder. This simplifies the high-level API
 * while leveraging the efficient CPU-based implementation.
 *
 * Key Features:
 * - Decoupled from global objects, receives dependencies via constructor.
 * - Integrates with the new centralized ConfigValidator.
 * - Correctly delegates encoding to DirectBaseEncoder.
 */
window.BitStreamEncoder = class BitStreamEncoder {
    constructor(configValidator) {
        const config = configValidator ? configValidator.getConfig() : null;

        // Validate dependencies
        if (!config || !config.SAFE_CHARS) {
            throw new Error('BitStreamEncoder: Valid configuration object with SAFE_CHARS is required.');
        }

        this.config = config;
        this.SAFE_CHARS = this.config.SAFE_CHARS;
        this.RADIX = this.SAFE_CHARS.length;

        console.log(`Initializing encoder with ${this.RADIX} characters in safe set.`);

        // Initialize DirectBaseEncoder, which is expected to be loaded
        if (!window.DirectBaseEncoder) {
            throw new Error('DirectBaseEncoder dependency not found. Ensure it is loaded before BitStreamEncoder.');
        }
        this.directEncoder = new window.DirectBaseEncoder(this.SAFE_CHARS);
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
     * Cleans up resources.
     */
    cleanup() {
        this.directEncoder = null;
        console.log('BitStreamEncoder cleaned up.');
    }
};
