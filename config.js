/** config.js
 * Configuration and Constants for BitStream Image Share
 * 
 * This file contains all configuration settings and constants used throughout the application.
 * Following Project Technical Approach principles, all magic numbers and constants should be defined here.
 */
window.CONFIG = {
    // URL and encoding
    MAX_URL_LENGTH: 12192, // PC_3: Maximum URL length
    BYTE_SIZE: 4, // Number of bytes to process at once
    URL_PREFIX: '', // Optional prefix for generated URLs
    ENCODE_SMALL_THRESHOLD: 32, // Bytes threshold for simplified encoding

    // Character set for URL encoding - PTA_1: Use URL-safe character set
    SAFE_CHARS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~!$\'()*,/:@;+[]{}|^<>`#',

    // Input formats supported by the application - PR_3: Supported input formats
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

    // Optimization targets
    COMPRESSION_QUALITY_MIN: 0.1,   // Minimum quality to try during compression
    COMPRESSION_QUALITY_MAX: 0.95,  // Maximum quality to try during compression
    COMPRESSION_SCALE_MIN: 0.1,     // Minimum scale to try during compression
    COMPRESSION_SCALE_MAX: 1.0,     // Maximum scale to try during compression
    COMPRESSION_ATTEMPTS_MAX: 10,   // Maximum number of compression attempts before giving up

    // Format preferences - PR_1: Optimal codec selection
    FORMAT_PREFERENCES: {
        'image/jpeg': {
            priority: 1,
            initialQuality: 0.85,
            supportsTransparency: false
        },
        'image/webp': {
            priority: 2, 
            initialQuality: 0.85,
            supportsTransparency: true
        },
        'image/png': {
            priority: 3,
            initialQuality: 0.9,
            supportsTransparency: true
        },
        'image/avif': {
            priority: 4,
            initialQuality: 0.85,
            supportsTransparency: true
        }
    },

    // Format detection signatures - PTA_4: Magic numbers for format detection
    FORMAT_SIGNATURES: {
        'JPEG': {
            bytes: [0xFF, 0xD8, 0xFF],
            offset: 0,
            format: 'image/jpeg'
        },
        'PNG': {
            bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
            offset: 0,
            format: 'image/png'
        },
        'GIF87a': {
            bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
            offset: 0,
            format: 'image/gif'
        },
        'GIF89a': {
            bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
            offset: 0,
            format: 'image/gif'
        },
        'WEBP': {
            bytes: [0x52, 0x49, 0x46, 0x46], // "RIFF" followed by WEBP
            offset: 0,
            format: 'image/webp'
        },
        'BMP': {
            bytes: [0x42, 0x4D], // "BM"
            offset: 0, 
            format: 'image/bmp'
        },
        'AVIF': {
            bytes: [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66], // ftyp + avif
            offset: 4,
            format: 'image/avif'
        },
        'HEIC': {
            bytes: [0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63], // ftyp + heic
            offset: 4, 
            format: 'image/heic'
        },
        'HEIF': {
            bytes: [0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31], // ftyp + mif1
            offset: 4,
            format: 'image/heif'
        },
        'SVG': {
            bytes: [0x3C, 0x73, 0x76, 0x67], // "<svg"
            offset: 0,
            format: 'image/svg+xml'
        }
    },

    // Performance settings
    CONCURRENT_OPERATIONS_MAX: 4,   // Maximum number of concurrent operations
    MEMORY_CHUNK_SIZE: 1024 * 1024, // 1MB chunks for large image processing
    GPU_USE_THRESHOLD: 100 * 1024,  // 100KB threshold for GPU acceleration

    // User interface settings
    UI_THEME: 'light',              // 'light' or 'dark'
    UI_ANIMATION_SPEED: 300,        // Animation speed in ms
    UI_UPDATE_INTERVAL: 100,        // UI update interval in ms

    // Advanced settings for performance tuning
    ADVANCED: {
        ENABLE_WORKER_THREADS: true, // Use worker threads when available
        TEXTURE_MAX_SIZE: 4096,      // Maximum texture size to use for GPU processing
        LOG_PERFORMANCE_METRICS: true, // Whether to log performance metrics
        ENABLE_DEBUG_MODE: true     // Enable additional debug information
    }
};
