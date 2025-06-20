/**
 * SharedUtils.js
 * 
 * Consolidated utilities module that eliminates code duplication.
 * Provides formatting, validation, async patterns, and common operations.
 */
window.SharedUtils = class SharedUtils {
    constructor() {
        // Validation patterns
        this.patterns = {
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            url: /^https?:\/\/.+/,
            hexColor: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
            base64: /^[A-Za-z0-9+/]*={0,2}$/
        };
        
        // Memoization cache
        this.memoCache = new Map();
        this.maxCacheSize = 1000;
        
        console.log('SharedUtils initialized');
    }

    // ===============================
    // FORMATTING UTILITIES
    // ===============================

    /**
     * Format bytes to human readable string
     * @param {number} bytes - Number of bytes
     * @param {number} decimals - Number of decimal places
     * @returns {string} Formatted string
     */
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0 || bytes === null || bytes === undefined) return '0 B';
        if (typeof bytes !== 'number' || isNaN(bytes)) return 'Invalid';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        
        const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
        const size = Math.max(0, Math.min(i, sizes.length - 1));
        
        return `${parseFloat((bytes / Math.pow(k, size)).toFixed(dm))} ${sizes[size]}`;
    }

    /**
     * Format time duration to human readable string
     * @param {number} milliseconds - Duration in milliseconds
     * @param {boolean} precise - Whether to show precise formatting
     * @returns {string} Formatted time string
     */
    formatTime(milliseconds, precise = false) {
        if (milliseconds === 0 || milliseconds === null || milliseconds === undefined) {
            return '0.0s';
        }
        if (typeof milliseconds !== 'number' || isNaN(milliseconds)) {
            return 'Invalid';
        }
        
        const seconds = milliseconds / 1000;
        
        if (seconds < 60) {
            return `${seconds.toFixed(precise ? 2 : 1)}s`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            if (precise) {
                return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
            }
            return `${minutes}m ${Math.round(remainingSeconds)}s`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        }
    }

    /**
     * Format percentage with proper precision
     * @param {number} value - Percentage value
     * @param {number} decimals - Number of decimal places
     * @returns {string} Formatted percentage string
     */
    formatPercentage(value, decimals = 1) {
        if (value === null || value === undefined || isNaN(value)) return '0%';
        const clampedValue = Math.max(0, Math.min(100, value));
        return `${clampedValue.toFixed(decimals)}%`;
    }

    /**
     * Format numbers with locale-specific formatting
     * @param {number} number - Number to format
     * @param {Object} options - Formatting options
     * @returns {string} Formatted number string
     */
    formatNumber(number, options = {}) {
        if (typeof number !== 'number' || isNaN(number)) return 'Invalid';
        
        const defaultOptions = {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
            useGrouping: true
        };
        
        return number.toLocaleString(undefined, { ...defaultOptions, ...options });
    }

    /**
     * Format image format for display
     * @param {string} mimeType - MIME type string
     * @returns {string} Formatted format string
     */
    formatImageFormat(mimeType) {
        if (!mimeType || typeof mimeType !== 'string') return 'Unknown';
        
        const parts = mimeType.split('/');
        if (parts.length === 2) {
            return parts[1].toUpperCase();
        }
        
        return mimeType.toUpperCase();
    }

    /**
     * Format URL for display (truncate if too long)
     * @param {string} url - URL to format
     * @param {number} maxLength - Maximum display length
     * @returns {string} Formatted URL
     */
    formatURL(url, maxLength = 80) {
        if (!url || typeof url !== 'string') return '';
        
        if (url.length <= maxLength) return url;
        
        const start = url.substring(0, Math.floor(maxLength / 2) - 2);
        const end = url.substring(url.length - Math.floor(maxLength / 2) + 2);
        return `${start}...${end}`;
    }

    // ===============================
    // VALIDATION UTILITIES
    // ===============================

    /**
     * Validate input against type and constraints
     * @param {*} value - Value to validate
     * @param {string} type - Expected type
     * @param {Object} constraints - Additional constraints
     * @returns {Object} Validation result
     */
    validate(value, type, constraints = {}) {
        const result = {
            valid: false,
            errors: [],
            sanitized: value
        };
        
        // Type validation
        switch (type) {
            case 'string':
                if (typeof value !== 'string') {
                    result.errors.push('Must be a string');
                    return result;
                }
                break;
                
            case 'number':
                if (typeof value !== 'number' || isNaN(value)) {
                    result.errors.push('Must be a valid number');
                    return result;
                }
                break;
                
            case 'integer':
                if (!Number.isInteger(value)) {
                    result.errors.push('Must be an integer');
                    return result;
                }
                break;
                
            case 'boolean':
                if (typeof value !== 'boolean') {
                    result.errors.push('Must be a boolean');
                    return result;
                }
                break;
                
            case 'email':
                if (!this.patterns.email.test(value)) {
                    result.errors.push('Must be a valid email address');
                    return result;
                }
                break;
                
            case 'url':
                if (!this.patterns.url.test(value)) {
                    result.errors.push('Must be a valid URL');
                    return result;
                }
                break;
        }
        
        // Constraint validation
        if (constraints.min !== undefined && value < constraints.min) {
            result.errors.push(`Must be at least ${constraints.min}`);
        }
        
        if (constraints.max !== undefined && value > constraints.max) {
            result.errors.push(`Must be at most ${constraints.max}`);
        }
        
        if (constraints.minLength !== undefined && value.length < constraints.minLength) {
            result.errors.push(`Must be at least ${constraints.minLength} characters`);
        }
        
        if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
            result.errors.push(`Must be at most ${constraints.maxLength} characters`);
        }
        
        if (constraints.pattern && !constraints.pattern.test(value)) {
            result.errors.push('Does not match required pattern');
        }
        
        if (constraints.enum && !constraints.enum.includes(value)) {
            result.errors.push(`Must be one of: ${constraints.enum.join(', ')}`);
        }
        
        // Custom validator
        if (constraints.custom && typeof constraints.custom === 'function') {
            const customResult = constraints.custom(value);
            if (customResult !== true) {
                result.errors.push(customResult || 'Custom validation failed');
            }
        }
        
        // Sanitization
        if (type === 'string' && constraints.trim) {
            result.sanitized = value.trim();
        }
        
        if (type === 'string' && constraints.toLowerCase) {
            result.sanitized = result.sanitized.toLowerCase();
        }
        
        if (type === 'string' && constraints.toUpperCase) {
            result.sanitized = result.sanitized.toUpperCase();
        }
        
        result.valid = result.errors.length === 0;
        return result;
    }

    /**
     * Validate configuration object
     * @param {Object} config - Configuration to validate
     * @param {Object} schema - Validation schema
     * @returns {Object} Validation result
     */
    validateConfig(config, schema) {
        const result = {
            valid: true,
            errors: [],
            sanitized: {}
        };
        
        // Check required fields
        for (const [key, rules] of Object.entries(schema)) {
            if (rules.required && !(key in config)) {
                result.errors.push(`Missing required field: ${key}`);
                result.valid = false;
                continue;
            }
            
            if (key in config) {
                const fieldResult = this.validate(config[key], rules.type, rules.constraints);
                if (!fieldResult.valid) {
                    result.errors.push(`${key}: ${fieldResult.errors.join(', ')}`);
                    result.valid = false;
                } else {
                    result.sanitized[key] = fieldResult.sanitized;
                }
            } else if (rules.default !== undefined) {
                result.sanitized[key] = rules.default;
            }
        }
        
        return result;
    }

    // ===============================
    // ASYNC UTILITIES
    // ===============================

    /**
     * Delay execution for specified milliseconds
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Promise that resolves after delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Timeout a promise after specified milliseconds
     * @param {Promise} promise - Promise to timeout
     * @param {number} ms - Timeout in milliseconds
     * @param {string} message - Timeout error message
     * @returns {Promise} Promise that rejects on timeout
     */
    timeout(promise, ms, message = 'Operation timed out') {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error(message)), ms)
            )
        ]);
    }

    /**
     * Retry a function with exponential backoff
     * @param {Function} fn - Function to retry
     * @param {Object} options - Retry options
     * @returns {Promise} Promise that resolves with result or rejects
     */
    async retry(fn, options = {}) {
        const {
            maxAttempts = 3,
            baseDelay = 1000,
            maxDelay = 10000,
            backoffFactor = 2,
            shouldRetry = () => true
        } = options;
        
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                if (attempt === maxAttempts || !shouldRetry(error, attempt)) {
                    throw error;
                }
                
                const delay = Math.min(
                    baseDelay * Math.pow(backoffFactor, attempt - 1),
                    maxDelay
                );
                
                console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
                await this.delay(delay);
            }
        }
        
        throw lastError;
    }

    /**
     * Throttle function calls
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    /**
     * Memoize function results
     * @param {Function} func - Function to memoize
     * @param {Function} keyGenerator - Custom key generator
     * @returns {Function} Memoized function
     */
    memoize(func, keyGenerator = (...args) => JSON.stringify(args)) {
        return (...args) => {
            const key = keyGenerator(...args);
            
            if (this.memoCache.has(key)) {
                return this.memoCache.get(key);
            }
            
            const result = func(...args);
            
            // Manage cache size
            if (this.memoCache.size >= this.maxCacheSize) {
                const firstKey = this.memoCache.keys().next().value;
                this.memoCache.delete(firstKey);
            }
            
            this.memoCache.set(key, result);
            return result;
        };
    }

    // ===============================
    // DATA UTILITIES
    // ===============================

    /**
     * Deep clone an object
     * @param {*} obj - Object to clone
     * @returns {*} Cloned object
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (obj instanceof Set) return new Set([...obj].map(item => this.deepClone(item)));
        if (obj instanceof Map) {
            const cloned = new Map();
            obj.forEach((value, key) => cloned.set(key, this.deepClone(value)));
            return cloned;
        }
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
     * Merge objects deeply
     * @param {Object} target - Target object
     * @param {...Object} sources - Source objects
     * @returns {Object} Merged object
     */
    deepMerge(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();
        
        if (this.isObject(target) && this.isObject(source)) {
            for (const key in source) {
                if (this.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.deepMerge(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }
        
        return this.deepMerge(target, ...sources);
    }

    /**
     * Check if value is a plain object
     * @param {*} item - Item to check
     * @returns {boolean} Whether item is an object
     */
    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    /**
     * Get nested property value safely
     * @param {Object} obj - Object to traverse
     * @param {string} path - Dot-separated path
     * @param {*} defaultValue - Default value if path not found
     * @returns {*} Property value or default
     */
    getNestedProperty(obj, path, defaultValue = undefined) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : defaultValue;
        }, obj);
    }

    /**
     * Set nested property value safely
     * @param {Object} obj - Object to modify
     * @param {string} path - Dot-separated path
     * @param {*} value - Value to set
     * @returns {Object} Modified object
     */
    setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        
        const target = keys.reduce((current, key) => {
            if (current[key] === undefined) {
                current[key] = {};
            }
            return current[key];
        }, obj);
        
        target[lastKey] = value;
        return obj;
    }

    // ===============================
    // BROWSER UTILITIES
    // ===============================

    /**
     * Detect browser capabilities
     * @returns {Object} Browser capabilities
     */
    detectBrowserCapabilities() {
        return this.memoize(() => {
            const capabilities = {
                // Core APIs
                fileAPI: !!(window.File && window.FileReader && window.FileList && window.Blob),
                canvas: !!window.HTMLCanvasElement,
                webgl: this.hasWebGLSupport(),
                webgl2: this.hasWebGL2Support(),
                webWorkers: !!window.Worker,
                serviceWorkers: !!navigator.serviceWorker,
                
                // Performance APIs
                performanceAPI: !!window.performance,
                performanceObserver: !!window.PerformanceObserver,
                
                // Storage APIs
                localStorage: !!window.localStorage,
                sessionStorage: !!window.sessionStorage,
                indexedDB: !!window.indexedDB,
                
                // Network APIs
                fetch: !!window.fetch,
                
                // Device info
                deviceMemory: navigator.deviceMemory || 'unknown',
                hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
                connection: navigator.connection ? {
                    effectiveType: navigator.connection.effectiveType,
                    downlink: navigator.connection.downlink
                } : null,
                
                // Platform
                isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
                platform: navigator.platform,
                userAgent: navigator.userAgent
            };
            
            return capabilities;
        })();
    }

    /**
     * Check WebGL support
     * @returns {boolean} Whether WebGL is supported
     */
    hasWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            return !!canvas.getContext('webgl');
        } catch (e) {
            return false;
        }
    }

    /**
     * Check WebGL2 support
     * @returns {boolean} Whether WebGL2 is supported
     */
    hasWebGL2Support() {
        try {
            const canvas = document.createElement('canvas');
            return !!canvas.getContext('webgl2');
        } catch (e) {
            return false;
        }
    }

    /**
     * Get performance information
     * @returns {Object} Performance metrics
     */
    getPerformanceInfo() {
        const info = {
            memory: null,
            timing: null,
            navigation: null
        };
        
        if (performance.memory) {
            info.memory = {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        
        if (performance.timing) {
            const t = performance.timing;
            info.timing = {
                domContentLoaded: t.domContentLoadedEventEnd - t.domContentLoadedEventStart,
                load: t.loadEventEnd - t.loadEventStart,
                total: t.loadEventEnd - t.navigationStart
            };
        }
        
        if (performance.navigation) {
            info.navigation = {
                type: performance.navigation.type,
                redirectCount: performance.navigation.redirectCount
            };
        }
        
        return info;
    }

    // ===============================
    // UTILITY METHODS
    // ===============================

    /**
     * Generate unique ID
     * @param {string} prefix - Optional prefix
     * @returns {string} Unique ID
     */
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Clear memoization cache
     */
    clearMemoCache() {
        this.memoCache.clear();
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        return {
            size: this.memoCache.size,
            maxSize: this.maxCacheSize,
            usage: (this.memoCache.size / this.maxCacheSize) * 100
        };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.clearMemoCache();
        console.log('SharedUtils cleaned up');
    }
};