// imageProcessor.js
window.ImageProcessor = class ImageProcessor {
    constructor() {
        if (window.imageProcessorInstance) {
            console.warn('ImageProcessor already initialized, returning existing instance');
            return window.imageProcessorInstance;
        }
        
        // Track created object URLs for cleanup
        this.createdObjectURLs = new Set();
        
        // Check for required dependencies before initialization
        if (!this.checkDependencies()) {
            throw new Error('Required dependencies not available');
        }
        
        // Initialize utility modules first
        this.browserUtils = new window.BrowserUtils(this);
        this.resourceManager = new window.ResourceManager(this);
        this.uiController = new window.UIController(this);
        
        // Check for browser-specific URL length limits
        this.maxSize = this.browserUtils.getBrowserMaxUrlLength();
        
        // Initialize encoder with better error handling
        this.initializeEncoder();
        
        // Initialize compression engine after encoder is created
        this.compressionEngine = new window.CompressionEngine(this);
        
        // Initialize analysis components
        this.initializeAnalyzer();
        
        // Initialize metrics tracking
        this.initializeMetrics();
        
        // Initialize advanced UI components last
        this.initializeAdvancedUI();
        
        // Initialize benchmark after other components
        this.initializeBenchmark();
        
        // Finish UI setup last, after all components are initialized
        this.uiController.setupUI();
        this.bindEvents();
        
        // Track processing state
        this.originalSize = 0;
        this.processedSize = 0;
        this.originalFormat = '';
        this.processedFormat = '';
        this.processingAborted = false;
        
        // Store instance globally to prevent duplicates
        window.imageProcessorInstance = this;
        
        console.log('ImageProcessor initialized successfully');
    }

    /**
     * Initialize encoder with proper error handling
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
            
            // Check WebGL support without throwing errors
            if (!this.browserUtils.checkWebGLSupport()) {
                console.info('WebGL2 support not detected, CPU fallback will be used');
                // Don't throw error, just log info
            }
            
        } catch (error) {
            console.error('Failed to initialize encoder:', error);
            throw new Error(`Encoder initialization failed: ${error.message}`);
        }
    }
    
    /**
     * Initialize analyzer component
     */
    initializeAnalyzer() {
        if (!window.ImageAnalyzer) {
            console.info('ImageAnalyzer not found. Some analysis features may be limited.');
            this.analyzer = null;
        } else {
            try {
                this.analyzer = new window.ImageAnalyzer();
            } catch (error) {
                console.error('Failed to initialize ImageAnalyzer:', error);
                this.analyzer = null;
            }
        }
    }
    
    /**
     * Initialize metrics tracking
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
                // Check if already initialized
                if (window.advancedUIInstance) {
                    console.info('AdvancedUI already initialized, reusing existing instance');
                    this.advancedUI = window.advancedUIInstance;
                } else {
                    this.advancedUI = new window.AdvancedUI();
                    window.advancedUIInstance = this.advancedUI;
                    this.advancedUI.initialize();
                }
            } catch (error) {
                console.error('Failed to initialize AdvancedUI:', error);
                this.advancedUI = { initialize: () => {} };
            }
        }
    }
    
    /**
     * Initialize benchmark component
     */
    initializeBenchmark() {
        // Run benchmark if available
        this.benchmarkCompleted = false;
        this.benchmarkPromise = null;
        
        if (window.BitStreamBenchmark) {
            try {
                // Check if benchmark already exists
                if (window.benchmarkInstance) {
                    console.info('Benchmark already initialized, reusing existing instance');
                    this.benchmark = window.benchmarkInstance;
                } else {
                    this.benchmark = new window.BitStreamBenchmark();
                    window.benchmarkInstance = this.benchmark;
                }
                
                // Listen for benchmark completion
                document.addEventListener('bitstream-benchmark-completed', (event) => {
                    this.benchmarkCompleted = true;
                    console.log('Benchmark completed:', event.detail);
                    
                    // Display results
                    this.benchmark.displayResults();
                    
                    // Apply results to encoder if already created
                    if (this.encoder) {
                        this.benchmark.applyResults(this.encoder);
                    }
                });
                
                // Start benchmark
                this.benchmarkPromise = this.benchmark.runBenchmark();
            } catch (error) {
                console.error('Failed to initialize benchmark:', error);
                this.benchmark = null;
            }
        }
    }

    /**
     * Check if all required dependencies are available
     * @returns {boolean}
     */
    checkDependencies() {
        if (!window.CONFIG) {
            console.error('CONFIG not available');
            return false;
        }
        
        if (!window.CONFIG.SAFE_CHARS) {
            console.error('CONFIG.SAFE_CHARS not available');
            return false;
        }
        
        if (!window.GPUBitStreamEncoder) {
            console.error('GPUBitStreamEncoder not available');
            return false;
        }
        
        return true;
    }

    /**
     * Create fallback metrics object when ProcessingMetrics is not available
     * @returns {Object}
     */
    createFallbackMetrics() {
        return {
            startProcessing: () => {},
            startStage: () => {},
            updateStageStatus: () => {},
            endStage: () => {},
            recordError: () => {},
            endProcessing: () => {},
            setOriginalImage: () => {},
            setProcessedImage: () => {},
            setAnalysis: () => {},
            recordCompressionAttempt: () => {}
        };
    }

    /**
     * Bind event listeners to UI elements
     */
    bindEvents() {
        // Handle drag and drop events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
            this.uiController.elements.dropZone.addEventListener(event, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(event => {
            this.uiController.elements.dropZone.addEventListener(event, () => {
                this.uiController.elements.dropZone.classList.add('drag-active');
            });
        });

        ['dragleave', 'drop'].forEach(event => {
            this.uiController.elements.dropZone.addEventListener(event, () => {
                this.uiController.elements.dropZone.classList.remove('drag-active');
            });
        });

        this.uiController.elements.dropZone.addEventListener('drop', (e) => this.handleDrop(e));
        this.uiController.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Listen for page unload to clean up resources
        window.addEventListener('beforeunload', () => this.resourceManager.cleanup());
    }

    /**
     * Handle file drop event
     * @param {DragEvent} e
     */
    async handleDrop(e) {
        const files = e.dataTransfer.files;
        if (files.length) await this.processFile(files[0]);
    }

    /**
     * Handle file select from input
     * @param {Event} e
     */
    async handleFileSelect(e) {
        const files = e.target.files;
        if (files.length) await this.processFile(files[0]);
    }

    /**
     * Main file processing method
     * @param {File} file - Image file to process
     */
    async processFile(file) {
        // Reset abort flag
        this.processingAborted = false;
        
        this.metrics.startProcessing();
        this.metrics.startStage('initialization', 'Initializing processor');
        
        // Check if WebGL context is lost and try to reinitialize
        if (this.encoder.gl && this.encoder.isContextLost()) {
            this.metrics.updateStageStatus('initialization', 'Reinitializing graphics processor');
            const success = await this.resourceManager.reinitializeEncoder();
            if (!success) {
                this.metrics.recordError('Failed to reinitialize graphics processor');
                this.metrics.endProcessing();
                return;
            }
        }
        
        // Validate input format
        if (!this.browserUtils.validateInputFormat(file)) {
            return;
        }
    
        try {
            // Set original image metadata
            this.originalSize = file.size;
            this.originalFormat = file.type;
            this.processedSize = file.size;  // Initialize to original size
            this.processedFormat = file.type; // Initialize to original format
            
            this.metrics.setOriginalImage({
                size: file.size,
                format: file.type
            });
            
            this.metrics.endStage('initialization');
            this.metrics.startStage('analysis', 'Analyzing image content');
            
            // Create initial preview
            const previewUrl = this.resourceManager.createAndTrackObjectURL(file);
            this.uiController.updatePreview(previewUrl);
            
            // Perform advanced image analysis
            this.metrics.updateStageStatus('analysis', 'Analyzing image properties');
            const analysisResults = await this.performImageAnalysis(file);
            
            // Abort if processing was cancelled
            if (this.processingAborted) {
                this.metrics.endProcessing();
                return;
            }
            
            // Store analysis results in metrics
            this.metrics.setAnalysis(analysisResults);
            
            // Show status with analysis info
            const imageType = analysisResults.analysis?.imageType || 'image';
            
            this.uiController.showStatus(
                `Analyzed ${imageType} (${(file.size / 1024).toFixed(2)}KB)`,
                'processing',
                `${analysisResults.dimensions?.width || 0}×${analysisResults.dimensions?.height || 0}, ` +
                `${analysisResults.analysis?.hasTransparency ? 'transparent' : 'opaque'}`
            );
            
            this.metrics.endStage('analysis');
            this.metrics.startStage('formatSelection', 'Selecting optimal format');
            
            // Calculate base URL overhead to ensure we account for it in compression targets
            const baseUrl = window.location.href.split('?')[0].replace('index.html', '');
            const baseUrlLength = baseUrl.length;
            const effectiveMaxLength = this.maxSize - baseUrlLength - 10; // 10 char buffer
            
            this.metrics.updateStageStatus('formatSelection', 'Testing initial encoding');
            
            try {
                const buffer = await file.arrayBuffer();
                const initialBits = await this.encoder.toBitArray(buffer);
                const initialEncoded = await this.encoder.encodeBits(initialBits);
                
                // Abort if processing was cancelled
                if (this.processingAborted) {
                    this.metrics.endProcessing();
                    return;
                }
                
                this.metrics.updateStageStatus('formatSelection', 'Checking URL size limits');
                
                // Check if original file fits within URL limit
                if (initialEncoded.length <= effectiveMaxLength) {
                    // Original file fits within URL limit
                    this.processedSize = file.size;
                    this.processedFormat = file.type;
                    
                    this.metrics.setProcessedImage({
                        size: file.size,
                        format: file.type
                    });
                    
                    this.metrics.endStage('formatSelection');
                    this.metrics.startStage('finalization', 'Generating result URL');
                    
                    await this.uiController.generateResult(initialEncoded);
                    this.uiController.updateImageStats();
                    
                    this.metrics.endStage('finalization');
                    this.metrics.endProcessing();
                    
                    this.uiController.showStatus(this.uiController.getProcessingStats(), 'success');
                    return;
                }
            } catch (error) {
                console.warn('Error testing initial encoding:', error);
                this.metrics.recordError(`Initial encoding test failed: ${error.message}`, error);
                // Continue to optimization
            }
    
            // Need to optimize the image - get recommended formats from analysis
            this.metrics.updateStageStatus('formatSelection', 'Image requires optimization');
            
            const optimalFormats = await this.compressionEngine.determineOptimalFormats(file, analysisResults);
            
            this.metrics.endStage('formatSelection');
            this.metrics.startStage('compression', 'Compressing image');
            
            // Try compression with recommended formats
            let bestResult = null;
            let bestFormat = null;
            
            for (const format of optimalFormats) {
                // Abort if processing was cancelled
                if (this.processingAborted) {
                    this.metrics.endProcessing();
                    return;
                }
                
                this.metrics.updateStageStatus(
                    'compression',
                    `Trying ${format.split('/')[1].toUpperCase()} format`
                );
                
                // Get quality recommendation
                let initialQuality = 0.85; // Default quality
                if (analysisResults.recommendations && 
                    analysisResults.recommendations.formatRankings) {
                    // Find format entry in rankings
                    const formatEntry = analysisResults.recommendations.formatRankings
                        .find(f => f.format === format);
                    if (formatEntry) {
                        initialQuality = formatEntry.quality;
                    }
                }
                
                // For large images, start with lower quality
                if (analysisResults.dimensions && 
                    analysisResults.dimensions.width * analysisResults.dimensions.height > 1000000) {
                    initialQuality = Math.min(initialQuality, 0.8);
                }
                
                try {
                    const result = await this.compressionEngine.compressImageHeuristic(file, format, initialQuality);
                    
                    if (result) {
                        this.metrics.updateStageStatus(
                            'compression',
                            `${format.split('/')[1].toUpperCase()} successful: ${(result.size / 1024).toFixed(2)}KB`
                        );
                        
                        // If this is the first successful result or it's better than previous best
                        if (!bestResult || result.size < bestResult.size) {
                            bestResult = result;
                            bestFormat = format;
                        }
                    }
                } catch (error) {
                    this.metrics.updateStageStatus(
                        'compression',
                        `${format.split('/')[1].toUpperCase()} failed: ${error.message}`
                    );
                    
                    // Log the error but continue with other formats
                    console.warn(`Compression with ${format} failed:`, error);
                }
                
                // If we've found a very good result, no need to try all formats
                if (bestResult && 
                    bestResult.size < file.size * 0.3) { // 70% reduction is very good
                    break;
                }
            }
            
            // Abort if processing was cancelled
            if (this.processingAborted) {
                this.metrics.endProcessing();
                return;
            }
            
            // If we found a valid result, use it
            if (bestResult) {
                this.processedFormat = bestFormat;
                this.processedSize = bestResult.size;
                
                this.metrics.setProcessedImage({
                    size: bestResult.size,
                    format: bestFormat
                });
                
                this.metrics.endStage('compression');
                this.metrics.startStage('encoding', 'Generating URL encoding');
                
                await this.uiController.generateResult(bestResult.encoded);
                this.uiController.updateImageStats();
                
                this.metrics.endStage('encoding');
                this.metrics.endProcessing();
                
                this.uiController.showStatus(this.uiController.getProcessingStats(), 'success');
                return;
            }
            
            // If we failed with all attempted formats, try brute force approach
            this.metrics.updateStageStatus('compression', 'Trying aggressive compression');
            const bruteForceFormat = optimalFormats[0] || 'image/webp'; // Default to webp for brute force
            
            const bruteForceResult = await this.compressionEngine.compressImageBruteForce(file, bruteForceFormat);
            
            // Abort if processing was cancelled
            if (this.processingAborted) {
                this.metrics.endProcessing();
                return;
            }
            
            if (bruteForceResult) {
                this.processedFormat = bruteForceFormat;
                this.processedSize = bruteForceResult.size;
                
                this.metrics.setProcessedImage({
                    size: bruteForceResult.size,
                    format: bruteForceFormat
                });
                
                this.metrics.endStage('compression');
                this.metrics.startStage('encoding', 'Generating URL encoding');
                
                await this.uiController.generateResult(bruteForceResult.encoded);
                this.uiController.updateImageStats();
                
                this.metrics.endStage('encoding');
                this.metrics.endProcessing();
                
                this.uiController.showStatus(this.uiController.getProcessingStats(), 'success');
                return;
            }
            
            // If we get here, we failed to compress the image sufficiently
            throw new Error(
                'Unable to compress image sufficiently\n' +
                `Original size: ${(this.originalSize / 1024).toFixed(2)}KB\n` +
                `Target URL length: ${this.maxSize}\n` +
                `Try uploading a smaller image or reducing image quality/dimensions before uploading`
            );
    
        } 
        catch (error) {
            console.error('Processing error:', error);
            
            // Save original and processed info even on error
            // This ensures metrics displays show what was attempted
            this.metrics.setOriginalImage({
                size: this.originalSize,
                format: this.originalFormat
            });
            
            // If we have any attempts, use the best one for processed stats
            if (this.metrics.compressionAttempts && this.metrics.compressionAttempts.length > 0) {
                // Find the smallest successful attempt (if any)
                const successfulAttempts = this.metrics.compressionAttempts.filter(a => a.success);
                let bestAttempt = successfulAttempts.length > 0 ? 
                    successfulAttempts.reduce((best, current) => {
                        return (current.size < best.size) ? current : best;
                    }, successfulAttempts[0]) : null;
                
                // If no successful attempts, use the smallest failed attempt
                if (!bestAttempt && this.metrics.compressionAttempts.length > 0) {
                    bestAttempt = this.metrics.compressionAttempts.reduce((best, current) => {
                        return (current.size && (!best.size || current.size < best.size)) ? current : best;
                    }, this.metrics.compressionAttempts[0]);
                }
                
                if (bestAttempt) {
                    this.metrics.setProcessedImage({
                        size: bestAttempt.size || 0,
                        format: bestAttempt.format || 'unknown'
                    });
                }
            }
            
            this.metrics.recordError(error.message, error);
            this.metrics.endProcessing();
            
            this.uiController.showStatus(
                'Processing error',
                'error',
                error.message
            );
            
            // Make sure the current image data and metrics are visible
            this.uiController.updateImageStats();
        }
    }

    /**
     * Perform image analysis with error handling
     * @param {File} file - Image file to analyze
     * @returns {Promise<Object>} - Analysis results
     */
    async performImageAnalysis(file) {
        if (!this.analyzer) {
            return {
                dimensions: { width: 0, height: 0 },
                analysis: { imageType: 'unknown', hasTransparency: false },
                recommendations: { formatRankings: [] }
            };
        }
        
        try {
            return await this.analyzer.analyzeImage(file);
        } catch (error) {
            console.warn('Image analysis failed:', error);
            this.metrics.recordError(`Image analysis failed: ${error.message}`, error);
            
            // Return basic analysis with error flag
            return {
                dimensions: { width: 0, height: 0 },
                analysis: { imageType: 'unknown', hasTransparency: false, analysisError: true },
                recommendations: { formatRankings: [] }
            };
        }
    }
};

// Initialize processor when document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            window.imageProcessor = new window.ImageProcessor();
        } catch (error) {
            console.error('Failed to initialize ImageProcessor:', error);
            // Show error in the UI
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
        // Show error in the UI
        const status = document.getElementById('status');
        if (status) {
            status.textContent = `Initialization error: ${error.message}`;
            status.className = 'status error';
            status.style.display = 'block';
        }
    }
}
