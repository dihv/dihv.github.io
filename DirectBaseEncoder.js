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
        
        // Create lookup tables
        this.charToIndex = new Map();
        this.indexToChar = new Map();
        for (let i = 0; i < safeChars.length; i++) {
            this.charToIndex.set(safeChars[i], i);
            this.indexToChar.set(i, safeChars[i]);
        }
        
        // Calculate optimal chunk size based on radix
        // We want chunks that fit in JavaScript's safe integer range
        this.BITS_PER_CHUNK = Math.floor(53 / Math.log2(this.RADIX)) * Math.floor(Math.log2(this.RADIX));
        this.BYTES_PER_CHUNK = Math.floor(this.BITS_PER_CHUNK / 8);
        
        // Small data threshold from config
        this.SMALL_DATA_THRESHOLD = window.CONFIG?.ENCODE_SMALL_THRESHOLD || 32;
        
        console.log(`DirectBaseEncoder initialized: radix=${this.RADIX}, threshold=${this.SMALL_DATA_THRESHOLD}`);
    }
    
    /**
     * Encode data using sliding window approach
     */
    encode(data) {
        try {
            const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
            
            if (bytes.length === 0) {
                throw new Error('DirectBaseEncoder: Empty input data');
            }
            
            // For small data, use simple encoding
            if (bytes.length <= this.SMALL_DATA_THRESHOLD) {
                return this.encodeSmall(bytes);
            }
            
            // Use sliding window approach for larger data
            return this.encodeLarge(bytes);
        } catch (error) {
            console.error('DirectBaseEncoder encode error:', error);
            throw new Error(`DirectBaseEncoder encoding failed: ${error.message}`);
        }
    }
    
    /**
     * Simple encoding for small data
     */
    encodeSmall(bytes) {
        try {
            // Convert bytes to a single number
            let value = 0n;
            for (let i = bytes.length - 1; i >= 0; i--) {
                value = (value << 8n) | BigInt(bytes[i]);
            }
            
            // Convert to base-N
            const digits = [];
            while (value > 0n) {
                const remainder = Number(value % BigInt(this.RADIX));
                const char = this.indexToChar.get(remainder);
                if (!char) {
                    throw new Error(`Invalid index ${remainder} for radix ${this.RADIX}`);
                }
                digits.push(char);
                value = value / BigInt(this.RADIX);
            }
            
            // Add simple metadata: length + checksum
            const lengthChar = this.indexToChar.get(bytes.length);
            const checksumChar = this.indexToChar.get(this.calculateChecksum(bytes));
            
            if (!lengthChar || !checksumChar) {
                throw new Error('Failed to encode metadata for small data');
            }
            
            return lengthChar + checksumChar + digits.join('');
        } catch (error) {
            throw new Error(`Small data encoding failed: ${error.message}`);
        }
    }
    
    /**
     * Encode large data using sliding window
     */
    encodeLarge(bytes) {
        try {
            const encoded = [];
            const overlap = 1; // Bytes of overlap between windows to avoid patterns
            
            // Process data in overlapping windows
            for (let offset = 0; offset < bytes.length; offset += this.BYTES_PER_CHUNK - overlap) {
                const windowEnd = Math.min(offset + this.BYTES_PER_CHUNK, bytes.length);
                const window = bytes.slice(offset, windowEnd);
                
                // Add entropy based on position to avoid patterns
                const mixed = this.mixWithPosition(window, offset);
                
                // Encode this window
                const windowEncoded = this.encodeWindow(mixed);
                encoded.push(windowEncoded);
            }
            
            // Add metadata using variable-length encoding
            const metadata = this.encodeMetadata(bytes.length, this.calculateChecksum(bytes));
            
            return metadata + encoded.join('');
        } catch (error) {
            throw new Error(`Large data encoding failed: ${error.message}`);
        }
    }
    
    /**
     * Mix bytes with position to add entropy
     */
    mixWithPosition(window, position) {
        const mixed = new Uint8Array(window.length);
        const positionHash = this.hashPosition(position);
        
        for (let i = 0; i < window.length; i++) {
            // Simple mixing function that's reversible
            mixed[i] = window[i] ^ ((positionHash >> (i % 4) * 8) & 0xFF);
        }
        
        return mixed;
    }
    
    /**
     * Hash position to get mixing value
     */
    hashPosition(pos) {
        // Simple hash function
        let hash = pos * 0x9E3779B9; // Golden ratio
        hash = (hash ^ (hash >> 16)) * 0x85EBCA6B;
        hash = (hash ^ (hash >> 13)) * 0xC2B2AE35;
        return (hash ^ (hash >> 16)) >>> 0;
    }
    
    /**
     * Encode a single window of data
     */
    encodeWindow(window) {
        try {
            // Build value from window bytes
            let value = 0n;
            for (let i = window.length - 1; i >= 0; i--) {
                value = (value << 8n) | BigInt(window[i]);
            }
            
            // Calculate required digits
            const bitsUsed = window.length * 8;
            const digitsNeeded = Math.ceil(bitsUsed / Math.log2(this.RADIX));
            
            // Convert to base-N with fixed width
            const digits = [];
            for (let i = 0; i < digitsNeeded; i++) {
                const remainder = Number(value % BigInt(this.RADIX));
                const char = this.indexToChar.get(remainder);
                if (!char) {
                    throw new Error(`Invalid index ${remainder} for radix ${this.RADIX}`);
                }
                digits.push(char);
                value = value / BigInt(this.RADIX);
            }
            
            return digits.join('');
        } catch (error) {
            throw new Error(`Window encoding failed: ${error.message}`);
        }
    }
    
    /**
     * Encode metadata efficiently using variable-length encoding
     */
    encodeMetadata(length, checksum) {
        try {
            // Use variable-length encoding for the length
            const lengthDigits = [];
            let len = length;
            
            do {
                const char = this.indexToChar.get(len % this.RADIX);
                if (!char) {
                    throw new Error(`Invalid index ${len % this.RADIX} for radix ${this.RADIX}`);
                }
                lengthDigits.push(char);
                len = Math.floor(len / this.RADIX);
            } while (len > 0);
            
            // Mark end of length with highest char (acts as terminator)
            const terminatorChar = this.indexToChar.get(this.RADIX - 1);
            if (!terminatorChar) {
                throw new Error('Failed to get terminator character');
            }
            lengthDigits.push(terminatorChar);
            
            // Add checksum
            const checksumChar = this.indexToChar.get(checksum);
            if (!checksumChar) {
                throw new Error('Failed to encode checksum');
            }
            lengthDigits.push(checksumChar);
            
            return lengthDigits.join('');
        } catch (error) {
            throw new Error(`Metadata encoding failed: ${error.message}`);
        }
    }
    
    /**
     * Calculate checksum for data validation
     */
    calculateChecksum(bytes) {
        let checksum = 0;
        for (let i = 0; i < bytes.length; i++) {
            checksum = (checksum * 31 + bytes[i]) % this.RADIX;
        }
        return checksum;
    }
}

// Make available globally with validation
if (typeof window !== 'undefined') {
    window.DirectBaseEncoder = DirectBaseEncoder;
    console.log('DirectBaseEncoder class registered globally');
} else {
    console.error('DirectBaseEncoder: window object not available');
}

// Also export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DirectBaseEncoder;
}
