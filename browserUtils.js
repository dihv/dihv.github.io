/**
 * browserUtils.js
 * 
 * Utilities for browser detection, capability checking, and environment limitations.
 * Centralizes browser-specific code to improve maintainability.
 */
window.BrowserUtils = class BrowserUtils {
    constructor() {
        // No stored state needed for this utility class
    }

    /**
     * Check if WebGL2 is supported by the browser
     * @returns {boolean} - Whether WebGL2 is supported
     */
    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2');
            if (!gl) return false;
            
            // Check that we can get a valid context
            const isValid = !gl.isContextLost();
            
            // Clean up - try to recover context loss
            const loseContext = gl.getExtension('WEBGL_lose_context');
            if (loseContext) {
                loseContext.loseContext();
                //TODO: This section was commented out because some browsers do not allow context restoration after a context loss
                // setTimeout(() => {
                //     try {
                //         loseContext.restoreContext();
                //     } catch (e) {
                //         // Ignore errors during cleanup
                //     }
                // }, 0);
            }
            
            return isValid;
        } catch (e) {
            console.warn('Error checking WebGL support:', e);
            return false;
        }
    }

    /**
     * Get maximum URL length supported by the current browser
     * @returns {number} - Maximum URL length
     */
    getBrowserMaxUrlLength() {
        // Start with the default from config
        const configMax = window.CONFIG.MAX_URL_LENGTH || 8192;
        
        // Browser-specific limits
        const browserLimits = {
            // Internet Explorer has the lowest limit
            'Trident/': 2083,
            // Edge has a higher limit
            'Edge/': 4000,
            // Safari typically has a limit around 80K
            'Safari/': 80000
        };
        
        // Check user agent for known browsers with limits
        const userAgent = navigator.userAgent;
        for (const [browser, limit] of Object.entries(browserLimits)) {
            if (userAgent.indexOf(browser) !== -1) {
                console.log(`Detected browser with URL limit: ${browser} (${limit})`);
                return Math.min(configMax, limit);
            }
        }
        
        return configMax;
    }

    /**
     * Validate input file format against supported formats
     * @param {File} file - Input file
     * @returns {Object} - Validation result with status and error message
     */
    validateInputFormat(file) {
        if (!window.CONFIG.SUPPORTED_INPUT_FORMATS.includes(file.type)) {
            return {
                valid: false,
                error: `Unsupported format: ${file.type}`,
                details: `Supported formats: ${window.CONFIG.SUPPORTED_INPUT_FORMATS.join(', ')}`
            };
        }
        return {
            valid: true
        };
    }

    /**
     * Detect correct MIME type for file
     * @param {File} file - Input file
     * @returns {string} - Detected MIME type
     */
    detectMimeType(file) {
        // Use file.type as the starting point
        const declaredType = file.type;
        
        // If the type is empty or generic, try to detect from extension
        if (!declaredType || declaredType === 'application/octet-stream') {
            const extension = file.name.split('.').pop().toLowerCase();
            
            // Map common extensions to MIME types
            const extensionMap = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp',
                'svg': 'image/svg+xml',
                'bmp': 'image/bmp',
                'heic': 'image/heic',
                'heif': 'image/heif',
                'avif': 'image/avif'
            };
            
            return extensionMap[extension] || 'application/octet-stream';
        }
        
        return declaredType;
    }

    /**
     * Check if browser is a mobile device
     * @returns {boolean} - Is mobile device
     */
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    /**
     * Check for browser feature support
     * @returns {Object} - Browser capabilities
     */
    checkBrowserCapabilities() {
        // Check for required browser features
        const features = {
            fileAPI: typeof FileReader !== 'undefined' && !!window.File && !!window.FileReader && !!window.FileList && !!window.Blob,
            canvas: !!window.HTMLCanvasElement,
            webgl: (function() {
                try {
                    return !!window.WebGLRenderingContext && !!document.createElement('canvas').getContext('webgl');
                } catch(e) {
                    return false;
                }
            })(),
            webgl2: (function() {
                try {
                    return !!window.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2');
                } catch(e) {
                    return false;
                }
            })(),
            blobURL: !!window.URL && !!URL.createObjectURL,
            promises: typeof Promise !== 'undefined'
        };
        
        // Log support status
        console.log('Browser capabilities:', features);
        
        return features;
    }

    /**
     * Estimate browser performance for optimizing processing
     * @returns {Object} - Performance estimate
     */
    estimateBrowserPerformance() {
        // Rough estimation of browser performance
        const capabilities = this.checkBrowserCapabilities();
        const isMobile = this.isMobileDevice();
        
        // Simple scoring system
        let score = 0;
        if (capabilities.webgl2) score += 40;
        else if (capabilities.webgl) score += 20;
        if (capabilities.promises) score += 10;
        if (!isMobile) score += 20;
        
        // Add CPU cores as factor
        if (navigator.hardwareConcurrency) {
            score += Math.min(navigator.hardwareConcurrency * 5, 30);
        }
        
        return {
            score,
            category: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
            details: {
                capabilities,
                isMobile,
                cores: navigator.hardwareConcurrency || 'unknown'
            }
        };
    }

    /**
     * Check memory limits of the current browser/device
     * @returns {Object} - Memory limit information
     */
    checkMemoryLimits() {
        const limits = {
            // Estimation of memory limits
            maxArrayBufferSize: 2 * 1024 * 1024 * 1024, // 2GB default max
            deviceMemory: navigator.deviceMemory || 4, // in GB, default to 4GB
            lowMemoryMode: false
        };
        
        // Check if deviceMemory API is available
        if (navigator.deviceMemory) {
            limits.deviceMemory = navigator.deviceMemory;
            limits.lowMemoryMode = navigator.deviceMemory < 4; // Low memory if < 4GB
        }
        
        // Adjust maxArrayBufferSize based on device memory
        if (limits.deviceMemory < 2) {
            limits.maxArrayBufferSize = 512 * 1024 * 1024; // 512MB for low memory devices
        } else if (limits.deviceMemory < 4) {
            limits.maxArrayBufferSize = 1024 * 1024 * 1024; // 1GB for medium memory devices
        }
        
        return limits;
    }
};
