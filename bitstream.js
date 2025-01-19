// bitstream.js
window.BitStreamEncoder = class BitStreamEncoder {
    constructor(safeChars) {
        if (!safeChars) {
            throw new Error('SafeChars parameter is required');
        }
        this.SAFE_CHARS = safeChars;
        this.RADIX = BigUint64Array.from([safeChars.length])[0]; // Ensure unsigned
        
        // Create lookup table for faster encoding
        this.charToIndex = new Map(
            [...safeChars].map((char, index) => [char, BigUint64Array.from([index])[0]])
        );
    }

    toBitArray(buffer) {
        return new Uint8Array(buffer);
    }

    fromBitArray(data) {
        return data.buffer;
    }

    encodeBits(data) {
        const bytes = new Uint8Array(data);
        console.log('Original data length:', bytes.length);
        
        // Add length prefix (4 bytes) - encode length as 32-bit big-endian
        const lengthPrefix = new Uint8Array(4);
        const dataView = new DataView(lengthPrefix.buffer);
        dataView.setUint32(0, bytes.length, false); // false = big-endian
        
        // Combine length prefix and data
        const allBytes = new Uint8Array(lengthPrefix.length + bytes.length);
        allBytes.set(lengthPrefix);
        allBytes.set(bytes, lengthPrefix.length);
        
        // Convert bytes to a single large unsigned number
        let value = 0n;
        for (const byte of allBytes) {
            // Use unsigned right shift and bitwise OR
            value = (value << 8n) | BigInt(byte);
        }
        
        // Convert to our custom radix using unsigned operations
        let result = '';
        
        do {
            const remainder = Number(value % this.RADIX); // Safe since RADIX < Number.MAX_SAFE_INTEGER
            result = this.SAFE_CHARS[remainder] + result;
            value = value / this.RADIX; // Integer division maintains unsigned
        } while (value > 0n);
        
        console.log('Encoded string length:', result.length);
        return result;
    }

    decodeBits(str) {
        console.log('Decoding string of length:', str.length);
        
        // Convert from our custom radix to a single large unsigned number
        let value = 0n;
        
        for (const char of str) {
            const digit = this.charToIndex.get(char);
            if (digit === undefined) {
                throw new Error('Invalid character in encoded data');
            }
            value = value * this.RADIX + digit;
        }
        
        // Convert back to bytes using unsigned operations
        const bytes = [];
        const BYTE_MASK = 0xFFn;
        
        while (value > 0n) {
            bytes.unshift(Number(value & BYTE_MASK));
            value = value >> 8n; // Unsigned right shift
        }
        
        // Ensure we have at least 4 bytes for the length prefix
        while (bytes.length < 4) {
            bytes.unshift(0);
        }
        
        // Read length prefix using unsigned operations
        const dataLength = (bytes[0] << 24 >>> 0) | 
                          (bytes[1] << 16 >>> 0) | 
                          (bytes[2] << 8 >>> 0) | 
                          bytes[3];
        
        console.log('Decoded length from prefix:', dataLength);
        console.log('Available data bytes:', bytes.length - 4);
        
        // Validate length
        if (dataLength <= 0 || dataLength > (bytes.length - 4)) {
            throw new Error(`Invalid data length: expected ${dataLength} bytes but only have ${bytes.length - 4} bytes`);
        }
        
        // Return actual data (skip length prefix)
        return new Uint8Array(bytes.slice(4, 4 + dataLength));
    }
};
