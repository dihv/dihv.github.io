/**
 * ConfigValidator.js
 * 
 * Single source of truth for configuration validation and management.
 * Eliminates multiple CONFIG validation points throughout the codebase.
 */
window.ConfigValidator = class ConfigValidator {
    constructor() {
        this.config = null;
        this.validationSchema = this.createValidationSchema();
        this.validationResult = null;
        
        this.initialize();
        console.log('ConfigValidator initialized');
    }

    /**
     * Initialize and validate configuration
     */
    initialize() {
        // Load and validate base configuration
        this.config = this.loadConfiguration();
        this.validationResult = this.validateConfiguration(this.config);
        
        if (!this.validationResult.valid) {
            throw new Error(`Configuration validation failed: ${this.validationResult.errors.join(', ')}`);
        }
        
        // Apply defaults and computed values
        this.config = this.applyDefaults(this.validationResult.sanitized);
        this.config = this.computeDerivedValues(this.config);
        
        // Store globally for backward compatibility
        window.CONFIG = this.config;
        
        console.log('Configuration validated and applied:', this.config);
    }

    /**
     * Create comprehensive validation schema
     */
    createValidationSchema() {
        return {
            // Core encoding settings
            MAX_URL_LENGTH: {
                type: 'integer',
                required: true,
                constraints: {
                    min: 100,
                    max: 100000
                }
            },
            
            SAFE_CHARS: {
                type: 'string',
                required: true,
                constraints: {
                    minLength: 10,
                    maxLength: 200,
                    custom: (value) => {
                        const unique = new Set(value);
                        return unique.size === value.length || 'SAFE_CHARS must not contain duplicate characters';
                    }
                }
            },
            
            URL_PREFIX: {
                type: 'string',
                required: false,
                default: ''
            },
            
            ENCODE_SMALL_THRESHOLD: {
                type: 'integer',
                required: false,
                default: 64,
                constraints: {
                    min: 1,
                    max: 1024
                }
            },
            
            // Supported formats
            SUPPORTED_INPUT_FORMATS: {
                type: 'object',
                required: true,
                constraints: {
                    custom: (value) => {
                        if (!Array.isArray(value)) return 'SUPPORTED_INPUT_FORMATS must be an array';
                        if (value.length === 0) return 'SUPPORTED_INPUT_FORMATS cannot be empty';
                        
                        const validFormats = [
                            'image/jpeg', 'image/png', 'image/webp', 'image/gif',
                            'image/bmp', 'image/svg+xml', 'image/heic', 'image/heif', 'image/avif'
                        ];
                        
                        for (const format of value) {
                            if (!validFormats.includes(format)) {
                                return `Unsupported format: ${format}`;
                            }
                        }
                        
                        return true;
                    }
                }
            },
            
            // Compression settings
            COMPRESSION_QUALITY_MIN: {
                type: 'number',
                required: false,
                default: 0.05,
                constraints: { min: 0.01, max: 1.0 }
            },
            
            COMPRESSION_QUALITY_MAX: {
                type: 'number',
                required: false,
                default: 0.98,
                constraints: { min: 0.01, max: 1.0 }
            },
            
            COMPRESSION_SCALE_MIN: {
                type: 'number',
                required: false,
                default: 0.05,
                constraints: { min: 0.01, max: 1.0 }
            },
            
            COMPRESSION_SCALE_MAX: {
                type: 'number',
                required: false,
                default: 1.0,
                constraints: { min: 0.01, max: 1.0 }
            },
            
            COMPRESSION_ATTEMPTS_MAX: {
                type: 'integer',
                required: false,
                default: 30,
                constraints: { min: 1, max: 100 }
            },
            
            // Format preferences
            FORMAT_PREFERENCES: {
                type: 'object',
                required: false,
                default: {},
                constraints: {
                    custom: (value) => {
                        for (const [format, prefs] of Object.entries(value)) {
                            if (!format.startsWith('image/')) {
                                return `Invalid format key: ${format}`;
                            }
                            
                            if (typeof prefs !== 'object') {
                                return `Format preferences must be objects: ${format}`;
                            }
                            
                            if (prefs.priority !== undefined && 
                                (!Number.isInteger(prefs.priority) || prefs.priority < 1)) {
                                return `Invalid priority for ${format}: must be integer >= 1`;
                            }
                            
                            if (prefs.initialQuality !== undefined && 
                                (typeof prefs.initialQuality !== 'number' || 
                                 prefs.initialQuality < 0.01 || prefs.initialQuality > 1.0)) {
                                return `Invalid initialQuality for ${format}: must be 0.01-1.0`;
                            }
                        }
                        return true;
                    }
                }
            },
            
            // Format signatures
            FORMAT_SIGNATURES: {
                type: 'object',
                required: false,
                default: {},
                constraints: {
                    custom: (value) => {
                        for (const [name, sig] of Object.entries(value)) {
                            if (!sig.bytes || !Array.isArray(sig.bytes)) {
                                return `Invalid signature bytes for ${name}`;
                            }
                            
                            if (!sig.format || !sig.format.startsWith('image/')) {
                                return `Invalid format for signature ${name}`;
                            }
                            
                            if (sig.offset !== undefined && 
                                (!Number.isInteger(sig.offset) || sig.offset < 0)) {
                                return `Invalid offset for signature ${name}`;
                            }
                        }
                        return true;
                    }
                }
            },
            
            // Performance settings
            CONCURRENT_OPERATIONS_MAX: {
                type: 'integer',
                required: false,
                default: 2,
                constraints: { min: 1, max: 10 }
            },
            
            GPU_USE_THRESHOLD: {
                type: 'integer',
                required: false,
                default: 50 * 1024,
                constraints: { min: 1024, max: 10 * 1024 * 1024 }
            },
            
            BYTE_SIZE: {
                type: 'integer',
                required: false,
                default: 4,
                constraints: { min: 1, max: 8 }
            },
            
            // UI settings
            UI_THEME: {
                type: 'string',
                required: false,
                default: 'light',
                constraints: {
                    enum: ['light', 'dark', 'auto']
                }
            },
            
            UI_ANIMATION_SPEED: {
                type: 'integer',
                required: false,
                default: 200,
                constraints: { min: 0, max: 2000 }
            },
            
            UI_UPDATE_INTERVAL: {
                type: 'integer',
                required: false,
                default: 50,
                constraints: { min: 16, max: 1000 }
            },
            
            // Advanced settings
            ADVANCED: {
                type: 'object',
                required: false,
                default: {},
                constraints: {
                    custom: (value) => {
                        const allowedKeys = [
                            'ENABLE_WORKER_THREADS', 'TEXTURE_MAX_SIZE', 'LOG_PERFORMANCE_METRICS',
                            'ENABLE_DEBUG_MODE', 'PROGRESSIVE_QUALITY_STEPS', 'SCALE_REDUCTION_FACTOR',
                            'MAX_DIMENSION_FALLBACK', 'ENCODING_CHUNK_SIZE', 'METADATA_COMPRESSION',
                            'CHECKSUM_ENABLED'
                        ];
                        
                        for (const key of Object.keys(value)) {
                            if (!allowedKeys.includes(key)) {
                                return `Unknown advanced setting: ${key}`;
                            }
                        }
                        
                        return true;
                    }
                }
            },
            
            // Browser limits
            BROWSER_LIMITS: {
                type: 'object',
                required: false,
                default: {},
                constraints: {
                    custom: (value) => {
                        for (const [browser, limit] of Object.entries(value)) {
                            if (!Number.isInteger(limit) || limit < 100) {
                                return `Invalid browser limit for ${browser}: must be integer >= 100`;
                            }
                        }
                        return true;
                    }
                }
            },
            
            // Encoding efficiency
            ENCODING_EFFICIENCY: {
                type: 'object',
                required: false,
                default: {},
                constraints: {
                    custom: (value) => {
                        for (const [key, efficiency] of Object.entries(value)) {
                            if (typeof efficiency !== 'number' || efficiency <= 0) {
                                return `Invalid encoding efficiency for ${key}: must be positive number`;
                            }
                        }
                        return true;
                    }
                }
            }
        };
    }

    /**
     * Load configuration from window.CONFIG or defaults
     */
    loadConfiguration() {
        const baseConfig = window.CONFIG || {};
        
        // If no CONFIG exists, create minimal valid config
        if (Object.keys(baseConfig).length === 0) {
            console.warn('No CONFIG found, using minimal defaults');
            return this.getMinimalConfig();
        }
        
        return baseConfig;
    }

    /**
     * Get minimal valid configuration
     */
    getMinimalConfig() {
        return {
            MAX_URL_LENGTH: 800,
            SAFE_CHARS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~!$()*,/:@;+&=\'<>[]"{}|`^\\',
            SUPPORTED_INPUT_FORMATS: [
                'image/jpeg', 'image/png', 'image/webp', 'image/gif'
            ]
        };
    }

    /**
     * Validate configuration against schema
     */
    validateConfiguration(config) {
        const result = {
            valid: true,
            errors: [],
            warnings: [],
            sanitized: {}
        };
        
        // Validate each field in schema
        for (const [key, rules] of Object.entries(this.validationSchema)) {
            const value = config[key];
            
            // Check required fields
            if (rules.required && (value === undefined || value === null)) {
                result.errors.push(`Missing required field: ${key}`);
                result.valid = false;
                continue;
            }
            
            // Skip validation if field is optional and not provided
            if (!rules.required && (value === undefined || value === null)) {
                if (rules.default !== undefined) {
                    result.sanitized[key] = this.deepClone(rules.default);
                }
                continue;
            }
            
            // Type validation
            const typeValidation = this.validateType(value, rules.type, key);
            if (!typeValidation.valid) {
                result.errors.push(...typeValidation.errors);
                result.valid = false;
                continue;
            }
            
            // Constraint validation
            if (rules.constraints) {
                const constraintValidation = this.validateConstraints(value, rules.constraints, key);
                if (!constraintValidation.valid) {
                    result.errors.push(...constraintValidation.errors);
                    result.valid = false;
                    continue;
                }
                
                result.warnings.push(...constraintValidation.warnings);
            }
            
            result.sanitized[key] = value;
        }
        
        // Check for unknown fields
        for (const key of Object.keys(config)) {
            if (!this.validationSchema[key]) {
                result.warnings.push(`Unknown configuration field: ${key}`);
            }
        }
        
        return result;
    }

    /**
     * Validate field type
     */
    validateType(value, expectedType, fieldName) {
        const result = { valid: true, errors: [] };
        
        switch (expectedType) {
            case 'string':
                if (typeof value !== 'string') {
                    result.errors.push(`${fieldName} must be a string`);
                    result.valid = false;
                }
                break;
                
            case 'number':
                if (typeof value !== 'number' || isNaN(value)) {
                    result.errors.push(`${fieldName} must be a valid number`);
                    result.valid = false;
                }
                break;
                
            case 'integer':
                if (!Number.isInteger(value)) {
                    result.errors.push(`${fieldName} must be an integer`);
                    result.valid = false;
                }
                break;
                
            case 'boolean':
                if (typeof value !== 'boolean') {
                    result.errors.push(`${fieldName} must be a boolean`);
                    result.valid = false;
                }
                break;
                
            case 'object':
                if (typeof value !== 'object' || value === null) {
                    result.errors.push(`${fieldName} must be an object`);
                    result.valid = false;
                }
                break;
                
            case 'array':
                if (!Array.isArray(value)) {
                    result.errors.push(`${fieldName} must be an array`);
                    result.valid = false;
                }
                break;
                
            default:
                result.errors.push(`Unknown type validation: ${expectedType}`);
                result.valid = false;
        }
        
        return result;
    }

    /**
     * Validate constraints
     */
    validateConstraints(value, constraints, fieldName) {
        const result = { valid: true, errors: [], warnings: [] };
        
        // Min/max for numbers
        if (constraints.min !== undefined && value < constraints.min) {
            result.errors.push(`${fieldName} must be at least ${constraints.min}`);
            result.valid = false;
        }
        
        if (constraints.max !== undefined && value > constraints.max) {
            result.errors.push(`${fieldName} must be at most ${constraints.max}`);
            result.valid = false;
        }
        
        // Length constraints for strings/arrays
        if (constraints.minLength !== undefined && value.length < constraints.minLength) {
            result.errors.push(`${fieldName} must be at least ${constraints.minLength} characters/items`);
            result.valid = false;
        }
        
        if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
            result.errors.push(`${fieldName} must be at most ${constraints.maxLength} characters/items`);
            result.valid = false;
        }
        
        // Enum validation
        if (constraints.enum && !constraints.enum.includes(value)) {
            result.errors.push(`${fieldName} must be one of: ${constraints.enum.join(', ')}`);
            result.valid = false;
        }
        
        // Pattern validation
        if (constraints.pattern && !constraints.pattern.test(value)) {
            result.errors.push(`${fieldName} does not match required pattern`);
            result.valid = false;
        }
        
        // Custom validation
        if (constraints.custom && typeof constraints.custom === 'function') {
            const customResult = constraints.custom(value);
            if (customResult !== true) {
                result.errors.push(`${fieldName}: ${customResult}`);
                result.valid = false;
            }
        }
        
        return result;
    }

    /**
     * Apply default values and sanitization
     */
    applyDefaults(config) {
        const enhanced = { ...config };
        
        // Apply nested defaults for complex objects
        if (!enhanced.FORMAT_PREFERENCES) {
            enhanced.FORMAT_PREFERENCES = this.getDefaultFormatPreferences();
        }
        
        if (!enhanced.FORMAT_SIGNATURES) {
            enhanced.FORMAT_SIGNATURES = this.getDefaultFormatSignatures();
        }
        
        if (!enhanced.BROWSER_LIMITS) {
            enhanced.BROWSER_LIMITS = this.getDefaultBrowserLimits();
        }
        
        if (!enhanced.ENCODING_EFFICIENCY) {
            enhanced.ENCODING_EFFICIENCY = this.getDefaultEncodingEfficiency(enhanced.SAFE_CHARS);
        }
        
        if (!enhanced.ADVANCED) {
            enhanced.ADVANCED = this.getDefaultAdvancedSettings();
        }
        
        return enhanced;
    }

    /**
     * Compute derived values from configuration
     */
    computeDerivedValues(config) {
        const computed = { ...config };
        
        // Compute encoding efficiency from SAFE_CHARS
        if (config.SAFE_CHARS) {
            computed.ENCODING_EFFICIENCY = {
                ...computed.ENCODING_EFFICIENCY,
                CURRENT: Math.log2(config.SAFE_CHARS.length),
                RADIX: config.SAFE_CHARS.length
            };
        }
        
        // Validate quality min/max relationship
        if (computed.COMPRESSION_QUALITY_MIN >= computed.COMPRESSION_QUALITY_MAX) {
            console.warn('COMPRESSION_QUALITY_MIN >= MAX, adjusting values');
            computed.COMPRESSION_QUALITY_MIN = Math.min(0.05, computed.COMPRESSION_QUALITY_MAX - 0.1);
        }
        
        // Validate scale min/max relationship
        if (computed.COMPRESSION_SCALE_MIN >= computed.COMPRESSION_SCALE_MAX) {
            console.warn('COMPRESSION_SCALE_MIN >= MAX, adjusting values');
            computed.COMPRESSION_SCALE_MIN = Math.min(0.05, computed.COMPRESSION_SCALE_MAX - 0.1);
        }
        
        return computed;
    }

    /**
     * Get default format preferences
     */
    getDefaultFormatPreferences() {
        return {
            'image/webp': {
                priority: 1,
                initialQuality: 0.85,
                supportsTransparency: true,
                compressionEfficiency: 0.9
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
                compressionEfficiency: 0.7
            }
        };
    }

    /**
     * Get default format signatures
     */
    getDefaultFormatSignatures() {
        return {
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
            }
        };
    }

    /**
     * Get default browser limits
     */
    getDefaultBrowserLimits() {
        return {
            IE: 2083,
            EDGE: 2048,
            CHROME: 8192,
            FIREFOX: 65536,
            SAFARI: 80000,
            DEFAULT: 2000
        };
    }

    /**
     * Get default encoding efficiency
     */
    getDefaultEncodingEfficiency(safeChars) {
        const radix = safeChars ? safeChars.length : 85;
        return {
            BASE64: 6.0,
            BASE85: 6.41,
            CURRENT: Math.log2(radix),
            RADIX: radix
        };
    }

    /**
     * Get default advanced settings
     */
    getDefaultAdvancedSettings() {
        return {
            ENABLE_WORKER_THREADS: false,
            TEXTURE_MAX_SIZE: 2048,
            LOG_PERFORMANCE_METRICS: true,
            ENABLE_DEBUG_MODE: false,
            PROGRESSIVE_QUALITY_STEPS: [0.9, 0.7, 0.5, 0.3, 0.15, 0.08],
            SCALE_REDUCTION_FACTOR: 0.85,
            MAX_DIMENSION_FALLBACK: 512,
            ENCODING_CHUNK_SIZE: 1024,
            METADATA_COMPRESSION: true,
            CHECKSUM_ENABLED: true
        };
    }

    /**
     * Deep clone utility
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const cloned = {};
            Object.keys(obj).forEach(key => {
                cloned[key] = this.deepClone(obj[key]);
            });
            return cloned;
        }
        return obj;
    }

    /**
     * Get validated configuration
     */
    getConfig() {
        return this.config;
    }

    /**
     * Get specific configuration value
     */
    get(key, defaultValue = undefined) {
        if (key.includes('.')) {
            // Support nested keys like 'ADVANCED.ENABLE_DEBUG_MODE'
            return this.getNestedValue(this.config, key, defaultValue);
        }
        
        return this.config[key] !== undefined ? this.config[key] : defaultValue;
    }

    /**
     * Get nested configuration value
     */
    getNestedValue(obj, path, defaultValue) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : defaultValue;
        }, obj);
    }

    /**
     * Update configuration value with validation
     */
    set(key, value) {
        // Validate the new value
        const schema = this.validationSchema[key];
        if (!schema) {
            throw new Error(`Unknown configuration key: ${key}`);
        }
        
        const validation = this.validateType(value, schema.type, key);
        if (!validation.valid) {
            throw new Error(`Invalid value for ${key}: ${validation.errors.join(', ')}`);
        }
        
        if (schema.constraints) {
            const constraintValidation = this.validateConstraints(value, schema.constraints, key);
            if (!constraintValidation.valid) {
                throw new Error(`Invalid value for ${key}: ${constraintValidation.errors.join(', ')}`);
            }
        }
        
        // Update configuration
        this.config[key] = value;
        window.CONFIG[key] = value;
        
        // Recompute derived values if necessary
        if (['SAFE_CHARS', 'COMPRESSION_QUALITY_MIN', 'COMPRESSION_QUALITY_MAX'].includes(key)) {
            this.config = this.computeDerivedValues(this.config);
            window.CONFIG = this.config;
        }
    }

    /**
     * Get validation result
     */
    getValidationResult() {
        return this.validationResult;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.config = null;
        console.log('ConfigValidator cleaned up');
    }
};