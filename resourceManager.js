/**
 * resourceManager.js
 * 
 * Handles resource tracking, allocation, and cleanup:
 * - Object URL management (creation, tracking, revocation)
 * - WebGL context and resource management
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
    }

    /**
     * Create and track object URLs
     * @param {Blob} blob - Blob to create URL for
     * @returns {string} Object URL
     */
    createAndTrackObjectURL(blob) {
        const url = URL.createObjectURL(blob);
        this.createdObjectURLs.add(url);
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
        }
    }

    /**
     * Clean up resources when component is destroyed
     */
    cleanup() {
        // Revoke all created object URLs
        for (const url of this.createdObjectURLs) {
            try {
                URL.revokeObjectURL(url);
            } catch (e) {
                console.warn('Failed to revoke object URL:', e);
            }
        }
        this.createdObjectURLs.clear();
        
        // Clean up encoder
        if (this.imageProcessor.encoder && typeof this.imageProcessor.encoder.cleanup === 'function') {
            try {
                this.imageProcessor.encoder.cleanup();
            } catch (e) {
                console.warn('Error cleaning up encoder:', e);
            }
        }
    }

    /**
     * Reinitialize encoder if WebGL context is lost
     * @returns {Promise<boolean>} Success of reinitialization
     */
    async reinitializeEncoder() {
        try {
            this.imageProcessor.encoder = new window.GPUBitStreamEncoder(window.CONFIG.SAFE_CHARS);
            
            // Apply benchmark results if available
            if (this.imageProcessor.benchmarkCompleted && this.imageProcessor.benchmark) {
                this.imageProcessor.benchmark.applyResults(this.imageProcessor.encoder);
            }
            
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
     * Uses a combination of WebGL2 metrics and heuristics to estimate available memory
     * 
     * @param {number} requiredBytes - Estimated memory needed for processing
     * @returns {boolean} - Whether sufficient memory is likely available
     */
    checkGPUMemoryAvailable(requiredBytes) {
        // Get WebGL context if not already initialized
        const gl = (this.imageProcessor.encoder && this.imageProcessor.encoder.gl) || 
                   document.createElement('canvas').getContext('webgl2');
        
        if (!gl) {
            console.warn('WebGL2 context not available for memory check');
            return true;  // Return true to allow CPU fallback to handle the processing
        }
    
        try {
            // Get maximum texture dimensions
            const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            const maxViewportDims = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
            
            // Get maximum texture image units
            const maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
            
            // Get maximum render buffer size
            const maxRenderBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
            
            // Calculate theoretical maximum GPU memory available
            // Each pixel can use 4 bytes (RGBA)
            const maxTheoretical = maxTextureSize * maxTextureSize * 4;
    
            // Check if WEBGL_debug_renderer_info is available
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            let gpuVendor = 'unknown';
            let gpuRenderer = 'unknown';
            
            if (debugInfo) {
                gpuVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                
                // Log GPU info for debugging
                console.log('GPU Vendor:', gpuVendor);
                console.log('GPU Renderer:', gpuRenderer);
            }
    
            // Perform a practical memory test
            const practicalLimit = this.testPracticalMemoryLimit(gl);
            
            // Calculate memory overhead for processing
            // We need:
            // 1. Input texture memory
            // 2. Output framebuffer memory
            // 3. Processing buffer memory
            // Plus 10% safety margin
            const totalRequired = requiredBytes * 3 * 1.2;
    
            // Check if required memory is within practical limits
            const isWithinPracticalLimit = totalRequired <= practicalLimit;
            
            // Log memory requirements for debugging
            console.log('Memory Check:', {
                required: totalRequired / (1024 * 1024) + ' MB',
                practical: practicalLimit / (1024 * 1024) + ' MB',
                theoretical: maxTheoretical / (1024 * 1024) + ' MB'
            });
    
            return isWithinPracticalLimit;
    
        } catch (error) {
            console.error('Error checking GPU memory:', error);
            return false;
        }
    }
    
    /**
     * Tests practical GPU memory limits by attempting to allocate increasingly large textures
     * Uses binary search to find the maximum reliable allocation size
     * 
     * @param {WebGL2RenderingContext} gl - WebGL2 context
     * @returns {number} - Practical memory limit in bytes
     */
    testPracticalMemoryLimit(gl) {
        if (!gl) return 1024 * 1024; // 1MB fallback
        
        // Start with reasonable bounds for binary search
        let low = 1024 * 1024;  // 1MB
        let high = 1024 * 1024 * 1024;  // 1GB
        let lastSuccessful = low;
        
        // Binary search for maximum allocation
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const size = Math.floor(Math.sqrt(mid / 4)); // 4 bytes per pixel
            
            try {
                // Try to allocate a texture of this size
                const texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, texture);
                
                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    gl.RGBA,
                    size,
                    size,
                    0,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    null
                );
                
                // Check for OUT_OF_MEMORY error
                const error = gl.getError();
                gl.deleteTexture(texture);
                
                if (error === gl.OUT_OF_MEMORY) {
                    high = mid - 1;
                } else {
                    lastSuccessful = mid;
                    low = mid + 1;
                }
            } catch (error) {
                high = mid - 1;
            }
        }
    
        // Return 80% of last successful allocation to ensure stable operation
        return Math.floor(lastSuccessful * 0.8);
    }

    /**
     * Attempts to obtain a WebGL2 context with optimal settings
     * @returns {WebGL2RenderingContext|null} The WebGL2 context or null if not available
     */
    obtainWebGLContext() {
        try {
            const canvas = document.createElement('canvas');
            const contextAttributes = {
                alpha: false,                // Don't need alpha channel in backbuffer
                depth: false,                // Don't need depth buffer
                stencil: false,              // Don't need stencil buffer
                antialias: false,            // Don't need antialiasing
                premultipliedAlpha: false,   // Avoid alpha premultiplication
                preserveDrawingBuffer: false, // Allow clear between frames
                failIfMajorPerformanceCaveat: true // Ensure good performance
            };
            
            const gl = canvas.getContext('webgl2', contextAttributes);
            
            if (!gl) {
                console.warn('WebGL2 not available');
                return null;
            }
            
            return gl;
        } catch (error) {
            console.error('Error obtaining WebGL context:', error);
            return null;
        }
    }

    /**
     * Releases WebGL resources to free up memory
     * @param {Object} resources - Object containing WebGL resources
     */
    releaseResources(resources) {
        const gl = this.imageProcessor.encoder && this.imageProcessor.encoder.gl;
        if (!gl) return;
        
        try {
            if (resources.textures && resources.textures.length) {
                resources.textures.forEach(texture => {
                    if (texture) gl.deleteTexture(texture);
                });
                resources.textures = [];
            }
            
            if (resources.buffers && resources.buffers.length) {
                resources.buffers.forEach(buffer => {
                    if (buffer) gl.deleteBuffer(buffer);
                });
                resources.buffers = [];
            }
            
            if (resources.framebuffers && resources.framebuffers.length) {
                resources.framebuffers.forEach(framebuffer => {
                    if (framebuffer) gl.deleteFramebuffer(framebuffer);
                });
                resources.framebuffers = [];
            }
            
            if (resources.renderbuffers && resources.renderbuffers.length) {
                resources.renderbuffers.forEach(renderbuffer => {
                    if (renderbuffer) gl.deleteRenderbuffer(renderbuffer);
                });
                resources.renderbuffers = [];
            }
        } catch (error) {
            console.warn('Error releasing WebGL resources:', error);
        }
    }
};