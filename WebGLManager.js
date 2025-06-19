/**
 * WebGLManager.js
 * 
 * Centralized WebGL and Canvas management to eliminate duplication
 * Handles context creation, capability detection, and resource management
 */
window.WebGLManager = class WebGLManager {
    constructor() {
        if (window.webGLManagerInstance) {
            return window.webGLManagerInstance;
        }
        
        // Singleton pattern
        window.webGLManagerInstance = this;
        
        this.capabilities = null;
        this.contexts = new Map(); // Track contexts by purpose
        this.canvases = new Map();  // Track canvases by purpose
        this.isWebGL2Available = null;
        this.maxTextureSize = null;
        this.contextLossHandlers = new Map();
        
        // Initialize capability detection
        this.detectCapabilities();
        
        console.log('WebGLManager initialized');
    }
    
    /**
     * Detect WebGL capabilities once and cache results
     */
    detectCapabilities() {
        if (this.capabilities) {
            return this.capabilities;
        }
        
        try {
            const testCanvas = document.createElement('canvas');
            const gl = testCanvas.getContext('webgl2', {
                alpha: false,
                depth: false,
                stencil: false,
                antialias: false,
                preserveDrawingBuffer: false,
                failIfMajorPerformanceCaveat: true
            });
            
            if (!gl) {
                this.isWebGL2Available = false;
                this.capabilities = {
                    webgl2: false,
                    webgl: this.checkWebGL1(),
                    maxTextureSize: 0,
                    extensions: [],
                    vendor: 'unknown',
                    renderer: 'unknown'
                };
                return this.capabilities;
            }
            
            this.isWebGL2Available = true;
            this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            
            // Get extensions
            const extensions = [
                'EXT_color_buffer_float',
                'OES_texture_float_linear',
                'WEBGL_debug_renderer_info',
                'WEBGL_lose_context'
            ].filter(ext => gl.getExtension(ext));
            
            // Get GPU info if available
            let vendor = 'unknown';
            let renderer = 'unknown';
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            }
            
            this.capabilities = {
                webgl2: true,
                webgl: true,
                maxTextureSize: this.maxTextureSize,
                maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
                maxTextureUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
                maxRenderBufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
                extensions: extensions,
                vendor: vendor,
                renderer: renderer
            };
            
            // Clean up test context
            const loseContext = gl.getExtension('WEBGL_lose_context');
            if (loseContext) {
                loseContext.loseContext();
            }
            
            console.log('WebGL capabilities detected:', this.capabilities);
            
        } catch (error) {
            console.warn('Error detecting WebGL capabilities:', error);
            this.isWebGL2Available = false;
            this.capabilities = {
                webgl2: false,
                webgl: this.checkWebGL1(),
                maxTextureSize: 0,
                extensions: [],
                vendor: 'unknown',
                renderer: 'unknown'
            };
        }
        
        return this.capabilities;
    }
    
    /**
     * Check WebGL 1.0 availability as fallback
     */
    checkWebGL1() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');
            return !!gl;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Get or create a WebGL2 context for specific purpose
     * @param {string} purpose - Purpose identifier (e.g., 'encoder', 'decoder', 'analysis')
     * @param {Object} options - Context creation options
     * @returns {WebGL2RenderingContext|null}
     */
    getWebGL2Context(purpose, options = {}) {
        // Return existing context if available
        if (this.contexts.has(purpose)) {
            const context = this.contexts.get(purpose);
            if (context && !context.isContextLost()) {
                return context;
            }
            // Clean up lost context
            this.contexts.delete(purpose);
            this.canvases.delete(purpose);
        }
        
        if (!this.isWebGL2Available) {
            console.warn(`WebGL2 not available for ${purpose}`);
            return null;
        }
        
        try {
            const canvas = document.createElement('canvas');
            const defaultOptions = {
                alpha: false,
                depth: false,
                stencil: false,
                antialias: false,
                premultipliedAlpha: false,
                preserveDrawingBuffer: false,
                failIfMajorPerformanceCaveat: true
            };
            
            const contextOptions = { ...defaultOptions, ...options };
            const gl = canvas.getContext('webgl2', contextOptions);
            
            if (!gl) {
                console.warn(`Failed to create WebGL2 context for ${purpose}`);
                return null;
            }
            
            // Store context and canvas
            this.contexts.set(purpose, gl);
            this.canvases.set(purpose, canvas);
            
            // Setup context loss handling
            this.setupContextLossHandling(canvas, gl, purpose);
            
            console.log(`WebGL2 context created for ${purpose}`);
            return gl;
            
        } catch (error) {
            console.error(`Error creating WebGL2 context for ${purpose}:`, error);
            return null;
        }
    }
    
    /**
     * Setup context loss and restoration handling
     * @param {HTMLCanvasElement} canvas 
     * @param {WebGL2RenderingContext} gl 
     * @param {string} purpose 
     */
    setupContextLossHandling(canvas, gl, purpose) {
        const onContextLost = (event) => {
            event.preventDefault();
            console.warn(`WebGL context lost for ${purpose}`);
            
            // Call registered handler if available
            const handler = this.contextLossHandlers.get(purpose);
            if (handler && handler.onLost) {
                handler.onLost();
            }
        };
        
        const onContextRestored = () => {
            console.log(`WebGL context restored for ${purpose}`);
            
            // Recreate context
            const newGl = this.getWebGL2Context(purpose);
            
            // Call registered handler if available
            const handler = this.contextLossHandlers.get(purpose);
            if (handler && handler.onRestored) {
                handler.onRestored(newGl);
            }
        };
        
        canvas.addEventListener('webglcontextlost', onContextLost, false);
        canvas.addEventListener('webglcontextrestored', onContextRestored, false);
    }
    
    /**
     * Register context loss handlers for a specific purpose
     * @param {string} purpose 
     * @param {Object} handlers - {onLost: function, onRestored: function}
     */
    registerContextLossHandlers(purpose, handlers) {
        this.contextLossHandlers.set(purpose, handlers);
    }
    
    /**
     * Get a 2D canvas context for image analysis/processing
     * @param {string} purpose - Purpose identifier
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @returns {Object} {canvas, ctx}
     */
    get2DContext(purpose, width = 300, height = 150) {
        const existingCanvas = this.canvases.get(`2d-${purpose}`);
        if (existingCanvas && existingCanvas.width === width && existingCanvas.height === height) {
            return {
                canvas: existingCanvas,
                ctx: existingCanvas.getContext('2d')
            };
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d', {
            alpha: true,
            willReadFrequently: true
        });
        
        if (!ctx) {
            throw new Error(`Failed to create 2D context for ${purpose}`);
        }
        
        this.canvases.set(`2d-${purpose}`, canvas);
        
        return { canvas, ctx };
    }
    
    /**
     * Check if WebGL2 is available
     * @returns {boolean}
     */
    isWebGL2Supported() {
        return this.isWebGL2Available;
    }
    
    /**
     * Get capabilities object
     * @returns {Object}
     */
    getCapabilities() {
        return this.capabilities;
    }
    
    /**
     * Test practical memory limit for a context
     * @param {string} purpose - Context purpose
     * @returns {number} - Memory limit in bytes
     */
    testMemoryLimit(purpose) {
        const gl = this.getWebGL2Context(purpose);
        if (!gl) return 1024 * 1024; // 1MB fallback
        
        let low = 1024 * 1024;  // 1MB
        let high = 1024 * 1024 * 1024;  // 1GB
        let lastSuccessful = low;
        
        // Binary search for maximum allocation
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const size = Math.floor(Math.sqrt(mid / 4)); // 4 bytes per pixel
            
            try {
                const texture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, texture);
                
                gl.texImage2D(
                    gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0,
                    gl.RGBA, gl.UNSIGNED_BYTE, null
                );
                
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
        
        return Math.floor(lastSuccessful * 0.8); // 80% for safety
    }
    
    /**
     * Release resources for a specific purpose
     * @param {string} purpose 
     */
    releaseContext(purpose) {
        const gl = this.contexts.get(purpose);
        if (gl) {
            const loseContext = gl.getExtension('WEBGL_lose_context');
            if (loseContext) {
                loseContext.loseContext();
            }
        }
        
        this.contexts.delete(purpose);
        this.canvases.delete(purpose);
        this.contextLossHandlers.delete(purpose);
        
        console.log(`Released WebGL context for ${purpose}`);
    }
    
    /**
     * Release all contexts and clean up
     */
    cleanup() {
        for (const purpose of this.contexts.keys()) {
            this.releaseContext(purpose);
        }
        
        console.log('WebGLManager cleaned up');
    }
    
    /**
     * Create shader program (utility method)
     * @param {WebGL2RenderingContext} gl 
     * @param {string} vertexSource 
     * @param {string} fragmentSource 
     * @returns {WebGLProgram}
     */
    createShaderProgram(gl, vertexSource, fragmentSource) {
        const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
        
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`Failed to link shader program: ${error}`);
        }
        
        return program;
    }
    
    /**
     * Compile shader (utility method)
     * @param {WebGL2RenderingContext} gl 
     * @param {number} type 
     * @param {string} source 
     * @returns {WebGLShader}
     */
    compileShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Failed to compile shader: ${error}`);
        }
        
        return shader;
    }
};

// Initialize global instance
window.webGLManager = new window.WebGLManager();
