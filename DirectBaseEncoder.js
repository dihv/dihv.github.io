/**
 * Direct Base Conversion Encoder
 * 
 * Uses a sliding window approach to convert binary data directly to base-N
 * without byte boundary issues, avoiding repetitive patterns.
 */
class DirectBaseEncoder {
    constructor(safeChars) {
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
    }
    
    /**
     * Encode data using sliding window approach
     */
    encode(data) {
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        
        if (bytes.length === 0) {
            throw new Error('Empty input data');
        }
        
        // For small data, use simple encoding
        if (bytes.length <= this.SMALL_DATA_THRESHOLD) {
            return this.encodeSmall(bytes);
        }
        
        // Use sliding window approach for larger data
        return this.encodeLarge(bytes);
    }
    
    /**
     * Simple encoding for small data
     */
    encodeSmall(bytes) {
        // Convert bytes to a single number
        let value = 0n;
        for (let i = bytes.length - 1; i >= 0; i--) {
            value = (value << 8n) | BigInt(bytes[i]);
        }
        
        // Convert to base-N
        const digits = [];
        while (value > 0n) {
            digits.push(this.indexToChar.get(Number(value % BigInt(this.RADIX))));
            value = value / BigInt(this.RADIX);
        }
        
        // Add simple metadata: length + checksum
        const metadata = this.indexToChar.get(bytes.length) + 
                        this.indexToChar.get(this.calculateChecksum(bytes));
        
        return metadata + digits.join('');
    }
    
    /**
     * Encode large data using sliding window
     */
    encodeLarge(bytes) {
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
            digits.push(this.indexToChar.get(Number(value % BigInt(this.RADIX))));
            value = value / BigInt(this.RADIX);
        }
        
        return digits.join('');
    }
    
    /**
     * Encode metadata efficiently using variable-length encoding
     */
    encodeMetadata(length, checksum) {
        // Use variable-length encoding for the length
        const lengthDigits = [];
        let len = length;
        
        do {
            lengthDigits.push(this.indexToChar.get(len % this.RADIX));
            len = Math.floor(len / this.RADIX);
        } while (len > 0);
        
        // Mark end of length with highest char (acts as terminator)
        lengthDigits.push(this.indexToChar.get(this.RADIX - 1));
        
        // Add checksum
        lengthDigits.push(this.indexToChar.get(checksum));
        
        return lengthDigits.join('');
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

// Make available globally
window.DirectBaseEncoder = DirectBaseEncoder;
