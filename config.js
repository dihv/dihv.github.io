// config.js
window.CONFIG = {
    SAFE_CHARS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~!$\'()*,/:@;+[]{}|^<>`#',
    MAX_URL_LENGTH: 8592,
    
    // Helper functions
    utils: {
        gcd: function(x, y) {
            return !y ? x : this.gcd(y, x % y);
        },
        lcm: function(a, b) {
            return (a * b) / this.gcd(a, b);
        }
    },

    // Calculate bitstream constants
    get BITSTREAM() {
        const CHAR_SET_SIZE = this.SAFE_CHARS.length;
        const BITS_PER_CHAR = Math.floor(Math.log2(CHAR_SET_SIZE));
        const BITS_PER_GROUP = this.utils.lcm(BITS_PER_CHAR, 8);
        
        return {
            CHAR_SET_SIZE,
            BITS_PER_CHAR,
            BITS_PER_GROUP,
            CHARS_PER_GROUP: BITS_PER_GROUP / BITS_PER_CHAR,
            MAX_VALUE_PER_CHAR: (1 << BITS_PER_CHAR) - 1
        };
    },

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
        { format: 'image/webp', quality: 0.8 },
        { format: 'image/webp', quality: 0.65 },
        { format: 'image/webp', quality: 0.5 },
        { format: 'image/webp', quality: 0.4 }
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
    },

    IMAGE_SIZE_LIMITS: {
        MAX_DIMENSION: 4096,
        MAX_PIXELS: 16777216
    },

    OPTIMIZATION_SETTINGS: {
        INITIAL_QUALITY: 0.98,
        MIN_QUALITY: 0.40,
        QUALITY_STEP: 0.02,
        MAX_ITERATIONS: 70
    },

    ERROR_MESSAGES: {
        UNSUPPORTED_FORMAT: "Unsupported image format. Please try a different file.",
        FILE_TOO_LARGE: "Image file is too large. Please try a smaller image or enable compression.",
        INVALID_DIMENSIONS: "Image dimensions exceed maximum limits.",
        ENCODING_ERROR: "Error encoding image data.",
        DECODING_ERROR: "Error decoding image data.",
        URL_TOO_LONG: "Generated URL exceeds maximum length even after compression."
    }
};
