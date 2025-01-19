// bitstream.js

/**
 * BitStreamEncoder handles encoding of binary data to URL-safe strings and back
 * Following Project Technical Approaches (PTAs):
 * PTA_1: Uses safe character set
 * PTA_2: Use a radix system equal to the length of the character set
 * PTA_3: Preserves byte boundaries
 * PTA_4: Constants derived from first principles
 * PTA_5: Uses shared config
 * PTA_6: Uses unsigned operations via BigUint64Array
 */
window.BitStreamEncoder = class BitStreamEncoder {
    constructor(safeChars) {
        if (!safeChars || typeof safeChars !== 'string' || safeChars.length === 0) {
            throw new Error('Invalid safeChars parameter');
        }

        // Verify character uniqueness (PTA_1)
        const uniqueChars = new Set(safeChars);
        if (uniqueChars.size !== safeChars.length) {
            throw new Error('safeChars contains duplicate characters');
        }

        this.SAFE_CHARS = safeChars;
        
        // Create BigUint64Array with single element for RADIX (PTA_6)
        this.RADIX = BigInt(safeChars.length);
        
        // Create lookup tables for faster encoding/decoding (PTA_4)
        this.charToIndex = new Map();
        this.indexToChar = new Map();
        
        for (let i = 0; i < safeChars.length; i++) {
            this.charToIndex.set(safeChars[i], BigInt(i));
            this.indexToChar.set(BigInt(i), safeChars[i]);
        }
    }

    // Convert any binary data to Uint8Array (PTA_2)
    toBitArray(data) {
        if (data instanceof ArrayBuffer) {
            return new Uint8Array(data);
        } else if (data instanceof Uint8Array) {
            return data;
        } else if (data instanceof Blob) {
            // Handle Blob input by converting to ArrayBuffer first
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(new Uint8Array(reader.result));
                reader.onerror = reject;
                reader.readAsArrayBuffer(data);
            });
        }
        throw new Error('Input must be an ArrayBuffer, Uint8Array, or Blob');
    }

    // Encode binary data to string (PTA_3)
    async encodeBits(data) {
        // Handle both synchronous and asynchronous toBitArray results
        const bytes = await (data instanceof Promise ? data : this.toBitArray(data));
        
        // Add length prefix (4 bytes) for validation during decode
        const lengthPrefix = new Uint8Array(4);
        const dataView = new DataView(lengthPrefix.buffer);
        dataView.setUint32(0, bytes.length, false); // false = big-endian
        
        // Combine length prefix and data
        const allBytes = new Uint8Array(lengthPrefix.length + bytes.length);
        allBytes.set(lengthPrefix);
        allBytes.set(bytes, lengthPrefix.length);
        
        // Convert to base-N using safe characters (PTA_2)
        let value = 0n;
        for (const byte of allBytes) {
            value = (value << 8n) | BigInt(byte);
        }
        
        // Convert to custom base using the SAFE_CHARS radix
        const chunks = [];
        while (value > 0n) {
            const remainder = value % this.RADIX;
            chunks.unshift(this.SAFE_CHARS[Number(remainder)]);
            value = value / this.RADIX;
        }
        
        return chunks.join('');
    }

    // Decode string back to binary data (PTA_3)
    decodeBits(str) {
        if (typeof str !== 'string' || str.length === 0) {
            throw new Error('Input must be a non-empty string');
        }

        // Validate input characters (PTA_1)
        const invalidChars = [...str].filter(char => !this.charToIndex.has(char));
        if (invalidChars.length > 0) {
            throw new Error(`Invalid characters in input: ${invalidChars.join(', ')}`);
        }

        // Convert from base-N back to binary (PTA_2)
        let value = 0n;
        for (const char of str) {
            value = value * this.RADIX + this.charToIndex.get(char);
        }
        
        // Convert back to bytes
        const bytes = [];
        while (value > 0n) {
            bytes.unshift(Number(value & 0xFFn));
            value = value >> 8n;
        }

        // Add padding bytes if needed for length prefix
        while (bytes.length < 4) {
            bytes.unshift(0);
        }

        // Extract and validate length
        const expectedLength = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
        const actualDataLength = bytes.length - 4;
        
        if (expectedLength <= 0 || expectedLength > actualDataLength) {
            throw new Error(`Invalid data length: expected ${expectedLength} bytes but have ${actualDataLength}`);
        }

        // Return actual data (skip length prefix)
        return new Uint8Array(bytes.slice(4, 4 + expectedLength));
    }

    // Helper method to estimate encoded size (PTA_4)
    estimateEncodedSize(dataSize) {
        // Calculate bits needed for the data plus length prefix
        const totalBits = (dataSize + 4) * 8;
        // Calculate approximately how many base-N digits needed
        const bitsPerChar = Math.log2(Number(this.RADIX));
        return Math.ceil(totalBits / bitsPerChar);
    }

    // Helper method to validate if data will fit in URL
    willFitInUrl(dataSize, maxUrlLength) {
        const estimatedSize = this.estimateEncodedSize(dataSize);
        return estimatedSize <= maxUrlLength;
    }
};
