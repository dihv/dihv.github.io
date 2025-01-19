// bitstream.js
window.BitStreamEncoder = class BitStreamEncoder {
    constructor(safeChars) {
        if (!safeChars) {
            throw new Error('SafeChars parameter is required');
        }
        this.SAFE_CHARS = safeChars;
        const bs = window.CONFIG.BITSTREAM;
        this.CHAR_SET_SIZE = bs.CHAR_SET_SIZE;
        this.BITS_PER_CHAR = bs.BITS_PER_CHAR;
        this.CHARS_PER_GROUP = bs.CHARS_PER_GROUP;
        this.MAX_VALUE_PER_CHAR = bs.MAX_VALUE_PER_CHAR;
        
        // this.CHAR_SET_SIZE = safeChars.length;
        // this.BITS_PER_CHAR = Math.floor(Math.log2(this.CHAR_SET_SIZE));
        // //this.CHARS_PER_GROUP = Math.ceil(8 * 3 / this.BITS_PER_CHAR); <old version that worked

        // // Calculate optimal group size based on LCM of BITS_PER_CHAR
        // // This ensures we align properly with byte boundaries
        // this.BITS_PER_GROUP = this.lcm(this.BITS_PER_CHAR, 8);
        // this.CHARS_PER_GROUP = this.BITS_PER_GROUP / this.BITS_PER_CHAR;
        // this.BYTES_PER_GROUP = this.BITS_PER_GROUP / 8;
        
    }

    lcm(a, b) {
        const gcd = (x, y) => !y ? x : gcd(y, x % y);
        return (a * b) / gcd(a, b);
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
        
        // Process all bytes
        let accumulator = 0;
        let bitsInAccumulator = 0;
        
        for (let i = 0; i < allBytes.length; i++) {
            accumulator = (accumulator << 8) | allBytes[i];
            bitsInAccumulator += 8;
            
            while (bitsInAccumulator >= this.BITS_PER_CHAR) {
                bitsInAccumulator -= this.BITS_PER_CHAR;
                const charIndex = (accumulator >> bitsInAccumulator) & ((1 << this.BITS_PER_CHAR) - 1);
                result += this.SAFE_CHARS[charIndex];
            }
        }
        
        // Handle remaining bits if any
        if (bitsInAccumulator > 0) {
            const charIndex = (accumulator << (this.BITS_PER_CHAR - bitsInAccumulator)) & ((1 << this.BITS_PER_CHAR) - 1);
            result += this.SAFE_CHARS[charIndex];
        }
        
        console.log('Encoded string length:', result.length);
        return result;
    }

    decodeBits(str) {
        console.log('Decoding string of length:', str.length);
        
        const output = [];
        let accumulator = 0;
        let bitsInAccumulator = 0;
        
        // Process all characters
        for (let i = 0; i < str.length; i++) {
            const charIndex = this.SAFE_CHARS.indexOf(str[i]);
            if (charIndex === -1) {
                throw new Error('Invalid character in encoded data');
            }
            
            accumulator = (accumulator << this.BITS_PER_CHAR) | charIndex;
            bitsInAccumulator += this.BITS_PER_CHAR;
            
            while (bitsInAccumulator >= 8) {
                bitsInAccumulator -= 8;
                output.push((accumulator >> bitsInAccumulator) & 0xFF);
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
