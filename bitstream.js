// bitstream.js
window.BitStreamEncoder = class BitStreamEncoder {
    constructor(safeChars) {
        if (!safeChars || typeof safeChars !== 'string' || safeChars.length === 0) {
            throw new Error('Invalid safeChars parameter');
        }

        // Verify character uniqueness
        const uniqueChars = new Set(safeChars);
        if (uniqueChars.size !== safeChars.length) {
            throw new Error('safeChars contains duplicate characters');
        }

        this.SAFE_CHARS = safeChars;
        this.RADIX = new BigUint64Array([safeChars.length])[0];
        
        // Create lookup tables for faster encoding/decoding
        this.charToIndex = new Map(
            [...safeChars].map((char, index) => [char, new BigUint64Array([index])[0]])
        );
        
        this.indexToChar = new Map(
            [...safeChars].map((char, index) => [new BigUint64Array([index])[0], char])
        );

        // Precalculate common values using BigUint64Array
        this.BYTE_MASK = new BigUint64Array([0xFF])[0];
        this.BYTE_BITS = new BigUint64Array([8])[0];
    }

    toBitArray(buffer) {
        if (!(buffer instanceof ArrayBuffer)) {
            throw new Error('Input must be an ArrayBuffer');
        }
        return new Uint8Array(buffer);
    }

    fromBitArray(data) {
        if (!(data instanceof Uint8Array)) {
            throw new Error('Input must be a Uint8Array');
        }
        return data.buffer;
    }

    encodeBits(data) {
        const bytes = this.toBitArray(data);
        console.log('Original data length:', bytes.length);
        
        // Add length prefix (4 bytes) for validation during decode
        const lengthPrefix = new Uint8Array(4);
        const dataView = new DataView(lengthPrefix.buffer);
        dataView.setUint32(0, bytes.length, false); // false = big-endian
        
        // Combine length prefix and data
        const allBytes = new Uint8Array(lengthPrefix.length + bytes.length);
        allBytes.set(lengthPrefix);
        allBytes.set(bytes, lengthPrefix.length);
        
        // Convert to a single large unsigned number using BigUint64Array
        let value = new BigUint64Array([0])[0];
        for (const byte of allBytes) {
            value = (value << this.BYTE_BITS) | new BigUint64Array([byte])[0];
        }
        
        // Convert to custom base using the SAFE_CHARS radix
        const chunks = [];
        do {
            const remainder = value % this.RADIX;
            chunks.unshift(this.indexToChar.get(remainder));
            value = value / this.RADIX; // Integer division maintains unsigned
        } while (value > new BigUint64Array([0])[0]);
        
        const result = chunks.join('');
        console.log('Encoded string length:', result.length);
        return result;
    }

    decodeBits(str) {
        console.log('Decoding string of length:', str.length);

        if (typeof str !== 'string' || str.length === 0) {
            throw new Error('Input must be a non-empty string');
        }

        // Validate input characters
        const invalidChars = [...str].filter(char => !this.charToIndex.has(char));
        if (invalidChars.length > 0) {
            throw new Error(`Invalid characters in input: ${invalidChars.join(', ')}`);
        }

        // Convert from custom base back to a single large number
        let value = new BigUint64Array([0])[0];
        for (const char of str) {
            const digit = this.charToIndex.get(char);
            value = value * this.RADIX + digit;
        }

        // Convert back to bytes using unsigned operations
        const bytes = [];
        while (value > new BigUint64Array([0])[0]) {
            bytes.unshift(Number(value & this.BYTE_MASK));
            value = value >> this.BYTE_BITS; // Unsigned right shift
        }

        // Ensure minimum length for prefix
        while (bytes.length < 4) {
            bytes.unshift(0);
        }

        // Extract and validate length prefix using unsigned operations
        const dataLength = (bytes[0] << 24 >>> 0) | 
                          (bytes[1] << 16 >>> 0) | 
                          (bytes[2] << 8 >>> 0) | 
                          bytes[3];
        
        console.log('Decoded length from prefix:', dataLength);
        console.log('Available data bytes:', bytes.length - 4);
        
        if (dataLength <= 0 || dataLength > (bytes.length - 4)) {
            throw new Error(`Invalid data length: expected ${dataLength} bytes but only have ${bytes.length - 4} bytes`);
        }

        // Return actual data (skip length prefix)
        return new Uint8Array(bytes.slice(4, 4 + dataLength));
    }

    // Utility method to estimate encoded size
    estimateEncodedSize(dataSize) {
        // Calculate bits needed for the data plus length prefix
        const totalBits = (dataSize + 4) * 8;
        // Calculate approximately how many base-N digits needed
        // where N is the length of SAFE_CHARS
        const bitsPerChar = Math.log2(this.SAFE_CHARS.length);
        return Math.ceil(totalBits / bitsPerChar);
    }

    // Utility method to validate if data will fit in URL
    willFitInUrl(dataSize, maxUrlLength) {
        const estimatedSize = this.estimateEncodedSize(dataSize);
        return estimatedSize <= maxUrlLength;
    }
};
