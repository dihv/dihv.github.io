// bitstream.js
window.BitStreamEncoder = class BitStreamEncoder {
    constructor(safeChars) {
        if (!safeChars) {
            throw new Error('SafeChars parameter is required');
        }
        this.SAFE_CHARS = safeChars;
        
        // Get derived constants from config
        const bs = window.CONFIG.BITSTREAM;
        this.CHAR_SET_SIZE = bs.CHAR_SET_SIZE;
        this.BITS_PER_CHAR = bs.BITS_PER_CHAR;
        this.BITS_PER_GROUP = bs.BITS_PER_GROUP;
        this.CHARS_PER_GROUP = bs.CHARS_PER_GROUP;
        this.BYTES_PER_GROUP = bs.BYTES_PER_GROUP;
        this.MAX_VALUE_PER_CHAR = bs.MAX_VALUE_PER_CHAR;
        
        // Verify our constants at runtime
        this.validateConstants();
    }

    validateConstants() {
        // Ensure our character set size matches our bit capacity
        if (this.CHAR_SET_SIZE > (1 << this.BITS_PER_CHAR)) {
            throw new Error('Character set size exceeds bit capacity');
        }
        
        // Verify group alignments
        if (this.BITS_PER_GROUP % 8 !== 0) {
            throw new Error('Bit groups must align with byte boundaries');
        }
        
        if (this.BITS_PER_GROUP % this.BITS_PER_CHAR !== 0) {
            throw new Error('Bit groups must align with character boundaries');
        }
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
        let result = '';
        
        // Add length prefix (4 bytes) - encode length as 32-bit big-endian
        const lengthPrefix = new Uint8Array(4);
        const dataView = new DataView(lengthPrefix.buffer);
        dataView.setUint32(0, bytes.length, false); // false = big-endian
        
        // Combine length prefix and data
        const allBytes = new Uint8Array(lengthPrefix.length + bytes.length);
        allBytes.set(lengthPrefix);
        allBytes.set(bytes, lengthPrefix.length);
        
        // Process bytes in optimal groups
        let accumulator = 0n;  // Use BigInt for larger group sizes
        let bitsInAccumulator = 0;
        
        for (let i = 0; i < allBytes.length; i++) {
            accumulator = (accumulator << 8n) | BigInt(allBytes[i]);
            bitsInAccumulator += 8;
            
            // Process complete groups when possible
            while (bitsInAccumulator >= this.BITS_PER_CHAR) {
                bitsInAccumulator -= this.BITS_PER_CHAR;
                const charIndex = Number((accumulator >> BigInt(bitsInAccumulator)) & BigInt(this.MAX_VALUE_PER_CHAR));
                result += this.SAFE_CHARS[charIndex];
            }
        }
        
        // Handle remaining bits if any
        if (bitsInAccumulator > 0) {
            const charIndex = Number((accumulator << BigInt(this.BITS_PER_CHAR - bitsInAccumulator)) & BigInt(this.MAX_VALUE_PER_CHAR));
            result += this.SAFE_CHARS[charIndex];
        }
        
        console.log('Encoded string length:', result.length);
        return result;
    }

    decodeBits(str) {
        console.log('Decoding string of length:', str.length);
        
        const output = [];
        let accumulator = 0n;  // Use BigInt for larger group sizes
        let bitsInAccumulator = 0;
        
        // Process all characters
        for (let i = 0; i < str.length; i++) {
            const charIndex = this.SAFE_CHARS.indexOf(str[i]);
            if (charIndex === -1) {
                throw new Error('Invalid character in encoded data');
            }
            
            accumulator = (accumulator << BigInt(this.BITS_PER_CHAR)) | BigInt(charIndex);
            bitsInAccumulator += this.BITS_PER_CHAR;
            
            // Extract complete bytes when possible
            while (bitsInAccumulator >= 8) {
                bitsInAccumulator -= 8;
                output.push(Number((accumulator >> BigInt(bitsInAccumulator)) & 0xFFn));
            }
        }
        
        if (output.length < 4) {
            throw new Error('Data too short to contain length prefix');
        }
        
        // Read length prefix
        const dataLength = (output[0] << 24) | (output[1] << 16) | (output[2] << 8) | output[3];
        console.log('Decoded length from prefix:', dataLength);
        console.log('Available data bytes:', output.length - 4);
        
        // Validate length
        if (dataLength <= 0 || dataLength > (output.length - 4)) {
            throw new Error(`Invalid data length: expected ${dataLength} bytes but only have ${output.length - 4} bytes`);
        }
        
        // Return actual data (skip length prefix)
        return new Uint8Array(output.slice(4, 4 + dataLength));
    }
}
