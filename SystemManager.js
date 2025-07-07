/**
 * @file SystemManager.js
 * @description Centralized manager for initializing and coordinating all modules.
 * This manager is responsible for loading all dependent scripts, initializing
 * various managers (UI, WebGL, Debug, etc.), and setting up the application
 * based on the current page context (uploader vs. viewer).
 */

class SystemManager {

    /**
     * Loads a single script dynamically.
     * @param {string} src - The source URL of the script to load.
     * @returns {Promise<HTMLScriptElement>} A promise that resolves when the script is loaded.
     */
    static _loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = false; // Load scripts in order
            script.onload = () => {
                console.log(`Script loaded: ${src}`);
                resolve(script);
            };
            script.onerror = () => {
                console.error(`Script load error for ${src}`);
                reject(new Error(`Script load error for ${src}`));
            };
            document.head.append(script);
        });
    }

    /**
     * Loads all necessary dependent scripts for the application.
     * The order is important for dependencies between modules.
     */
    static async _loadDependencies() {
        // List of scripts to load. Order can matter if scripts have dependencies.
        const scripts = [
            'ErrorHandler.js',
            'EventBus.js',
            'SharedUtils.js',
            'DebugManager.js',
            'UIManager.js',
            'WebGLManager.js',
            'ResourcePool.js',
            'UnifiedPerformanceMonitor.js',
            'ConfigValidator.js',
            'DirectBaseEncoder.js',
            'BitStreamDecoder.js',
            'BitStreamEncoder.js',
            'ImageAnalyzer.js',
            'compressionEngine.js',
            'imageProcessor.js',
            'imageViewer.js'
        ];

        console.log("Loading dependent scripts...");
        try {
            for (const script of scripts) {
                await this._loadScript(script);
            }
            console.log("All dependent scripts loaded successfully.");
        } catch (error) {
            console.error("Fatal error: Failed to load dependent scripts.", error);
            // If script loading fails, we can't do much else.
            document.body.innerHTML = '<h1>Application Error</h1><p>Could not load required application files. Please check the console for details.</p>';
            throw error; // Stop execution
        }
    }

    /**
     * Initializes the entire system.
     * This is the main entry point for the application.
     * @param {object} config - The application configuration object from config.js.
     */
    static async initialize(config) {
        try {
            // First, load all other JavaScript files.
            await this._loadDependencies();

            this.config = config;
            console.log("SystemManager initializing with config:", this.config);

            // Validate the configuration file to catch issues early.
            ConfigValidator.validate(this.config);

            // Setup global error handling early.
            this.errorHandler = new ErrorHandler();
            window.onerror = (message, source, lineno, colno, error) => {
                this.errorHandler.handle(error || new Error(message));
                return true; // Prevents the firing of the default event handler.
            };
            window.onunhandledrejection = event => {
                this.errorHandler.handle(event.reason);
            };

            // Initialize core managers.
            this.eventBus = new EventBus();
            this.debugManager = new DebugManager(this.eventBus, this.config.debug);
            this.uiManager = new UIManager(this.eventBus);
            this.webGLManager = new WebGLManager();
            this.resourcePool = new ResourcePool();
            this.performanceMonitor = new UnifiedPerformanceMonitor(this.eventBus, window.performance);
            this.imageAnalyzer = new ImageAnalyzer(this.config);

            // Initialize the managers that have an init step.
            this.uiManager.initialize();
            this.webGLManager.initialize();
            
            console.log("Core managers initialized.");

            // Determine page context (uploader or viewer) and setup accordingly.
            if (document.getElementById('image-upload-section')) {
                this.setupImageProcessing();
            } else if (document.getElementById('image-display')) {
                this.setupImageViewer();
            } else {
                console.warn("Could not determine page context. No main component initialized.");
            }

            console.log("SystemManager initialized successfully.");

        } catch (error) {
            console.error("A fatal error occurred during SystemManager initialization:", error);
            if (this.errorHandler) {
                this.errorHandler.handle(error);
            }
            // Display a user-friendly error on the screen as a last resort.
            document.body.innerHTML = `<div style="padding: 2em; text-align: center;"><h1>Application Initialization Error</h1><p>The application could not start. Please check the developer console for more details.</p><p><i>Error: ${error.message}</i></p></div>`;
        }
    }

    /**
     * Sets up the components required for the image processing page (index.html).
     */
    static setupImageProcessing() {
        console.log("Setting up for image processing (index.html).");
        this.imageProcessor = new ImageProcessor(
            this.config,
            this.uiManager
        );
        // The ImageProcessor's constructor handles its own event listener setup.
    }

    /**
     * Sets up the components required for the image viewing page (404.html).
     */
    static setupImageViewer() {
        console.log("Setting up for image viewing (404.html).");
        this.imageViewer = new ImageViewer(
            this.config,
            this.uiManager
        );
        // The viewer needs to be explicitly told to start decoding.
        this.imageViewer.decodeAndDisplay();
    }
}
