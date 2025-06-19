/**
 * ResourcePool.js
 * 
 * Centralized resource pooling and management system.
 * Handles canvas/context pooling, memory management, and resource lifecycle.
 */
window.ResourcePool = class ResourcePool {
    constructor(eventBus) {
        this.eventBus = eventBus;
        
        // Resource pools
        this.pools = {
            canvas2D: new Map(),      // 2D canvas contexts by size
            webglContexts: new Map(), // WebGL contexts by purpose
            objectURLs: new Set(),    // Created object URLs
            imageElements: [],        // Reusable image elements
            workers: []               // Web workers (if needed)
        };
        
        // Pool configuration
        this.config = {
            maxCanvas2D: 10,
            maxWebGLContexts: 5,
            maxImageElements: 20,
            maxObjectURLs: 100,
            cleanupInterval: 30000, // 30 seconds
            memoryThreshold: 0.8    // 80% memory usage
        };
        
        // Resource usage tracking
        this.usage = {
            canvas2D: 0,
            webglContexts: 0,
            objectURLs: 0,
            imageElements: 0,
            totalMemory: 0
        };
        
        // Cleanup and monitoring
        this.cleanupInterval = null;
        this.memoryMonitor = null;
        
        this.startResourceMonitoring();
        
        console.log('ResourcePool initialized');
    }

    /**
     * Get or create a 2D canvas context with specified dimensions
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {Object} options - Canvas options
     * @returns {Object} {canvas, ctx, release}
     */
    get2DCanvas(width, height, options = {}) {
        const key = `${width}x${height}`;
        const pool = this.pools.canvas2D.get(key) || [];
        
        // Try to reuse existing canvas
        for (let i = 0; i < pool.length; i++) {
            const item = pool[i];
            if (!item.inUse) {
                item.inUse = true;
                item.lastUsed = Date.now();
                this.usage.canvas2D++;
                
                // Clear canvas for reuse
                this.clearCanvas(item.ctx, width, height);
                
                return {
                    canvas: item.canvas,
                    ctx: item.ctx,
                    release: () => this.release2DCanvas(key, item)
                };
            }
        }
        
        // Create new canvas if pool not full
        if (pool.length < this.config.maxCanvas2D) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d', {
                alpha: options.alpha !== false,
                willReadFrequently: options.willReadFrequently || false,
                ...options
            });
            
            if (!ctx) {
                throw new Error('Failed to create 2D canvas context');
            }
            
            const item = {
                canvas,
                ctx,
                inUse: true,
                created: Date.now(),
                lastUsed: Date.now()
            };
            
            pool.push(item);
            this.pools.canvas2D.set(key, pool);
            this.usage.canvas2D++;
            
            return {
                canvas,
                ctx,
                release: () => this.release2DCanvas(key, item)
            };
        }
        
        // Pool is full, wait for available context or create disposable one
        console.warn(`2D canvas pool full for ${key}, creating disposable canvas`);
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', options);
        
        return {
            canvas,
            ctx,
            release: () => {} // Disposable, no release needed
        };
    }

    /**
     * Get or create a WebGL context for specific purpose
     * @param {string} purpose - Context purpose identifier
     * @param {Object} options - WebGL context options
     * @returns {Object} {gl, canvas, release}
     */
    getWebGLContext(purpose, options = {}) {
        // Check if context already exists for this purpose
        const existing = this.pools.webglContexts.get(purpose);
        if (existing && existing.gl && !existing.gl.isContextLost()) {
            existing.inUse = true;
            existing.lastUsed = Date.now();
            this.usage.webglContexts++;
            
            return {
                gl: existing.gl,
                canvas: existing.canvas,
                release: () => this.releaseWebGLContext(purpose)
            };
        }
        
        // Create new WebGL context
        if (this.pools.webglContexts.size < this.config.maxWebGLContexts) {
            try {
                const canvas = document.createElement('canvas');
                const defaultOptions = {
                    alpha: false,
                    depth: false,
                    stencil: false,
                    antialias: false,
                    preserveDrawingBuffer: false,
                    failIfMajorPerformanceCaveat: true
                };
                
                const contextOptions = { ...defaultOptions, ...options };
                const gl = canvas.getContext('webgl2', contextOptions) || 
                          canvas.getContext('webgl', contextOptions);
                
                if (!gl) {
                    throw new Error('WebGL not available');
                }
                
                // Setup context loss handling
                this.setupWebGLContextLoss(canvas, gl, purpose);
                
                const contextItem = {
                    gl,
                    canvas,
                    purpose,
                    inUse: true,
                    created: Date.now(),
                    lastUsed: Date.now()
                };
                
                this.pools.webglContexts.set(purpose, contextItem);
                this.usage.webglContexts++;
                
                return {
                    gl,
                    canvas,
                    release: () => this.releaseWebGLContext(purpose)
                };
                
            } catch (error) {
                console.error(`Failed to create WebGL context for ${purpose}:`, error);
                throw error;
            }
        }
        
        throw new Error('WebGL context pool full');
    }

    /**
     * Create and track object URL
     * @param {Blob} blob - Blob to create URL for
     * @returns {string} Object URL
     */
    createObjectURL(blob) {
        if (this.pools.objectURLs.size >= this.config.maxObjectURLs) {
            this.cleanupOldObjectURLs();
        }
        
        const url = URL.createObjectURL(blob);
        this.pools.objectURLs.add({
            url,
            created: Date.now(),
            size: blob.size
        });
        
        this.usage.objectURLs++;
        
        return url;
    }

    /**
     * Revoke and remove object URL
     * @param {string} url - URL to revoke
     */
    revokeObjectURL(url) {
        try {
            URL.revokeObjectURL(url);
            
            // Remove from tracking
            for (const item of this.pools.objectURLs) {
                if (item.url === url) {
                    this.pools.objectURLs.delete(item);
                    this.usage.objectURLs--;
                    break;
                }
            }
        } catch (error) {
            console.warn('Error revoking object URL:', error);
        }
    }

    /**
     * Get or create reusable image element
     * @returns {HTMLImageElement}
     */
    getImageElement() {
        // Find unused image element
        for (const img of this.pools.imageElements) {
            if (!img.inUse) {
                img.inUse = true;
                img.lastUsed = Date.now();
                
                // Reset image element
                img.src = '';
                img.onload = null;
                img.onerror = null;
                
                return {
                    element: img,
                    release: () => this.releaseImageElement(img)
                };
            }
        }
        
        // Create new image element if pool not full
        if (this.pools.imageElements.length < this.config.maxImageElements) {
            const img = new Image();
            img.inUse = true;
            img.created = Date.now();
            img.lastUsed = Date.now();
            
            this.pools.imageElements.push(img);
            this.usage.imageElements++;
            
            return {
                element: img,
                release: () => this.releaseImageElement(img)
            };
        }
        
        // Pool full, create disposable element
        console.warn('Image element pool full, creating disposable element');
        return {
            element: new Image(),
            release: () => {} // Disposable
        };
    }

    /**
     * Optimize memory usage
     * @param {string} level - Optimization level (mild, aggressive, emergency)
     */
    optimizeMemory(level = 'mild') {
        console.log(`Optimizing memory usage: ${level} level`);
        
        switch (level) {
            case 'mild':
                this.cleanupUnusedResources();
                break;
                
            case 'aggressive':
                this.cleanupUnusedResources();
                this.reducePoolSizes();
                this.forceGarbageCollection();
                break;
                
            case 'emergency':
                this.clearAllPools();
                this.forceGarbageCollection();
                break;
        }
        
        // Emit memory optimization event
        this.eventBus.emit('resource-pool:memory-optimized', {
            level,
            usage: this.getUsageStats()
        });
    }

    /**
     * Release 2D canvas back to pool
     * @private
     */
    release2DCanvas(key, item) {
        item.inUse = false;
        this.usage.canvas2D--;
    }

    /**
     * Release WebGL context
     * @private
     */
    releaseWebGLContext(purpose) {
        const item = this.pools.webglContexts.get(purpose);
        if (item) {
            item.inUse = false;
            this.usage.webglContexts--;
        }
    }

    /**
     * Release image element back to pool
     * @private
     */
    releaseImageElement(img) {
        img.inUse = false;
        this.usage.imageElements--;
        
        // Clear image to prevent memory leaks
        img.src = '';
        img.onload = null;
        img.onerror = null;
    }

    /**
     * Clear canvas for reuse
     * @private
     */
    clearCanvas(ctx, width, height) {
        ctx.clearRect(0, 0, width, height);
        ctx.resetTransform();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.filter = 'none';
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'low';
    }

    /**
     * Setup WebGL context loss handling
     * @private
     */
    setupWebGLContextLoss(canvas, gl, purpose) {
        canvas.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            console.warn(`WebGL context lost for ${purpose}`);
            
            // Remove from pool
            this.pools.webglContexts.delete(purpose);
            
            // Emit context loss event
            this.eventBus.emit('resource-pool:webgl-context-lost', { purpose });
        });
        
        canvas.addEventListener('webglcontextrestored', () => {
            console.log(`WebGL context restored for ${purpose}`);
            
            // Emit context restored event
            this.eventBus.emit('resource-pool:webgl-context-restored', { purpose });
        });
    }

    /**
     * Start resource monitoring
     * @private
     */
    startResourceMonitoring() {
        // Periodic cleanup
        this.cleanupInterval = setInterval(() => {
            this.cleanupUnusedResources();
        }, this.config.cleanupInterval);
        
        // Memory monitoring
        if (performance.memory) {
            this.memoryMonitor = setInterval(() => {
                const memoryUsage = performance.memory.usedJSHeapSize / 
                                  performance.memory.jsHeapSizeLimit;
                
                if (memoryUsage > this.config.memoryThreshold) {
                    this.optimizeMemory('aggressive');
                }
            }, 10000); // Check every 10 seconds
        }
    }

    /**
     * Cleanup unused resources
     * @private
     */
    cleanupUnusedResources() {
        const now = Date.now();
        const maxAge = 300000; // 5 minutes
        
        // Cleanup old 2D canvases
        for (const [key, pool] of this.pools.canvas2D) {
            const filtered = pool.filter(item => {
                if (!item.inUse && (now - item.lastUsed) > maxAge) {
                    return false; // Remove old unused canvas
                }
                return true;
            });
            
            if (filtered.length === 0) {
                this.pools.canvas2D.delete(key);
            } else {
                this.pools.canvas2D.set(key, filtered);
            }
        }
        
        // Cleanup old WebGL contexts
        for (const [purpose, item] of this.pools.webglContexts) {
            if (!item.inUse && (now - item.lastUsed) > maxAge) {
                // Force context loss to free GPU memory
                const loseContext = item.gl.getExtension('WEBGL_lose_context');
                if (loseContext) {
                    loseContext.loseContext();
                }
                this.pools.webglContexts.delete(purpose);
            }
        }
        
        // Cleanup old object URLs
        this.cleanupOldObjectURLs();
        
        // Cleanup old image elements
        this.pools.imageElements = this.pools.imageElements.filter(img => {
            if (!img.inUse && (now - img.lastUsed) > maxAge) {
                return false;
            }
            return true;
        });
    }

    /**
     * Cleanup old object URLs
     * @private
     */
    cleanupOldObjectURLs() {
        const now = Date.now();
        const maxAge = 600000; // 10 minutes
        
        for (const item of this.pools.objectURLs) {
            if ((now - item.created) > maxAge) {
                this.revokeObjectURL(item.url);
            }
        }
    }

    /**
     * Reduce pool sizes for memory optimization
     * @private
     */
    reducePoolSizes() {
        // Reduce 2D canvas pools
        for (const [key, pool] of this.pools.canvas2D) {
            const maxSize = Math.max(1, Math.floor(this.config.maxCanvas2D / 2));
            if (pool.length > maxSize) {
                const toRemove = pool.splice(maxSize);
                // Removed canvases will be garbage collected
            }
        }
        
        // Reduce image element pool
        const maxImages = Math.max(5, Math.floor(this.config.maxImageElements / 2));
        if (this.pools.imageElements.length > maxImages) {
            this.pools.imageElements.splice(maxImages);
        }
    }

    /**
     * Clear all pools (emergency memory optimization)
     * @private
     */
    clearAllPools() {
        console.warn('Emergency: Clearing all resource pools');
        
        // Clear 2D canvas pools
        this.pools.canvas2D.clear();
        
        // Clear WebGL contexts
        for (const [purpose, item] of this.pools.webglContexts) {
            const loseContext = item.gl.getExtension('WEBGL_lose_context');
            if (loseContext) {
                loseContext.loseContext();
            }
        }
        this.pools.webglContexts.clear();
        
        // Clear object URLs
        for (const item of this.pools.objectURLs) {
            this.revokeObjectURL(item.url);
        }
        
        // Clear image elements
        this.pools.imageElements = [];
        
        // Reset usage counters
        this.usage = {
            canvas2D: 0,
            webglContexts: 0,
            objectURLs: 0,
            imageElements: 0,
            totalMemory: 0
        };
    }

    /**
     * Force garbage collection if available
     * @private
     */
    forceGarbageCollection() {
        if (window.gc) {
            try {
                window.gc();
                console.log('Forced garbage collection');
            } catch (error) {
                console.warn('Failed to force garbage collection:', error);
            }
        }
    }

    /**
     * Get resource usage statistics
     * @returns {Object} Usage statistics
     */
    getUsageStats() {
        const stats = {
            usage: { ...this.usage },
            pools: {
                canvas2D: this.pools.canvas2D.size,
                webglContexts: this.pools.webglContexts.size,
                objectURLs: this.pools.objectURLs.size,
                imageElements: this.pools.imageElements.length
            },
            memory: null
        };
        
        // Add memory info if available
        if (performance.memory) {
            stats.memory = {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit,
                usage: performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit
            };
        }
        
        return stats;
    }

    /**
     * Cleanup all resources
     */
    cleanup() {
        // Stop monitoring
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        if (this.memoryMonitor) {
            clearInterval(this.memoryMonitor);
        }
        
        // Clear all pools
        this.clearAllPools();
        
        console.log('ResourcePool cleaned up');
    }
};