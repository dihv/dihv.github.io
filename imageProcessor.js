/**
 * Image Processor - Main Application Controller (Refactored)
 * Orchestrates the image processing pipeline by emitting events and using services
 * provided by the SystemManager. It does not directly manipulate the DOM or manage resources.
 */
window.ImageProcessor = class ImageProcessor {
    constructor(eventBus, configValidator, compressionEngine, analyzer, resourcePool) {
        this.eventBus = eventBus;
        this.config = configValidator;
        this.compressionEngine = compressionEngine;
        this.analyzer = analyzer;
        this.resourcePool = resourcePool;

        this.processingAborted = false;
        this.originalSize = 0;
        this.originalFormat = '';

        this.setupListeners();
        console.log('ImageProcessor initialized and ready.');
    }

    setupListeners() {
        this.eventBus.on('file:selected', ({ file }) => this.processFile(file));
        this.eventBus.on('file:dropped', ({ file }) => this.processFile(file));
        this.eventBus.on('processing:cancel', ({ reason }) => {
            this.processingAborted = true;
            console.log(`Processing aborted by event: ${reason}`);
        });
    }

    async processFile(file) {
        this.processingAborted = false;
        this.eventBus.emit('processing:started', { file });

        try {
            if (!this.config.get('SUPPORTED_INPUT_FORMATS', []).includes(file.type)) {
                throw new Error(`Unsupported format: ${file.type}`);
            }

            this.originalSize = file.size;
            this.originalFormat = file.type;
            this.eventBus.emit('metrics:original-image', { size: file.size, format: file.type });

            // Use the ResourcePool to create a preview URL
            const previewUrl = this.resourcePool.createObjectURL(file);
            this.eventBus.emit('ui:update-preview', { url: previewUrl });

            // Stage 1: Analysis
            this.eventBus.emit('processing:stage-changed', { stageName: 'analysis', message: 'Analyzing image...' });
            const analysisResults = await this.analyzer.analyzeImage(file);
            if (this.processingAborted) return;

            this.eventBus.emit('metrics:analysis-set', { analysis: analysisResults });
            this.eventBus.emit('ui:show-status', {
                message: `Analyzed ${analysisResults.analysis.classification}`,
                type: 'processing'
            });

            // Stage 2: Compression & Encoding
            this.eventBus.emit('processing:stage-changed', { stageName: 'compression', message: 'Optimizing image...' });

            // CORRECTED: Get config values using the get() method
            const maxUrlLength = this.config.get('MAX_URL_LENGTH', 800);
            const urlPrefix = this.config.get('URL_PREFIX', '');
            const effectiveMaxLength = maxUrlLength - (urlPrefix?.length || 0) - 50; // Safety buffer
            const compressionResult = await this.compressionEngine.compressImageHeuristic(file, analysisResults, effectiveMaxLength);

            if (this.processingAborted) return;

            if (!compressionResult || !compressionResult.success) {
                throw new Error('Unable to compress image to the required size.');
            }

            // Stage 3: Finalization
            this.eventBus.emit('processing:stage-changed', { stageName: 'finalizing', message: 'Generating final URL...' });
            // CORRECTED: Get config value using the get() method
            const finalUrl = (this.config.get('URL_PREFIX', '')) + compressionResult.data.encoded;

            this.eventBus.emit('metrics:processed-image', { size: compressionResult.data.size, format: compressionResult.data.format });
            this.eventBus.emit('processing:completed', { resultURL: finalUrl });

        } catch (error) {
            console.error("ImageProcessor error:", error);
            this.eventBus.emit('error', error);
            this.eventBus.emit('processing:completed', { error });
        }
    }

    /**
     * Cleans up the internal state of the ImageProcessor.
     * Note: This method no longer cleans up external resources like canvases or object URLs.
     * That responsibility has been moved to the ResourcePool, which is managed by the SystemManager.
     */
    cleanup() {
        // Ensure any ongoing processes are flagged to stop.
        this.processingAborted = true;

        // The event listeners on the EventBus will be cleared when the EventBus itself is cleaned up by the SystemManager.
        // There are no other resources (like timers or direct DOM references) owned by this class.
        console.log('ImageProcessor internal state cleaned up.');
    }
};