// config.js
window.CONFIG = {
    // Base configuration - only this should be manually specified
    SAFE_CHARS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~!$\'()*,/:@;+[]{}|^<>`#',
    MAX_URL_LENGTH: 8192,
    
    // Helper functions for constant derivation
    utils: {
        gcd: function(x, y) {
            return !y ? x : this.gcd(y, x % y);
        },
        lcm: function(a, b) {
            return (a * b) / this.gcd(a, b);
        },
        // Calculate optimal group sizes that maintain byte alignment
        calculateBitGroups: function(charSetSize) {
            const bitsPerChar = Math.floor(Math.log2(charSetSize));
            const bitsInByte = 8;
            
            // Find LCM of bits per char and bits in byte
            const bitsPerGroup = this.lcm(bitsPerChar, bitsInByte);
            const charsPerGroup = Math.floor(bitsPerGroup / bitsPerChar);
            const bytesPerGroup = Math.floor(bitsPerGroup / bitsInByte);
            
            return {
                bitsPerChar,
                bitsPerGroup,
                charsPerGroup,
                bytesPerGroup
            };
        }
    },

    // All constants derived from SAFE_CHARS
    get BITSTREAM() {
        const CHAR_SET_SIZE = this.SAFE_CHARS.length;
        const {
            bitsPerChar,
            bitsPerGroup,
            charsPerGroup,
            bytesPerGroup
        } = this.utils.calculateBitGroups(CHAR_SET_SIZE);
        
        return {
            CHAR_SET_SIZE,
            BITS_PER_CHAR: bitsPerChar,
            BITS_PER_GROUP: bitsPerGroup,
            CHARS_PER_GROUP: charsPerGroup,
            BYTES_PER_GROUP: bytesPerGroup,
            MAX_VALUE_PER_CHAR: (1 << bitsPerChar) - 1,
            // Add validation that our calculations are safe
            validation: {
                maxPossibleValue: Math.pow(2, bitsPerChar),
                isCharSetValid: CHAR_SET_SIZE <= Math.pow(2, bitsPerChar),
                groupBytesAligned: (bitsPerGroup % 8) === 0,
                groupCharsAligned: (bitsPerGroup % bitsPerChar) === 0
            }
        };
    },

    // Image processing configurations
    SUPPORTED_INPUT_FORMATS: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/bmp',
        'image/svg+xml',
        'image/heic',
        'image/heif',
        'image/avif'
    ],
    
    COMPRESSION_STRATEGIES: [
        { format: 'image/webp', quality: 0.95 },
        { format: 'image/webp', quality: 0.90 },
        { format: 'image/webp', quality: 0.85 },
        { format: 'image/webp', quality: 0.80 },
        { format: 'image/webp', quality: 0.65 },
        { format: 'image/webp', quality: 0.50 },
        { format: 'image/webp', quality: 0.40 }
    ],

    FORMAT_SIGNATURES: {
        JPEG: { bytes: [0xFF, 0xD8], format: 'image/jpeg' },
        PNG: { bytes: [0x89, 0x50, 0x4E, 0x47], format: 'image/png' },
        GIF87a: { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], format: 'image/gif' },
        GIF89a: { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], format: 'image/gif' },
        BMP: { bytes: [0x42, 0x4D], format: 'image/bmp' },
        WEBP: { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8, format: 'image/webp' },
        HEIC: { bytes: [0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], offset: 4, format: 'image/heic' },
        HEIF: { bytes: [0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x66], offset: 4, format: 'image/heif' },
        AVIF: { bytes: [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66], offset: 4, format: 'image/avif' },
        SVG: { bytes: [0x3C, 0x3F, 0x78, 0x6D, 0x6C], format: 'image/svg+xml' }
    }
};

// Validate configuration on load
(function validateConfig() {
    const bs = window.CONFIG.BITSTREAM;
    console.assert(bs.validation.isCharSetValid, 
        `Character set size (${bs.CHAR_SET_SIZE}) exceeds maximum value for ${bs.BITS_PER_CHAR} bits per char`);
    console.assert(bs.validation.groupBytesAligned,
        'Bit groups must align with byte boundaries');
    console.assert(bs.validation.groupCharsAligned,
        'Bit groups must align with character boundaries');
})();
