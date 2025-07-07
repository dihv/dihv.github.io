/**
 * @file WebGLManager.js
 * @description Manages WebGL context, capabilities, and GPU-accelerated tasks.
 */

class WebGLManager {
    constructor() {
        this.gl = null;
        this.canvas = null;
        this.gpuInfo = 'N/A';
    }

    /**
     * Initializes the WebGL context.
     */
    initialize() {
        try {
            this.canvas = document.createElement('canvas');
            // We don't need to append it to the body unless for debugging
            this.gl = this.canvas.getContext('webgl', { antialias: false }) || this.canvas.getContext('experimental-webgl');

            if (!this.gl) {
                console.warn("WebGL is not supported or is disabled.");
                return;
            }

            this.getGPUInfo();

        } catch (error) {
            console.error("Error initializing WebGLManager:", error);
            // Potentially dispatch an event or use an error handler
        }
    }

    /**
     * Retrieves information about the GPU and renderer.
     * This has been updated to use the modern, non-deprecated API.
     */
    getGPUInfo() {
        const gl = this.gl;
        if (!gl) return;

        // The 'WEBGL_debug_renderer_info' extension is deprecated in many browsers.
        // The standard `gl.RENDERER` parameter provides the necessary information.
        const rendererInfo = gl.getParameter(gl.RENDERER);

        if (rendererInfo) {
            this.gpuInfo = rendererInfo;
        } else {
            // Fallback for older browsers or unusual circumstances
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                this.gpuInfo = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            } else {
                this.gpuInfo = "Could not determine GPU info.";
            }
        }

        console.log(`GPU Info: ${this.gpuInfo}`);
    }

    /**
     * Returns the WebGL rendering context.
     * @returns {WebGLRenderingContext | null} The WebGL context.
     */
    getContext() {
        return this.gl;
    }
}
