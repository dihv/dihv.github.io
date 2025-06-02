/**
 * resourceManager.js
 * 
 * Handles resource tracking, allocation, and cleanup:
 * - Object URL management (creation, tracking, revocation)
 * - WebGL context and resource management via WebGLManager
 * - Memory monitoring and optimization
 */
window.ResourceManager = class ResourceManager {
    /**
     * Initialize resource manager
     * @param {ImageProcessor} imageProcessor - Reference to main image processor
     */
    constructor(imageProcessor) {
        this.imageProcessor = imageProcessor;
        
        // Track created object URLs for cleanup
        this.createdObjectURLs = new Set();
        
        // Track WebGL resources by context purpose
        this.webglResources = new Map();
        
        // Cache memory test results to avoid repeated testing
        this.memoryLimits = new Map();
        
        console.log('ResourceManager initialized');
    }

    /**
     * Create and track object URLs
     * @param {Blob} blob - Blob to create URL for
     * @returns {string} Object URL
     */
    createAndTrackObjectURL(blob) {
        const url = URL.createObjectURL(blob);
        this.createdObjectURLs.add(url);
        console.log(`Created and tracking object URL: ${url.substring(0, 50)}...`);
        return url;
    }

    /**
     * Revoke a tracked object URL
     * @param {string} url - URL to revoke
     */
    revokeTrackedObjectURL(url) {
        if (this.createdObjectURLs.has(url)) {
            URL.revokeObjectURL(url);
            this.createdObjectURLs.delete(url);
            console.log(`Revoked tracked object URL: ${url.substring(0, 50)}...`);
        }
    }

    /**
     * Clean up resources when component is destroyed
     */
    cleanup() {
        // Revoke all created object URLs
        console.log(`Cleaning up ${this.createdObjectURLs.size} object URLs`);
        for (const url of this.createdObjectURLs) {
            try {
                URL.revokeObjectURL(url);
            } catch (e) {
                console.warn('Failed to revoke object URL:', e);
            }
        }
        this.createdObjectURLs.clear();
        
        // Clean up WebGL resources through WebGLManager
        this.cleanupWebGLResources();
        
        // Clean up encoder
        if (this.imageProcessor.encoder && typeof this.imageProcessor.encoder.cleanup === 'function') {
            try {
                this.imageProcessor.encoder.cleanup();
            } catch (e) {
                console.warn('Error cleaning up encoder:', e);
            }
        }
        
        console.log('ResourceManager cleanup completed');
    }

    /**
     * Clean up WebGL resources for all tracked contexts
     */
    cleanupWebGLResources() {
        if (!window.webGLManager) {
            console.warn('WebGLManager not available for cleanup');
            return;
        }
        
        // Release each tracked context and its resources
        for (const [purpose, resources] of this.webglResources) {
            try {
                this.releaseWebGLResources(purpose, resources);
                window.webGLManager.releaseContext(purpose);
            } catch (error) {
                console.warn(`Error cleaning up WebGL resources for ${purpose}:`, error);
            }
        }
        
        this.webglResources.clear();
        this.memoryLimits.clear();
        
        console.log('WebGL resources cleaned up');
    }

    /**
     * Reinitialize encoder if WebGL context is lost
     * @returns {Promise<boolean>} Success of reinitialization
     */
    async reinitializeEncoder() {
        try {
            console.log('Reinitializing encoder after context loss...');
            
            // Create new encoder instance
            this.imageProcessor.encoder = new window.GPUBitStreamEncoder(window.CONFIG.SAFE_CHARS);
            
            // Apply benchmark results if available
            if (this.imageProcessor.benchmarkCompleted && this.imageProcessor.benchmark) {
                this.imageProcessor.benchmark.applyResults(this.imageProcessor.encoder);
            }
            
            console.log('Encoder reinitialized successfully');
            return true;
            
        } catch (error) {
            console.error('Failed to reinitialize encoder:', error);
            if (this.imageProcessor.metrics) {
                this.imageProcessor.metrics.recordError('Failed to reinitialize graphics processor');
            }
            return false;
        }
    }

    /**
     * Check if sufficient GPU memory is available for processing
     * Uses WebGLManager for consistent memory testing across the application
     * 
     * @param {number} requiredBytes - Estimated memory needed for processing
     * @param {string} purpose - Context purpose identifier (default: 'memory-test')
     * @returns {boolean} - Whether sufficient memory is likely available
     */
    checkGPUMemoryAvailable(requiredBytes, purpose = 'memory-test') {
        // Check if WebGLManager is available
        if (!window.webGLManager) {
            console.warn('WebGLManager not available for memory check');
            return true; // Allow CPU fallback to handle processing
        }
        
        // Check if WebGL2 is supported
        if (!window.webGLManager.isWebGL2Supported()) {
            console.info('WebGL2 not supported, using CPU processing');
            return true; // CPU fallback
        }
        
        try {
            // Get cached memory limit or test it
            let memoryLimit = this.memoryLimits.get(purpose);
            if (!memoryLimit) {
                memoryLimit = window.webGLManager.testMemoryLimit(purpose);
                this.memoryLimits.set(purpose, memoryLimit);
            }
            
            // Calculate total required memory with overhead
            // We need: input texture + output framebuffer + processing buffers + 20% safety margin
            const totalRequired = requiredBytes * 3 * 1.2;
            
            // Check if required memory is within practical limits
            const isWithinLimit = totalRequired <= memoryLimit;
            
            // Log memory check results
            console.log('GPU Memory Check:', {
                purpose: purpose,
                required: `${(totalRequired / (1024 * 1024)).toFixed(2)} MB`,
                available: `${(memoryLimit / (1024 * 1024)).toFixed(2)} MB`,
                withinLimit: isWithinLimit
            });
            
            return isWithinLimit;
            
        } catch (error) {
            console.error('Error checking GPU memory:', error);
            return false;
        }
    }

    /**
     * Get WebGL2 context for a specific purpose with resource tracking
     * @param {string} purpose - Purpose identifier
     * @param {Object} options - Context creation options
     * @returns {WebGL2RenderingContext|null}
     */
    getWebGLContext(purpose, options = {}) {
        if (!window.webGLManager) {
            console.warn('WebGLManager not available');
            return null;
        }
        
        const context = window.webGLManager.getWebGL2Context(purpose, options);
        
        if (context && !this.webglResources.has(purpose)) {
            // Initialize resource tracking for this context
            this.webglResources.set(purpose, {
                textures: [],
                buffers: [],
                framebuffers: [],
                renderbuffers: [],
                programs: []
            });
            
            // Register context loss handler for resource cleanup
            window.webGLManager.registerContextLossHandlers(purpose, {
                onLost: () => {
                    console.warn(`WebGL context lost for ${purpose}, clearing resource tracking`);
                    this.webglResources.delete(purpose);
                },
                onRestored: (newContext) => {
                    console.log(`WebGL context restored for ${purpose}, reinitializing resource tracking`);
                    this.webglResources.set(purpose, {
                        textures: [],
                        buffers: [],
                        framebuffers: [],
                        renderbuffers: [],
                        programs: []
                    });
                }
            });
        }
        
        return context;
    }

    /**
     * Track a WebGL resource for cleanup
     * @param {string} purpose - Context purpose
     * @param {string} type - Resource type ('texture', 'buffer', 'framebuffer', 'renderbuffer', 'program')
     * @param {WebGLObject} resource - WebGL resource object
     */
    trackWebGLResource(purpose, type, resource) {
        const resources = this.webglResources.get(purpose);
        if (resources && resources[type + 's']) {
            resources[type + 's'].push(resource);
        }
    }

    /**
     * Create and track a WebGL texture
     * @param {string} purpose - Context purpose
     * @param {WebGL2RenderingContext} gl - WebGL context
     * @param {Object} options - Texture options
     * @returns {WebGLTexture}
     */
    createTrackedTexture(purpose, gl, options = {}) {
        const texture = gl.createTexture();
        if (texture) {
            this.trackWebGLResource(purpose, 'texture', texture);
            
            // Apply default texture parameters if specified
            if (options.target) {
                gl.bindTexture(options.target, texture);
                
                if (options.minFilter) gl.texParameteri(options.target, gl.TEXTURE_MIN_FILTER, options.minFilter);
                if (options.magFilter) gl.texParameteri(options.target, gl.TEXTURE_MAG_FILTER, options.magFilter);
                if (options.wrapS) gl.texParameteri(options.target, gl.TEXTURE_WRAP_S, options.wrapS);
                if (options.wrapT) gl.texParameteri(options.target, gl.TEXTURE_WRAP_T, options.wrapT);
            }
        }
        return texture;
    }

    /**
     * Create and track a WebGL buffer
     * @param {string} purpose - Context purpose
     * @param {WebGL2RenderingContext} gl - WebGL context
     * @param {number} target - Buffer target (gl.ARRAY_BUFFER, etc.)
     * @param {ArrayBuffer|ArrayBufferView} data - Buffer data
     * @param {number} usage - Usage pattern (gl.STATIC_DRAW, etc.)
     * @returns {WebGLBuffer}
     */
    createTrackedBuffer(purpose, gl, target, data, usage) {
        const buffer = gl.createBuffer();
        if (buffer) {
            this.trackWebGLResource(purpose, 'buffer', buffer);
            gl.bindBuffer(target, buffer);
            gl.bufferData(target, data, usage);
        }
        return buffer;
    }

    /**
     * Create and track a WebGL framebuffer
     * @param {string} purpose - Context purpose
     * @param {WebGL2RenderingContext} gl - WebGL context
     * @returns {WebGLFramebuffer}
     */
    createTrackedFramebuffer(purpose, gl) {
        const framebuffer = gl.createFramebuffer();
        if (framebuffer) {
            this.trackWebGLResource(purpose, 'framebuffer', framebuffer);
        }
        return framebuffer;
    }

    /**
     * Releases WebGL resources for a specific purpose
     * @param {string} purpose - Context purpose
     * @param {Object} resources - Resources object or null to use tracked resources
     */
    releaseWebGLResources(purpose, resources = null) {
        const gl = window.webGLManager?.contexts?.get(purpose);
        if (!gl) {
            console.warn(`No WebGL context found for purpose: ${purpose}`);
            return;
        }
        
        // Use provided resources or get tracked resources
        const resourcesToRelease = resources || this.webglResources.get(purpose);
        if (!resourcesToRelease) {
            return;
        }
        
        try {
            // Release textures
            if (resourcesToRelease.textures) {
                resourcesToRelease.textures.forEach(texture => {
                    if (texture) gl.deleteTexture(texture);
                });
                resourcesToRelease.textures = [];
            }
            
            // Release buffers
            if (resourcesToRelease.buffers) {
                resourcesToRelease.buffers.forEach(buffer => {
                    if (buffer) gl.deleteBuffer(buffer);
                });
                resourcesToRelease.buffers = [];
            }
            
            // Release framebuffers
            if (resourcesToRelease.framebuffers) {
                resourcesToRelease.framebuffers.forEach(framebuffer => {
                    if (framebuffer) gl.deleteFramebuffer(framebuffer);
                });
                resourcesToRelease.framebuffers = [];
            }
            
            // Release renderbuffers
            if (resourcesToRelease.renderbuffers) {
                resourcesToRelease.renderbuffers.forEach(renderbuffer => {
                    if (renderbuffer) gl.deleteRenderbuffer(renderbuffer);
                });
                resourcesToRelease.renderbuffers = [];
            }
            
            // Release programs
            if (resourcesToRelease.programs) {
                resourcesToRelease.programs.forEach(program => {
                    if (program) gl.deleteProgram(program);
                });
                resourcesToRelease.programs = [];
            }
            
            console.log(`Released WebGL resources for purpose: ${purpose}`);
            
        } catch (error) {
            console.warn(`Error releasing WebGL resources for ${purpose}:`, error);
        }
    }

    /**
     * Get memory usage statistics
     * @returns {Object} Memory usage information
     */
    getMemoryStats() {
        const stats = {
            objectURLs: this.createdObjectURLs.size,
            webglContexts: this.webglResources.size,
            memoryLimitsKnown: this.memoryLimits.size
        };
        
        // Add WebGL capabilities if available
        if (window.webGLManager) {
            const capabilities = window.webGLManager.getCapabilities();
            stats.webglCapabilities = {
                webgl2Supported: capabilities.webgl2,
                maxTextureSize: capabilities.maxTextureSize,
                vendor: capabilities.vendor,
                renderer: capabilities.renderer
            };
        }
        
        // Add browser memory info if available
        if (performance.memory) {
            stats.jsHeap = {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit,
                usage: performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit
            };
        }
        
        return stats;
    }

    /**
     * Estimate memory requirements for image processing
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @param {number} channels - Number of channels (default 4 for RGBA)
     * @returns {Object} Memory requirement estimates
     */
    estimateMemoryRequirements(width, height, channels = 4) {
        const pixelCount = width * height;
        const bytesPerPixel = channels;
        
        const estimates = {
            inputTexture: pixelCount * bytesPerPixel,
            outputTexture: pixelCount * bytesPerPixel,
            processingBuffers: pixelCount * bytesPerPixel * 2, // Double buffering
            overhead: pixelCount * bytesPerPixel * 0.2, // 20% overhead
        };
        
        estimates.total = estimates.inputTexture + estimates.outputTexture + 
                         estimates.processingBuffers + estimates.overhead;
        
        return estimates;
    }

    /**
     * Check if image dimensions are within WebGL limits
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {boolean} Whether dimensions are supported
     */
    checkImageDimensions(width, height) {
        if (!window.webGLManager) {
            return true; // Allow CPU fallback
        }
        
        const capabilities = window.webGLManager.getCapabilities();
        const maxSize = capabilities.maxTextureSize || 2048;
        
        return width <= maxSize && height <= maxSize;
    }

    /**
     * Optimize memory usage by cleaning up unused resources
     */
    optimizeMemory() {
        console.log('Optimizing memory usage...');
        
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
        
        // Clean up unused object URLs (this is a simplified check)
        const urlsToRemove = [];
        for (const url of this.createdObjectURLs) {
            // Check if URL is still referenced in the DOM
            const images = document.querySelectorAll('img');
            let isReferenced = false;
            for (const img of images) {
                if (img.src === url) {
                    isReferenced = true;
                    break;
                }
            }
            if (!isReferenced) {
                urlsToRemove.push(url);
            }
        }
        
        // Remove unreferenced URLs
        urlsToRemove.forEach(url => this.revokeTrackedObjectURL(url));
        
        if (urlsToRemove.length > 0) {
            console.log(`Cleaned up ${urlsToRemove.length} unused object URLs`);
        }
        
        console.log('Memory optimization completed');
    }
};
