/** config.js
 * Configuration and Constants for BitStream Image Share
 * * This file contains all configuration settings and constants used throughout the application.
 * Following Project Technical Approach principles, all magic numbers and constants should be defined here.
 */
window.CONFIG = {
    // URL and encoding
    MAX_URL_LENGTH: 800, // PC_3: Maximum URL length
    URL_PREFIX: '', // Optional prefix for generated URLs
    ENCODE_SMALL_THRESHOLD: 64, // Bytes threshold for simplified encoding

    // --- System ---
    // Defines the debug level for the application.
    // 0: No debug output
    // 1: Basic logs
    // 2: Detailed logs
    // 3: Verbose logs for deep debugging
    DEBUG_LEVEL: 1,

    // --- Versioning ---
    // Current version of the encoding format.
    // This helps in maintaining backward compatibility.
    // Increment this for any breaking changes in the encoding logic.
    VERSION: 5,

    // --- Image Processing ---
    // Target quality for image compression (0.0 to 1.0).
    // This is the starting point for the binary search for optimal compression.
    TARGET_QUALITY: 0.85,

    // A list of image formats to try encoding to, in order of preference.
    // The system will attempt to convert to these formats to find the smallest output.
    PREFERRED_FORMATS: ['image/webp', 'image/jpeg', 'image/png'],

    // --- Performance ---
    // Configuration for the resource pool.
    RESOURCE_POOL: {
        MAX_WORKERS: 4 // Maximum number of web workers to use for parallel processing.
    },

    // --- WebGL ---
    // Configuration for the WebGL manager.
    WEBGL_CONTEXT_ATTRIBUTES: {
        alpha: true,
        depth: false,
        stencil: false,
        antialias: false,
        preserveDrawingBuffer: false
    },
    
    // --- Header Metadata ---
    // Defines the number of bits used to store various metadata fields in the bitstream header.
    // These values determine the maximum value each field can hold.
    // For example, 4 bits for version allows for 16 versions (0-15).
    // 14 bits for width/height allows for dimensions up to 16383x16383.
    HEADER_BIT_ALLOCATION: {
        VERSION: 4,         // Bits for the encoding version.
        MIME_TYPE: 4,       // Bits for the MIME type of the image.
        WIDTH: 14,          // Bits for image width.
        HEIGHT: 14,         // Bits for image height.
        RESERVED: 6         // Reserved for future use.
    },

    // Character set for URL encoding - PTA_1: Do not change the character set in the config file
    SAFE_CHARS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~!$()*,:@;+&=\'<>[]"{}|`^\\',

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
    COMPRESSION_QUALITY_MIN: 0.05,   // Minimum quality to try during compression
    COMPRESSION_QUALITY_MAX: 0.98,  // Maximum quality to try during compression
    COMPRESSION_SCALE_MIN: 0.05,     // Minimum scale to try during compression
    COMPRESSION_SCALE_MAX: 1.0,     // Maximum scale to try during compression
    COMPRESSION_ATTEMPTS_MAX: 30,   // Maximum number of compression attempts before giving up

    // Format preferences - PR_1: Optimal codec selection
    FORMAT_PREFERENCES: {
        'image/webp': {
            priority: 1,
            initialQuality: 0.85,
            supportsTransparency: true,
            compressionEfficiency: 0.9 // Higher is better for URL encoding
        },
        'image/avif': {
            priority: 2,
            initialQuality: 0.85,
            supportsTransparency: true,
            compressionEfficiency: 0.95
        },
        'image/jpeg': {
            priority: 3,
            initialQuality: 0.80,
            supportsTransparency: false,
            compressionEfficiency: 0.85
        },
        'image/png': {
            priority: 4,
            initialQuality: 0.90,
            supportsTransparency: true,
            compressionEfficiency: 0.7 // PNG is less efficient for photos
        }
    },

    // Enhanced format detection signatures
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
        'WEBP_RIFF': {
            bytes: [0x52, 0x49, 0x46, 0x46],
            offset: 0,
            format: 'image/webp',
            verify: (data) => {
                // Additional check for WEBP signature at offset 8
                return data.length > 11 && 
                       data[8] === 0x57 && data[9] === 0x45 && 
                       data[10] === 0x42 && data[11] === 0x50;
            }
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
        'BMP': {
            bytes: [0x42, 0x4D],
            offset: 0,
            format: 'image/bmp'
        },
        'AVIF': {
            bytes: [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66],
            offset: 4,
            format: 'image/avif'
        },
        'HEIC': {
            bytes: [0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63],
            offset: 4,
            format: 'image/heic'
        },
        'HEIF': {
            bytes: [0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31],
            offset: 4,
            format: 'image/heif'
        },
        'SVG': {
            bytes: [0x3C, 0x73, 0x76, 0x67],
            offset: 0,
            format: 'image/svg+xml'
        }
    },

    // Performance settings - Optimized for GitHub Pages
    CONCURRENT_OPERATIONS_MAX: 2,    // Reduced for GitHub Pages CPU limits
    GPU_USE_THRESHOLD: 50 * 1024,    // 50KB threshold for GPU acceleration
    BYTE_SIZE: 4,                    // Bytes per group for encoding

    // User interface settings
    UI_THEME: 'light',
    UI_ANIMATION_SPEED: 200,         // Faster animations for responsiveness
    UI_UPDATE_INTERVAL: 50,          // More frequent updates for better UX

    // Advanced settings for performance tuning
    ADVANCED: {
        ENABLE_WORKER_THREADS: false,    // Disabled for GitHub Pages compatibility
        TEXTURE_MAX_SIZE: 2048,          // Reduced for better compatibility
        LOG_PERFORMANCE_METRICS: true,
        ENABLE_DEBUG_MODE: false,        // Disabled for production
        
        // Compression pipeline optimization
        PROGRESSIVE_QUALITY_STEPS: [0.9, 0.7, 0.5, 0.3, 0.15, 0.08],
        SCALE_REDUCTION_FACTOR: 0.85,    // Factor for each scale reduction step
        MAX_DIMENSION_FALLBACK: 512,     // Maximum dimension for extreme compression
        
        // URL encoding optimization
        ENCODING_CHUNK_SIZE: 1024,       // Optimal chunk size for encoding
        METADATA_COMPRESSION: true,      // Enable metadata compression
        CHECKSUM_ENABLED: true           // Enable integrity checking
    },

    // Browser-specific optimizations
    BROWSER_LIMITS: {
        // Conservative URL limits for maximum compatibility
        IE: 2083,
        EDGE: 2048,
        CHROME: 8192,
        FIREFOX: 65536,
        SAFARI: 80000,
        DEFAULT: 2000
    },

    // Encoding efficiency metrics (bits per character)
    ENCODING_EFFICIENCY: {
        BASE64: 6.0,
        BASE85: 6.41,
        CURRENT: Math.log2(85), // Will be calculated based on SAFE_CHARS length
    }
};