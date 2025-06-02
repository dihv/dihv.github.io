/**
 * Image Processor - Main Application Controller
 * 
 * Orchestrates the complete image processing pipeline from upload to URL generation.
 * Manages compression, encoding, format optimization, and user interface updates.
 * 
 * Key Responsibilities:
 * - Dependency validation and component initialization
 * - Image analysis and format optimization
 * - Compression parameter optimization
 * - Progress tracking and error handling
 * - UI state management and resource cleanup
 */
window.ImageProcessor = class ImageProcessor {
    /**
     * Initialize the image processor with all required components
     * @throws {Error} If required dependencies are not available
     */
    constructor() {
        // Prevent duplicate initialization
        if (window.imageProcessorInstance) {
            console.warn('ImageProcessor already initialized, returning existing instance');
            return window.imageProcessorInstance;
        }
        
        // Validate dependencies before proceeding
        if (!this.checkDependencies()) {
            throw new Error('Required dependencies not available - ensure all scripts are loaded');
        }
        
        // Initialize core components
        this.initializeComponents();
        
        // Initialize encoder (separate from decoder now)
        this.initializeEncoder();
        
        // Initialize processing modules
        this.initializeProcessingModules();
        
        // Initialize monitoring and UI
        this.initializeMonitoringAndUI();
        
        // Setup event handling and finalize initialization
        this.finalizeInitialization();
        
        // Store singleton instance
        window.imageProcessorInstance = this;
        
        console.log('✅ ImageProcessor initialized successfully');
    }

    /**
     * Initialize core utility components
     */
    initializeComponents() {
        this.browserUtils = new window.BrowserUtils(this);
        this.resourceManager = new window.ResourceManager(this);
        this.uiController = new window.UIController(this);
        
        // Set browser-specific URL length limits
        this.maxSize = this.browserUtils.getBrowserMaxUrlLength();
        
        console.log(`📏 Maximum URL length: ${this.maxSize} characters`);
    }

    /**
     * Initialize the encoder with comprehensive error handling
     * Note: Decoder is now separate and will be used directly when needed
     */
    initializeEncoder() {
        try {
            if (!window.GPUBitStreamEncoder) {
                throw new Error('GPUBitStreamEncoder is not available. Please check script loading.');
            }
            
            if (!window.CONFIG || !window.CONFIG.SAFE_CHARS) {
                throw new Error('Configuration not available. Please check config.js loading.');
            }
            
            this.encoder = new window.GPUBitStreamEncoder(window.CONFIG.SAFE_CHARS);
            
            // Log encoder capabilities
            console.log(`🔧 Encoder initialized: ${this.encoder.RADIX}-character set`);
            console.log(`⚡ GPU acceleration: ${this.encoder.gpuAccelerationEnabled ? 'Available' : 'CPU fallback'}`);
            
        } catch (error) {
            console.error('Failed to initialize encoder:', error);
            throw new Error(`Encoder initialization failed: ${error.message}`);
        }
    }

    /**
     * Initialize image processing modules
     */
    initializeProcessingModules() {
        // Initialize compression engine
        this.compressionEngine = new window.CompressionEngine(this);
        
        // Initialize image analyzer (optional)
        this.initializeAnalyzer();
        
        // Track processing state
        this.resetProcessingState();
    }

    /**
     * Initialize monitoring and UI components
     */
    initializeMonitoringAndUI() {
        // Initialize metrics tracking
        this.initializeMetrics();
        
        // Initialize advanced UI components
        this.initializeAdvancedUI();
        
        // Initialize benchmark system
        this.initializeBenchmark();
        
        // Complete UI setup
        this.uiController.setupUI();
    }

    /**
     * Finalize initialization with event binding
     */
    finalizeInitialization() {
        this.bindEvents();
        
        // Set initial UI state
        this.resetProcessingState();
    }

    /**
     * Reset processing state for new operations
     */
    resetProcessingState() {
        this.originalSize = 0;
        this.processedSize = 0;
        this.originalFormat = '';
        this.processedFormat = '';
        this.processingAborted = false;
    }
    
    /**
     * Initialize analyzer component with error handling
     */
    initializeAnalyzer() {
        if (!window.ImageAnalyzer) {
            console.info('ImageAnalyzer not found. Basic analysis will be used.');
            this.analyzer = null;
        } else {
            try {
                this.analyzer = new window.ImageAnalyzer();
                console.log('🔬 ImageAnalyzer initialized');
            } catch (error) {
                console.error('Failed to initialize ImageAnalyzer:', error);
                this.analyzer = null;
            }
        }
    }
    
    /**
     * Initialize metrics tracking system
     */
    initializeMetrics() {
        if (!window.ProcessingMetrics) {
            console.info('ProcessingMetrics not found. Metrics tracking will be disabled.');
            this.metrics = this.createFallbackMetrics();
        } else {
            try {
                this.metrics = new window.ProcessingMetrics({
                    progressBar: document.getElementById('progressBar'),
                    statusDisplay: document.getElementById('status'),
                    metricsDisplay: document.getElementById('imageStats'),
                    metricsFields: {
                        originalSize: document.getElementById('originalSize'),
                        processedSize: document.getElementById('processedSize'),
                        originalFormat: document.getElementById('originalFormat'),
                        finalFormat: document.getElementById('finalFormat'),
                        compressionRatio: document.getElementById('compressionRatio'),
                        elapsedTime: document.getElementById('elapsedTime'),
                        attempts: document.getElementById('attempts')
                    },
                    cancelButton: document.getElementById('cancelProcessing')
                });
                console.log('📊 ProcessingMetrics initialized');
            } catch (error) {
                console.error('Failed to initialize ProcessingMetrics:', error);
                this.metrics = this.createFallbackMetrics();
            }
        }
    }
    
    /**
     * Initialize advanced UI components
     */
    initializeAdvancedUI() {
        if (!window.AdvancedUI) {
            console.info('AdvancedUI not found. Advanced UI features will be disabled.');
            this.advancedUI = { initialize: () => {} };
        } else {
            try {
                // Check for existing instance to prevent duplicates
                if (window.advancedUIInstance) {
                    console.info('AdvancedUI already initialized, reusing existing instance');
                    this.advancedUI = window.advancedUIInstance;
                } else {
                    this.advancedUI = new window.AdvancedUI();
                    window.advancedUIInstance = this.advancedUI;
                    this.advancedUI.initialize();
                    console.log('🎨 AdvancedUI initialized');
                }
            } catch (error) {
                console.error('Failed to initialize AdvancedUI:', error);
                this.advancedUI = { initialize: () => {} };
            }
        }
    }
    
    /**
     * Initialize benchmark system
     */
    initializeBenchmark() {
        this.benchmarkCompleted = false;
        this.benchmarkPromise = null;
        
        if (window.BitStreamBenchmark) {
            try {
                // Check for existing instance
                if (window.benchmarkInstance) {
                    console.info('Benchmark already initialized, reusing existing instance');
                    this.benchmark = window.benchmarkInstance;
                } else {
                    this.benchmark = new window.BitStreamBenchmark();
                    window.benchmarkInstance = this.benchmark;
                }
                
                // Setup benchmark completion handling
                this.setupBenchmarkHandling();
                
                // Start benchmark
                this.benchmarkPromise = this.benchmark.runBenchmark();
                console.log('🏁 Benchmark system initialized');
                
            } catch (error) {
                console.error('Failed to initialize benchmark:', error);
                this.benchmark = null;
            }
        } else {
            console.info('BitStreamBenchmark not found. Performance optimization will be limited.');
        }
    }

    /**
     * Setup benchmark completion event handling
     */
    setupBenchmarkHandling() {
        document.addEventListener('bitstream-benchmark-completed', (event) => {
            this.benchmarkCompleted = true;
            console.log('Benchmark completed:', event.detail);
            
            // Apply optimization results
            if (this.benchmark && typeof this.benchmark.applyOptimizations === 'function') {
                this.benchmark.applyOptimizations();
            }
            
            // Apply results to encoder if available
            if (this.encoder && typeof this.benchmark.applyResults === 'function') {
                this.benchmark.applyResults(this.encoder);
            }
        });
    }

    /**
     * Validate that all required dependencies are available
     * @returns {boolean} Whether all core dependencies are present
     */
    checkDependencies() {
        const required = [
            { name: 'CONFIG', obj: window.CONFIG },
            { name: 'CONFIG.SAFE_CHARS', obj: window.CONFIG?.SAFE_CHARS },
            { name: 'GPUBitStreamEncoder', obj: window.GPUBitStreamEncoder },
            { name: 'CompressionEngine', obj: window.CompressionEngine },
            { name: 'BrowserUtils', obj: window.BrowserUtils },
            { name: 'UIController', obj: window.UIController },
            { name: 'ResourceManager', obj: window.ResourceManager }
        ];
        
        const missing = required.filter(dep => !dep.obj);
        if (missing.length > 0) {
            console.error('Missing required dependencies:', missing.map(d => d.name));
            return false;
        }
        
        return true;
    }

    /**
     * Create fallback metrics object when ProcessingMetrics is not available
     * @returns {Object} Mock metrics object with no-op methods
     */
    createFallbackMetrics() {
        const noOp = () => {};
        return {
            startProcessing: noOp,
            startStage: noOp,
            updateStageStatus: noOp,
            endStage: noOp,
            recordError: noOp,
            endProcessing: noOp,
            setOriginalImage: noOp,
            setProcessedImage: noOp,
            setAnalysis: noOp,
            recordCompressionAttempt: noOp,
            setCurrentEncodedString: noOp
        };
    }

    /**
     * Bind event listeners for file handling
     */
    bindEvents() {
        const { dropZone, fileInput } = this.uiController.elements;
        
        // Handle drag and drop events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
            dropZone.addEventListener(event, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(event => {
            dropZone.addEventListener(event, () => {
                dropZone.classList.add('drag-active');
            });
        });

        ['dragleave', 'drop'].forEach(event => {
            dropZone.addEventListener(event, () => {
                dropZone.classList.remove('drag-active');
            });
        });

        dropZone.addEventListener('drop', (e) => this.handleDrop(e));
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Setup cleanup on page unload
        window.addEventListener('beforeunload', () => this.resourceManager.cleanup());
    }

    /**
     * Handle file drop event
     * @param {DragEvent} e - Drop event
     */
    async handleDrop(e) {
        const files = e.dataTransfer.files;
        if (files.length) {
            await this.processFile(files[0]);
        }
    }

    /**
     * Handle file selection from input
     * @param {Event} e - Change event
     */
    async handleFileSelect(e) {
        const files = e.target.files;
        if (files.length) {
            await this.processFile(files[0]);
        }
    }

    /**
     * Main file processing pipeline
     * @param {File} file - Image file to process
     */
    async processFile(file) {
        // Reset state for new processing
        this.resetProcessingState();
        
        // Start metrics tracking
        this.metrics.startProcessing();
        this.metrics.startStage('initialization', 'Initializing processor');
        
        // Check if encoder context needs reinitialization
        if (this.encoder.isContextLost && this.encoder.isContextLost()) {
            this.metrics.updateStageStatus('initialization', 'Reinitializing graphics processor');
            const success = await this.resourceManager.reinitializeEncoder();
            if (!success) {
                this.metrics.recordError('Failed to reinitialize graphics processor');
                this.metrics.endProcessing();
                return;
            }
        }
        
        // Validate input format
        const validation = this.browserUtils.validateInputFormat(file);
        if (!validation.valid) {
            this.uiController.showStatus('Invalid file format', 'error', validation.details);
            return;
        }
    
        try {
            // Set initial metadata
            this.setImageMetadata(file);
            
            this.metrics.endStage('initialization');
            this.metrics.startStage('analysis', 'Analyzing image content');
            
            // Create initial preview
            const previewUrl = this.resourceManager.createAndTrackObjectURL(file);
            this.uiController.updatePreview(previewUrl);
            
            // Perform image analysis
            const analysisResults = await this.performImageAnalysis(file);
            
            // Check if processing was cancelled
            if (this.processingAborted) {
                this.metrics.endProcessing();
                return;
            }
            
            // Store analysis results
            this.metrics.setAnalysis(analysisResults);
            this.uiController.showAnalysisInfo(analysisResults);
            
            this.metrics.endStage('analysis');
            
            // Try direct encoding first (no compression needed)
            if (await this.tryDirectEncoding(file)) {
                return; // Success - no compression needed
            }
            
            // Need compression - proceed with optimization
            await this.processWithCompression(file, analysisResults);
    
        } catch (error) {
            this.handleProcessingError(error);
        }
    }

    /**
     * Set image metadata for tracking
     * @param {File} file - Image file
     */
    setImageMetadata(file) {
        this.originalSize = file.size;
        this.originalFormat = file.type;
        this.processedSize = file.size;
        this.processedFormat = file.type;
        
        this.metrics.setOriginalImage({
            size: file.size,
            format: file.type
        });
    }

    /**
     * Try direct encoding without compression
     * @param {File} file - Image file
     * @returns {Promise<boolean>} Whether direct encoding succeeded
     */
    async tryDirectEncoding(file) {
        this.metrics.startStage('encoding', 'Testing direct encoding without compression');
        
        try {
            const buffer = await file.arrayBuffer();
            const encoded = await this.encoder.encodeBits(buffer);
            
            // Check if processing was cancelled
            if (this.processingAborted) {
                return false;
            }
            
            // Calculate URL length
            const baseUrl = this.getBaseUrl();
            const finalUrlLength = baseUrl.length + encoded.length;
            
            if (finalUrlLength <= this.maxSize) {
                // Direct encoding succeeded
                this.metrics.updateStageStatus('encoding', 'Direct encoding successful - no compression needed');
                
                await this.uiController.generateResult(encoded);
                this.uiController.updateImageStats();
                
                this.metrics.endStage('encoding');
                this.metrics.endProcessing();
                
                this.uiController.showStatus(this.uiController.getProcessingStats(), 'success');
                return true;
            }
            
            this.metrics.updateStageStatus('encoding', `Direct encoding too large: ${finalUrlLength} > ${this.maxSize} chars`);
            this.metrics.endStage('encoding');
            return false;
            
        } catch (error) {
            console.warn('Direct encoding failed:', error);
            this.metrics.recordError(`Direct encoding failed: ${error.message}`, error);
            this.metrics.endStage('encoding');
            return false;
        }
    }

    /**
     * Process file with compression optimization
     * @param {File} file - Image file
     * @param {Object} analysisResults - Analysis data
     */
    async processWithCompression(file, analysisResults) {
        this.metrics.startStage('formatSelection', 'Selecting optimal format');
        
        // Determine optimal formats for compression
        const optimalFormats = await this.compressionEngine.determineOptimalFormats(file, analysisResults);
        
        this.metrics.endStage('formatSelection');
        this.metrics.startStage('compression', 'Compressing image');
        
        // Try compression with each format until one succeeds
        let bestResult = null;
        let bestFormat = null;
        
        for (const format of optimalFormats) {
            // Check for cancellation
            if (this.processingAborted) {
                this.metrics.endProcessing();
                return;
            }
            
            this.metrics.updateStageStatus('compression', `Trying ${format.split('/')[1].toUpperCase()} format`);
            
            // Get quality recommendation from analysis
            const initialQuality = this.getInitialQuality(format, analysisResults);
            
            try {
                const result = await this.compressionEngine.compressImageHeuristic(file, format, initialQuality);
                
                if (result) {
                    this.metrics.updateStageStatus('compression', 
                        `${format.split('/')[1].toUpperCase()} successful: ${(result.size / 1024).toFixed(2)}KB`);
                    
                    if (!bestResult || result.size < bestResult.size) {
                        bestResult = result;
                        bestFormat = format;
                    }
                    
                    // Stop if we found a very good result
                    if (result.size < file.size * 0.3) {
                        break;
                    }
                }
            } catch (error) {
                this.metrics.updateStageStatus('compression', 
                    `${format.split('/')[1].toUpperCase()} failed: ${error.message}`);
                console.warn(`Compression with ${format} failed:`, error);
            }
        }
        
        // Handle compression results
        if (bestResult) {
            await this.finishSuccessfulCompression(bestResult, bestFormat);
        } else {
            await this.handleCompressionFailure(file, optimalFormats[0] || 'image/webp');
        }
    }

    /**
     * Complete processing after successful compression
     * @param {Object} result - Compression result
     * @param {string} format - Used format
     */
    async finishSuccessfulCompression(result, format) {
        this.processedFormat = format;
        this.processedSize = result.size;
        
        this.metrics.setProcessedImage({
            size: result.size,
            format: format
        });
        
        this.metrics.endStage('compression');
        this.metrics.startStage('encoding', 'Generating URL encoding');
        
        await this.uiController.generateResult(result.encoded);
        this.uiController.updateImageStats();
        
        this.metrics.endStage('encoding');
        this.metrics.endProcessing();
        
        this.uiController.showStatus(this.uiController.getProcessingStats(), 'success');
    }

    /**
     * Handle compression failure with fallback attempts
     * @param {File} file - Original file
     * @param {string} fallbackFormat - Format to try for brute force
     */
    async handleCompressionFailure(file, fallbackFormat) {
        if (this.processingAborted) {
            this.metrics.endProcessing();
            return;
        }
        
        this.metrics.updateStageStatus('compression', 'Trying aggressive compression');
        
        try {
            const bruteForceResult = await this.compressionEngine.compressImageBruteForce(file, fallbackFormat);
            
            if (bruteForceResult && !this.processingAborted) {
                await this.finishSuccessfulCompression(bruteForceResult, fallbackFormat);
                return;
            }
        } catch (error) {
            console.warn('Brute force compression failed:', error);
        }
        
        // Complete failure
        throw new Error(
            'Unable to compress image sufficiently for URL encoding\n' +
            `Original size: ${(this.originalSize / 1024).toFixed(2)}KB\n` +
            `Target URL length: ${this.maxSize} characters\n` +
            'Try using a smaller image or reducing quality/dimensions before upload'
        );
    }

    /**
     * Perform image analysis with comprehensive error handling
     * @param {File} file - Image file to analyze
     * @returns {Promise<Object>} Analysis results
     */
    async performImageAnalysis(file) {
        if (!this.analyzer) {
            return this.createFallbackAnalysis();
        }
        
        try {
            return await this.analyzer.analyzeImage(file);
        } catch (error) {
            console.warn('Image analysis failed:', error);
            this.metrics.recordError(`Image analysis failed: ${error.message}`, error);
            return this.createFallbackAnalysis();
        }
    }

    /**
     * Create fallback analysis when analyzer is unavailable
     * @returns {Object} Basic analysis object
     */
    createFallbackAnalysis() {
        return {
            dimensions: { width: 0, height: 0 },
            analysis: { imageType: 'unknown', hasTransparency: false },
            recommendations: { formatRankings: [] }
        };
    }

    /**
     * Get initial quality setting based on format and analysis
     * @param {string} format - Image format
     * @param {Object} analysisResults - Analysis data
     * @returns {number} Initial quality (0-1)
     */
    getInitialQuality(format, analysisResults) {
        // Get quality from analysis recommendations
        if (analysisResults.recommendations?.formatRankings) {
            const formatEntry = analysisResults.recommendations.formatRankings
                .find(f => f.format === format);
            if (formatEntry) {
                return formatEntry.quality;
            }
        }
        
        // Use format-specific defaults
        const defaults = {
            'image/webp': 0.85,
            'image/avif': 0.82,
            'image/jpeg': 0.80,
            'image/png': 0.95
        };
        
        let quality = defaults[format] || 0.85;
        
        // Adjust for large images
        if (analysisResults.dimensions?.width * analysisResults.dimensions?.height > 1000000) {
            quality = Math.min(quality, 0.75);
        }
        
        return quality;
    }

    /**
     * Handle processing errors
     * @param {Error} error - The error that occurred
     */
    handleProcessingError(error) {
        console.error('Processing error:', error);
        
        // Preserve current state in metrics
        this.metrics.setOriginalImage({
            size: this.originalSize,
            format: this.originalFormat
        });
        
        // Record best attempt if available
        if (this.metrics.compressionAttempts?.length > 0) {
            const bestAttempt = this.findBestCompressionAttempt();
            if (bestAttempt) {
                this.metrics.setProcessedImage({
                    size: bestAttempt.size || 0,
                    format: bestAttempt.format || 'unknown'
                });
            }
        }
        
        this.metrics.recordError(error.message, error);
        this.metrics.endProcessing();
        
        this.uiController.handleProcessingError(error);
    }

    /**
     * Find the best compression attempt from metrics
     * @returns {Object|null} Best attempt or null
     */
    findBestCompressionAttempt() {
        const attempts = this.metrics.compressionAttempts || [];
        const successful = attempts.filter(a => a.success);
        
        if (successful.length > 0) {
            return successful.reduce((best, current) => 
                (current.size < best.size) ? current : best
            );
        }
        
        // Return smallest failed attempt
        return attempts.reduce((best, current) => 
            (current.size && (!best.size || current.size < best.size)) ? current : best
        , {});
    }

    /**
     * Get base URL for final result generation
     * @returns {string} Base URL
     */
    getBaseUrl() {
        return window.location.href.split('?')[0].replace('index.html', '');
    }
};

// Initialize processor when document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            window.imageProcessor = new window.ImageProcessor();
        } catch (error) {
            console.error('Failed to initialize ImageProcessor:', error);
            
            // Show error in UI
            const status = document.getElementById('status');
            if (status) {
                status.textContent = `Initialization error: ${error.message}`;
                status.className = 'status error';
                status.style.display = 'block';
            }
        }
    });
} else {
    try {
        window.imageProcessor = new window.ImageProcessor();
    } catch (error) {
        console.error('Failed to initialize ImageProcessor:', error);
        
        // Show error in UI
        const status = document.getElementById('status');
        if (status) {
            status.textContent = `Initialization error: ${error.message}`;
            status.className = 'status error';
            status.style.display = 'block';
        }
    }
}
