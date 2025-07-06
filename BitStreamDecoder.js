/**
 * What: BitStream Decoder
 * How: This component acts as a wrapper, delegating the core decoding logic
 * to the highly optimized DirectBaseEncoder. This is used by the image viewer
 * to decode data from the URL.
 *
 * Key Features:
 * - Decoupled from global objects.
 * - Uses the shared SAFE_CHARS from the config.
 * - Correctly delegates decoding to DirectBaseEncoder.
 */
window.BitStreamDecoder = class BitStreamDecoder {
    constructor(safeChars) {
        // Validate dependencies
        if (!safeChars) {
            throw new Error('BitStreamDecoder: SAFE_CHARS string is required.');
        }

        this.SAFE_CHARS = safeChars;
        this.RADIX = this.SAFE_CHARS.length;

        console.log(`Initializing decoder with ${this.RADIX} characters in safe set.`);

        // Initialize DirectBaseEncoder, which is expected to be loaded
        if (!window.DirectBaseEncoder) {
            throw new Error('DirectBaseEncoder dependency not found. Ensure it is loaded before BitStreamDecoder.');
        }
        this.directEncoder = new window.DirectBaseEncoder(this.SAFE_CHARS);
    }

    /**
     * Main decoding function that delegates to DirectBaseEncoder.
     * @param {string} encodedData - URL-safe encoded string.
     * @returns {Promise<ArrayBuffer>} - Decoded binary data.
     */
    async decodeBits(encodedData) {
        if (typeof encodedData !== 'string') {
            throw new Error('Input data must be a string for decoding.');
        }

        if (encodedData.length === 0) {
            return new ArrayBuffer(0);
        }

        try {
            // The core logic is delegated to the highly optimized DirectBaseEncoder.
            const uint8Array = this.directEncoder.decode(encodedData);
            return uint8Array.buffer;
        } catch (error) {
            console.error('DirectBaseEncoder error during decodeBits:', error);
            throw new Error(`Decoding failed: ${error.message}`);
        }
    }

    /**
     * Cleans up resources.
     */
    cleanup() {
        this.directEncoder = null;
        console.log('BitStreamDecoder cleaned up.');
    }
};
