/**
 * Direct Base Conversion Encoder
 * 
 * Uses a sliding window approach to convert binary data directly to base-N
 * without byte boundary issues, avoiding repetitive patterns.
 */
class DirectBaseEncoder {
    constructor(safeChars) {
        // Validate input
        if (!safeChars || typeof safeChars !== 'string' || safeChars.length === 0) {
            throw new Error('DirectBaseEncoder: Invalid safeChars parameter - must be a non-empty string');
        }
        
        // Check for duplicate characters
        const uniqueChars = new Set(safeChars);
        if (uniqueChars.size !== safeChars.length) {
            throw new Error('DirectBaseEncoder: safeChars contains duplicate characters');
        }
        
        this.SAFE_CHARS = safeChars;
        this.RADIX = safeChars.length;
        
        // Create lookup tables for performance
        this.charToIndex = new Map();
        this.indexToChar = new Map();
        for (let i = 0; i < safeChars.length; i++) {
            this.charToIndex.set(safeChars[i], i);
            this.indexToChar.set(i, safeChars[i]);
        }
        
        // Calculate optimal encoding parameters
        this.BITS_PER_CHAR = Math.log2(this.RADIX);
        this.CHARS_PER_CHUNK = Math.floor(64 / this.BITS_PER_CHAR); // Fit in 64-bit integers
        this.BYTES_PER_CHUNK = Math.floor(this.CHARS_PER_CHUNK * this.BITS_PER_CHAR / 8);
        
        // Get threshold from config with fallback
        this.SMALL_DATA_THRESHOLD = (window.CONFIG?.ENCODE_SMALL_THRESHOLD) || 64;
        
        // Pre-calculate powers for performance
        this.powers = [];
        for (let i = 0; i < this.CHARS_PER_CHUNK; i++) {
            this.powers[i] = Math.pow(this.RADIX, i);
        }
        
        console.log(`DirectBaseEncoder: ${this.RADIX} chars, ${this.BITS_PER_CHAR.toFixed(2)} bits/char, threshold=${this.SMALL_DATA_THRESHOLD}`);
    }
    
    /**
     * Enhanced encoding with adaptive strategy based on data size
     */
    encode(data) {
        try {
            const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
            
            if (bytes.length === 0) {
                throw new Error('DirectBaseEncoder: Empty input data');
            }
            
            // Adaptive encoding strategy
            if (bytes.length <= this.SMALL_DATA_THRESHOLD) {
                return this.encodeSmallOptimized(bytes);
            } else {
                return this.encodeLargeOptimized(bytes);
            }
        } catch (error) {
            console.error('DirectBaseEncoder encode error:', error);
            throw new Error(`DirectBaseEncoder encoding failed: ${error.message}`);
        }
    }
    
    /**
     * Optimized small data encoding with minimal overhead
     */
    encodeSmallOptimized(bytes) {
        try {
            // Use BigInt for accurate large number handling
            let value = 0n;
            for (let i = 0; i < bytes.length; i++) {
                value = (value << 8n) | BigInt(bytes[i]);
            }
            
            // Convert to base-N efficiently
            const digits = [];
            const radixBig = BigInt(this.RADIX);
            
            while (value > 0n) {
                const remainder = Number(value % radixBig);
                const char = this.indexToChar.get(remainder);
                if (!char) {
                    throw new Error(`Invalid remainder ${remainder} for radix ${this.RADIX}`);
                }
                digits.push(char);
                value = value / radixBig;
            }
            
            // Add compact metadata: length (variable encoding) + checksum
            const lengthEncoded = this.encodeVariableLength(bytes.length);
            const checksum = this.calculateChecksum(bytes);
            const checksumChar = this.indexToChar.get(checksum);
            
            if (!checksumChar) {
                throw new Error('Failed to encode checksum');
            }
            
            // Format: [length][checksum][data]
            return lengthEncoded + checksumChar + digits.reverse().join('');
        } catch (error) {
            throw new Error(`Small data encoding failed: ${error.message}`);
        }
    }
    
    /**
     * Optimized large data encoding with chunked processing
     */
    encodeLargeOptimized(bytes) {
        try {
            const encoded = [];
            const chunkSize = this.BYTES_PER_CHUNK;
            
            // Process data in optimal chunks
            for (let offset = 0; offset < bytes.length; offset += chunkSize) {
                const chunkEnd = Math.min(offset + chunkSize, bytes.length);
                const chunk = bytes.slice(offset, chunkEnd);
                
                // Add position-based entropy (improved mixing)
                const mixed = this.mixWithEntropy(chunk, offset);
                
                // Encode chunk efficiently
                const chunkEncoded = this.encodeChunk(mixed);
                encoded.push(chunkEncoded);
            }
            
            // Add comprehensive metadata
            const metadata = this.encodeMetadataOptimized(bytes.length, this.calculateChecksum(bytes));
            
            return metadata + encoded.join('');
        } catch (error) {
            throw new Error(`Large data encoding failed: ${error.message}`);
        }
    }
    
    /**
     * Variable-length encoding for integers
     */
    encodeVariableLength(value) {
        const digits = [];
        let remaining = value;
        
        // Use all but the last character for data, last character as terminator
        const dataRadix = this.RADIX - 1;
        const terminator = this.indexToChar.get(this.RADIX - 1);
        
        while (remaining >= dataRadix) {
            digits.push(this.indexToChar.get(remaining % dataRadix));
            remaining = Math.floor(remaining / dataRadix);
        }
        
        // Final digit + terminator
        digits.push(this.indexToChar.get(remaining));
        digits.push(terminator);
        
        return digits.join('');
    }
    
    /**
     * Improved entropy mixing with better distribution
     */
    mixWithEntropy(chunk, position) {
        const mixed = new Uint8Array(chunk.length);
        
        // Use multiple hash functions for better mixing
        const hash1 = this.hashPosition(position);
        const hash2 = this.hashPosition(position + 1) ^ 0xAAAAAAAA;
        
        for (let i = 0; i < chunk.length; i++) {
            // Combine multiple entropy sources
            const entropy = (hash1 >> (i % 4) * 8) ^ (hash2 >> ((i + 2) % 4) * 8);
            mixed[i] = chunk[i] ^ (entropy & 0xFF);
        }
        
        return mixed;
    }
    
    /**
     * Enhanced position hashing with better distribution
     */
    hashPosition(pos) {
        // Use MurmurHash-inspired mixing
        let hash = pos * 0x9E3779B9; // Golden ratio constant
        hash = (hash ^ (hash >> 16)) * 0x85EBCA6B;
        hash = (hash ^ (hash >> 13)) * 0xC2B2AE35;
        hash = hash ^ (hash >> 16);
        
        // Additional mixing for better avalanche effect
        hash ^= hash << 13;
        hash ^= hash >> 17;
        hash ^= hash << 5;
        
        return hash >>> 0; // Ensure positive 32-bit integer
    }
    
    /**
     * Optimized chunk encoding
     */
    encodeChunk(chunk) {
        try {
            // Convert chunk to large integer
            let value = 0n;
            for (let i = 0; i < chunk.length; i++) {
                value = (value << 8n) | BigInt(chunk[i]);
            }
            
            // Calculate required output length for this chunk
            const bitsUsed = chunk.length * 8;
            const charsNeeded = Math.ceil(bitsUsed / this.BITS_PER_CHAR);
            
            // Convert to base-N with exact length
            const digits = [];
            const radixBig = BigInt(this.RADIX);
            
            for (let i = 0; i < charsNeeded; i++) {
                const remainder = Number(value % radixBig);
                const char = this.indexToChar.get(remainder);
                if (!char) {
                    throw new Error(`Invalid remainder ${remainder} for radix ${this.RADIX}`);
                }
                digits.push(char);
                value = value / radixBig;
            }
            
            return digits.join('');
        } catch (error) {
            throw new Error(`Chunk encoding failed: ${error.message}`);
        }
    }
    
    /**
     * Optimized metadata encoding with compression
     */
    encodeMetadataOptimized(length, checksum) {
        try {
            // Variable-length encode the length
            const lengthEncoded = this.encodeVariableLength(length);
            
            // Add format version for future compatibility
            const version = this.indexToChar.get(1); // Version 1
            
            // Add checksum
            const checksumChar = this.indexToChar.get(checksum);
            if (!checksumChar) {
                throw new Error('Failed to encode checksum');
            }
            
            // Format: [version][length][checksum]
            return version + lengthEncoded + checksumChar;
        } catch (error) {
            throw new Error(`Metadata encoding failed: ${error.message}`);
        }
    }
    
    /**
     * Improved checksum calculation with better distribution
     */
    calculateChecksum(bytes) {
        let checksum = 0;
        let multiplier = 1;
        
        for (let i = 0; i < bytes.length; i++) {
            // Use varying multipliers for better hash distribution
            checksum = (checksum + bytes[i] * multiplier) % this.RADIX;
            multiplier = (multiplier * 31) % this.RADIX;
        }
        
        return checksum;
    }
    
    /**
     * Estimate encoding efficiency
     */
    getEfficiencyStats(dataSize) {
        const bitsPerChar = this.BITS_PER_CHAR;
        const overhead = dataSize <= this.SMALL_DATA_THRESHOLD ? 3 : 5; // Estimated overhead chars
        const dataBits = dataSize * 8;
        const encodedChars = Math.ceil(dataBits / bitsPerChar) + overhead;
        
        return {
            inputBytes: dataSize,
            outputChars: encodedChars,
            efficiency: dataBits / (encodedChars * bitsPerChar),
            bitsPerChar: bitsPerChar,
            compressionRatio: encodedChars / dataSize
        };
    }
}

// Enhanced global registration with validation
if (typeof window !== 'undefined') {
    window.DirectBaseEncoder = DirectBaseEncoder;
    
    // Validate the encoder works with current config
    if (window.CONFIG && window.CONFIG.SAFE_CHARS) {
        try {
            const testEncoder = new DirectBaseEncoder(window.CONFIG.SAFE_CHARS);
            const testData = new Uint8Array([1, 2, 3, 4, 5]);
            const encoded = testEncoder.encode(testData);
            console.log(`DirectBaseEncoder validation: encoded ${testData.length} bytes to ${encoded.length} chars`);
        } catch (error) {
            console.error('DirectBaseEncoder validation failed:', error);
        }
    }
    
    console.log('Enhanced DirectBaseEncoder registered globally');
} else {
    console.error('DirectBaseEncoder: window object not available');
}

// Module export support
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DirectBaseEncoder;
}
