/**
 * browserUtils.js
 * 
 * Utilities for browser detection, capability checking, and environment limitations.
 * Updated to use centralized WebGLManager for all WebGL-related operations.
 */
window.BrowserUtils = class BrowserUtils {
    constructor(imageProcessor) {
        this.imageProcessor = imageProcessor;
        
        // Cache capabilities to avoid repeated checks
        this.cachedCapabilities = null;
        this.cachedPerformance = null;
        this.cachedMemoryLimits = null;
    }

    /**
     * Check if WebGL2 is supported by the browser using WebGLManager
     * @returns {boolean} - Whether WebGL2 is supported
     */
    checkWebGLSupport() {
        if (!window.webGLManager) {
            console.warn('WebGLManager not available for WebGL support check');
            return false;
        }
        
        return window.webGLManager.isWebGL2Supported();
    }

    /**
     * Get maximum URL length supported by the current browser
     * @returns {number} - Maximum URL length
     */
    getBrowserMaxUrlLength() {
        // Start with the default from config
        const configMax = window.CONFIG?.MAX_URL_LENGTH || 8192;
        
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
        if (!window.CONFIG?.SUPPORTED_INPUT_FORMATS?.includes(file.type)) {
            return {
                valid: false,
                error: `Unsupported format: ${file.type}`,
                details: `Supported formats: ${(window.CONFIG?.SUPPORTED_INPUT_FORMATS || []).join(', ')}`
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
     * Check for browser feature support using WebGLManager
     * @returns {Object} - Browser capabilities
     */
    checkBrowserCapabilities() {
        // Return cached result if available
        if (this.cachedCapabilities) {
            return this.cachedCapabilities;
        }
        
        // Get WebGL capabilities from manager
        let webglCapabilities = {};
        if (window.webGLManager) {
            const caps = window.webGLManager.getCapabilities();
            webglCapabilities = {
                webgl: caps.webgl,
                webgl2: caps.webgl2,
                maxTextureSize: caps.maxTextureSize || 0,
                vendor: caps.vendor || 'unknown',
                renderer: caps.renderer || 'unknown'
            };
        } else {
            console.warn('WebGLManager not available, using fallback WebGL detection');
            webglCapabilities = {
                webgl: this.fallbackWebGLCheck(),
                webgl2: this.fallbackWebGL2Check(),
                maxTextureSize: 0,
                vendor: 'unknown',
                renderer: 'unknown'
            };
        }
        
        // Check for other required browser features
        const features = {
            fileAPI: !!(window.File && window.FileReader && window.FileList && window.Blob),
            canvas: !!window.HTMLCanvasElement,
            blobURL: !!(window.URL && window.URL.createObjectURL),
            promises: typeof Promise !== 'undefined',
            deviceMemory: 'deviceMemory' in navigator,
            hardwareConcurrency: 'hardwareConcurrency' in navigator,
            ...webglCapabilities
        };
        
        // Log support status
        console.log('Browser capabilities:', features);
        
        // Cache the result
        this.cachedCapabilities = features;
        
        return features;
    }

    /**
     * Fallback WebGL check when WebGLManager is not available
     * @returns {boolean}
     */
    fallbackWebGLCheck() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');
            return !!gl;
        } catch (e) {
            return false;
        }
    }

    /**
     * Fallback WebGL2 check when WebGLManager is not available
     * @returns {boolean}
     */
    fallbackWebGL2Check() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2');
            return !!gl;
        } catch (e) {
            return false;
        }
    }

    /**
     * Estimate browser performance for optimizing processing
     * @returns {Object} - Performance estimate
     */
    estimateBrowserPerformance() {
        // Return cached result if available
        if (this.cachedPerformance) {
            return this.cachedPerformance;
        }
        
        const capabilities = this.checkBrowserCapabilities();
        const isMobile = this.isMobileDevice();
        
        // Simple scoring system
        let score = 0;
        
        // WebGL scoring
        if (capabilities.webgl2) {
            score += 40;
        } else if (capabilities.webgl) {
            score += 20;
        }
        
        // Other feature scoring
        if (capabilities.promises) score += 10;
        if (!isMobile) score += 20;
        
        // Add CPU cores as factor
        if (navigator.hardwareConcurrency) {
            score += Math.min(navigator.hardwareConcurrency * 5, 30);
        }
        
        // GPU performance factor
        if (window.webGLManager) {
            const caps = window.webGLManager.getCapabilities();
            if (caps.maxTextureSize >= 4096) score += 10;
            if (caps.maxTextureSize >= 8192) score += 10;
        }
        
        const performance = {
            score,
            category: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
            details: {
                capabilities,
                isMobile,
                cores: navigator.hardwareConcurrency || 'unknown',
                webglScore: capabilities.webgl2 ? 40 : capabilities.webgl ? 20 : 0
            }
        };
        
        // Cache the result
        this.cachedPerformance = performance;
        
        return performance;
    }

    /**
     * Check memory limits of the current browser/device
     * @returns {Object} - Memory limit information
     */
    checkMemoryLimits() {
        // Return cached result if available
        if (this.cachedMemoryLimits) {
            return this.cachedMemoryLimits;
        }
        
        const limits = {
            // Estimation of memory limits
            maxArrayBufferSize: 2 * 1024 * 1024 * 1024, // 2GB default max
            deviceMemory: navigator.deviceMemory || 4, // in GB, default to 4GB
            lowMemoryMode: false,
            gpuMemoryEstimate: 0
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
        
        // Get GPU memory estimate from WebGLManager if available
        if (window.webGLManager) {
            try {
                // Test memory limit for browser utils context
                limits.gpuMemoryEstimate = window.webGLManager.testMemoryLimit('browser-utils-test');
                // Clean up test context
                window.webGLManager.releaseContext('browser-utils-test');
            } catch (error) {
                console.warn('Failed to test GPU memory limits:', error);
                limits.gpuMemoryEstimate = 64 * 1024 * 1024; // 64MB fallback
            }
        }
        
        // Cache the result
        this.cachedMemoryLimits = limits;
        
        return limits;
    }

    /**
     * Get detailed WebGL information using WebGLManager
     * @returns {Object} - Detailed WebGL information
     */
    getWebGLInfo() {
        if (!window.webGLManager) {
            return {
                available: false,
                reason: 'WebGLManager not available'
            };
        }
        
        const capabilities = window.webGLManager.getCapabilities();
        
        return {
            available: capabilities.webgl2,
            version: capabilities.webgl2 ? '2.0' : capabilities.webgl ? '1.0' : 'none',
            capabilities: capabilities,
            vendor: capabilities.vendor,
            renderer: capabilities.renderer,
            maxTextureSize: capabilities.maxTextureSize,
            extensions: capabilities.extensions
        };
    }

    /**
     * Check if the browser supports specific image formats
     * @param {string} format - MIME type to check
     * @returns {Promise<boolean>} - Whether format is supported
     */
    async checkImageFormatSupport(format) {
        try {
            // Create a 1x1 pixel test image
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            
            return new Promise((resolve) => {
                canvas.toBlob((blob) => {
                    resolve(!!blob);
                }, format, 0.5);
            });
        } catch (error) {
            return false;
        }
    }

    /**
     * Get comprehensive browser environment report
     * @returns {Object} - Complete environment report
     */
    getEnvironmentReport() {
        const capabilities = this.checkBrowserCapabilities();
        const performance = this.estimateBrowserPerformance();
        const memoryLimits = this.checkMemoryLimits();
        const webglInfo = this.getWebGLInfo();
        
        return {
            browser: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform,
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine
            },
            capabilities,
            performance,
            memory: memoryLimits,
            webgl: webglInfo,
            screen: {
                width: screen.width,
                height: screen.height,
                colorDepth: screen.colorDepth,
                pixelDepth: screen.pixelDepth
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio || 1
            },
            config: {
                maxUrlLength: this.getBrowserMaxUrlLength(),
                supportedFormats: window.CONFIG?.SUPPORTED_INPUT_FORMATS || []
            },
            timestamp: Date.now()
        };
    }

    /**
     * Clear cached values (useful for re-testing after changes)
     */
    clearCache() {
        this.cachedCapabilities = null;
        this.cachedPerformance = null;
        this.cachedMemoryLimits = null;
        console.log('BrowserUtils cache cleared');
    }
};
