// bitstream.js

/**
 * BitStreamEncoder handles encoding of binary data to URL-safe strings and back
 * Following Project Technical Approaches (PTAs):
 * PTA_1: Uses safe character set
 * PTA_2: Use a radix system equal to the length of the character set
 * PTA_3: Preserves byte boundaries
 * PTA_4: Constants derived from first principles
 * PTA_5: Uses shared config
 * PTA_6: Uses unsigned operations inluding BigUint64Arrays
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
        const bytes = await Promise.resolve(this.toBitArray(data));
        
        // Add length prefix (4 bytes) for validation during decode
        const lengthPrefix = new Uint8Array(4);
        const dataView = new DataView(lengthPrefix.buffer);
        dataView.setUint32(0, bytes.length, true); // false = big-endian
        
        // Combine length prefix and data
        const allBytes = new Uint8Array(lengthPrefix.length + bytes.length);
        allBytes.set(lengthPrefix);
        allBytes.set(bytes, lengthPrefix.length);
        
        // Process bytes in chunks to avoid BigInt overflow
        const chunkSize = window.CONFIG.CHUNK_SIZE; // Process 6 bytes at a time
        const chunks = [];
        
        for (let i = 0; i < allBytes.length; i += chunkSize) {
            let value = 0n;
            const end = Math.min(i + chunkSize, allBytes.length);
            
            for (let j = i; j < end; j++) {
                value = (value << 8n) | BigInt(allBytes[j]);
            }
            
            // Convert chunk to base-N
            if (value === 0n) {
                chunks.push(this.SAFE_CHARS[0]);
            } else {
                const chunkChars = [];
                while (value > 0n) {
                    const remainder = value % this.RADIX;
                    chunkChars.unshift(this.SAFE_CHARS[Number(remainder)]);
                    value = value / this.RADIX;
                }
                chunks.push(chunkChars.join(''));
            }
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

        // Process string in chunks to avoid BigInt overflow
        const chunkSize = window.CONFIG.CHUNK_SIZE; // Process 8 characters at a time
        const bytes = [];
        
        for (let i = 0; i < str.length; i += chunkSize) {
            let value = 0n;
            const chunk = str.slice(i, i + chunkSize);
            
            // Convert chunk from base-N
            for (const char of chunk) {
                value = value * this.RADIX + this.charToIndex.get(char);
            }
            
            // Convert to bytes
            while (value > 0n) {
                bytes.unshift(Number(value & 0xFFn));
                value = value >> 8n;
            }
        }

        // Add padding bytes if needed for length prefix
        while (bytes.length < 4) {
            bytes.unshift(0);
        }

        // Extract and validate length using DataView for consistency with encoder
        const lengthBuffer = new ArrayBuffer(4);
        const lengthArray = new Uint8Array(lengthBuffer);
        lengthArray.set(bytes.slice(0, 4));
        const lengthView = new DataView(lengthBuffer);
        const expectedLength = lengthView.getUint32(0, true); // false = big-endian
        
        if (expectedLength <= 0) {
            throw new Error('Invalid length prefix: length must be greater than 0');
        }
        
        // Ensure we have enough bytes for the data
        const dataBytes = bytes.slice(4);
        if (dataBytes.length < expectedLength) {
            throw new Error(`Incomplete data: expected ${expectedLength} bytes but got ${dataBytes.length}`);
        }

        // Return actual data (correct number of bytes)
        return new Uint8Array(dataBytes.slice(0, expectedLength));
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
