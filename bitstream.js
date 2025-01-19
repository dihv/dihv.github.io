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
        // Input validation
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
        // We use a typed array to ensure unsigned 64-bit operations
        const radixArray = new BigUint64Array(1);
        radixArray[0] = BigInt(safeChars.length); // Convert length to BigInt first
        this.RADIX = radixArray[0];
        
        // Create lookup tables for faster encoding/decoding (PTA_4)
        this.charToIndex = new Map();
        this.indexToChar = new Map();
        
        // Initialize lookup tables with BigUint64Array values
        for (let i = 0; i < safeChars.length; i++) {
            const indexArray = new BigUint64Array(1);
            indexArray[0] = BigInt(i);
            this.charToIndex.set(safeChars[i], indexArray[0]);
            this.indexToChar.set(indexArray[0], safeChars[i]);
        }

        // Precalculate common values using BigUint64Array (PTA_6)
        const byteArray = new BigUint64Array(1);
        byteArray[0] = BigInt(0xFF);
        this.BYTE_MASK = byteArray[0];
        
        const bitArray = new BigUint64Array(1);
        bitArray[0] = BigInt(8);
        this.BYTE_BITS = bitArray[0];
    }

    // Convert ArrayBuffer to Uint8Array (PTA_2)
    toBitArray(buffer) {
        if (!(buffer instanceof ArrayBuffer)) {
            throw new Error('Input must be an ArrayBuffer');
        }
        return new Uint8Array(buffer);
    }

    // Convert Uint8Array back to ArrayBuffer (PTA_2)
    fromBitArray(data) {
        if (!(data instanceof Uint8Array)) {
            throw new Error('Input must be a Uint8Array');
        }
        return data.buffer;
    }

    // Encode binary data to string (PTA_3)
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
        let valueArray = new BigUint64Array(1);
        valueArray[0] = BigInt(0);
        
        // Process each byte maintaining unsigned property (PTA_6)
        for (const byte of allBytes) {
            valueArray[0] = (valueArray[0] << this.BYTE_BITS) | BigInt(byte);
        }
        
        // Convert to custom base using the SAFE_CHARS radix
        const chunks = [];
        const zeroArray = new BigUint64Array(1);
        zeroArray[0] = BigInt(0);
        
        do {
            const remainder = Number(valueArray[0] % this.RADIX); // Safe conversion as remainder < RADIX
            chunks.unshift(this.SAFE_CHARS[remainder]);
            valueArray[0] = valueArray[0] / this.RADIX; // Integer division maintains unsigned
        } while (valueArray[0] > zeroArray[0]);
        
        const result = chunks.join('');
        console.log('Encoded string length:', result.length);
        return result;
    }

    // Decode string back to binary data (PTA_3)
    decodeBits(str) {
        console.log('Decoding string of length:', str.length);

        if (typeof str !== 'string' || str.length === 0) {
            throw new Error('Input must be a non-empty string');
        }

        // Validate input characters (PTA_1)
        const invalidChars = [...str].filter(char => !this.charToIndex.has(char));
        if (invalidChars.length > 0) {
            throw new Error(`Invalid characters in input: ${invalidChars.join(', ')}`);
        }

        // Convert from custom base back to a single large number
        let valueArray = new BigUint64Array(1);
        valueArray[0] = BigInt(0);
        
        for (const char of str) {
            const digit = this.charToIndex.get(char);
            valueArray[0] = valueArray[0] * this.RADIX + digit;
        }

        // Convert back to bytes using unsigned operations
        const bytes = [];
        const zeroArray = new BigUint64Array(1);
        zeroArray[0] = BigInt(0);
        
        while (valueArray[0] > zeroArray[0]) {
            bytes.unshift(Number(valueArray[0] & this.BYTE_MASK));
            valueArray[0] = valueArray[0] >> this.BYTE_BITS; // Unsigned right shift
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

    // Helper method to estimate encoded size (PTA_4)
    estimateEncodedSize(dataSize) {
        // Calculate bits needed for the data plus length prefix
        const totalBits = (dataSize + 4) * 8;
        // Calculate approximately how many base-N digits needed
        // where N is the length of SAFE_CHARS
        const bitsPerChar = Math.log2(this.SAFE_CHARS.length);
        return Math.ceil(totalBits / bitsPerChar);
    }

    // Helper method to validate if data will fit in URL
    willFitInUrl(dataSize, maxUrlLength) {
        const estimatedSize = this.estimateEncodedSize(dataSize);
        return estimatedSize <= maxUrlLength;
    }
};
