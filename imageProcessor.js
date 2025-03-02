// imageProcessor.js
window.ImageProcessor = class ImageProcessor {
    constructor() {
        // Track created object URLs for cleanup
        this.createdObjectURLs = new Set();
        
        // Run benchmark if available
        this.benchmarkCompleted = false;
        this.benchmarkPromise = null;
        
        if (window.BitStreamBenchmark) {
            this.benchmark = new window.BitStreamBenchmark();
            
            // Listen for benchmark completion
            document.addEventListener('bitstream-benchmark-completed', (event) => {
                this.benchmarkCompleted = true;
                console.log('Benchmark completed:', event.detail);
                
                // Display results
                this.benchmark.displayResults();
                
                // Apply results to encoder if already created
                if (this.encoder) {
                    this.benchmark.applyResults(this.encoder);
                    this.showBenchmarkStatus();
                }
            });
            
            // Start benchmark
            this.benchmarkPromise = this.benchmark.runBenchmark();
        }

        // Check for required dependencies before initialization
        if (!this.checkDependencies()) {
            throw new Error('Required dependencies not available');
        }

        // PTA_1: Use safe character set from config
        // PTA_5: Reference shared config
        try {
            this.encoder = new window.GPUBitStreamEncoder(window.CONFIG.SAFE_CHARS);
            
            // Apply benchmark results if already completed
            if (this.benchmarkCompleted && this.benchmark) {
                this.benchmark.applyResults(this.encoder);
            }
        } catch (error) {
            console.error('Failed to initialize encoder:', error);
            throw new Error(`Encoder initialization failed: ${error.message}`);
        }
        
        if (!this.checkWebGLSupport()) {
            console.warn('WebGL2 support not detected, CPU fallback will be used');
        }

        // Check for ImageAnalyzer dependency before instantiation
        if (!window.ImageAnalyzer) {
            console.warn('ImageAnalyzer not found. Some analysis features may be limited.');
            this.analyzer = null;
        } else {
            try {
                this.analyzer = new window.ImageAnalyzer();
            } catch (error) {
                console.error('Failed to initialize ImageAnalyzer:', error);
                this.analyzer = null;
            }
        }
    
        // Check for ProcessingMetrics dependency
        if (!window.ProcessingMetrics) {
            console.warn('ProcessingMetrics not found. Metrics tracking will be disabled.');
            this.metrics = this.createFallbackMetrics();
        } else {
            // Initialize metrics tracking
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
        
        // Check for AdvancedUI dependency
        if (!window.AdvancedUI) {
            console.warn('AdvancedUI not found. Advanced UI features will be disabled.');
            this.advancedUI = {
                initialize: () => {}
            };
        } else {
            // Initialize advanced UI components
            try {
                this.advancedUI = new window.AdvancedUI();
                this.advancedUI.initialize();
            } catch (error) {
                console.error('Failed to initialize AdvancedUI:', error);
                this.advancedUI = {
                    initialize: () => {}
                };
            }
        }
        
        this.setupUI();
        this.bindEvents();
        
        // Track processing state
        this.originalSize = 0;
        this.processedSize = 0;
        this.originalFormat = '';
        this.processedFormat = '';
        this.processingAborted = false;

        // Check for browser-specific URL length limits
        this.maxSize = this.getBrowserMaxUrlLength();
        
        // Show benchmark status after initialization
        this.showBenchmarkStatus();
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
     * Get maximum URL length supported by the current browser
     * @returns {number}
     */
    getBrowserMaxUrlLength() {
        // Start with the default from config
        const configMax = window.CONFIG.MAX_URL_LENGTH || 8192;
        
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
     * Show benchmark status in the UI
     */
    async showBenchmarkStatus() {
        if (!this.benchmark) return;
        
        // Wait for benchmark to complete
        if (this.benchmarkPromise) {
            try {
                const results = await this.benchmarkPromise;
                this.showStatus(
                    `Performance benchmark completed: ${results.recommended.toUpperCase()} processing selected`,
                    'info'
                );
                
                // Wait a few seconds, then hide the message
                setTimeout(() => {
                    if (this.status && this.status.style.display !== 'none') {
                        this.status.style.display = 'none';
                    }
                }, 3000);
            } catch (error) {
                console.warn('Benchmark error:', error);
                this.showStatus(
                    'Performance benchmark failed, using default settings',
                    'processing'
                );
            }
        }
    }

    /**
     * Check if WebGL2 is supported by the browser
     * @returns {boolean}
     */
    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2');
            if (!gl) return false;
            
            // Check that we can get a valid context
            const isValid = !gl.isContextLost();
            
            // Clean up - try to recover context loss
            const loseContext = gl.getExtension('WEBGL_lose_context');
            if (loseContext) {
                loseContext.loseContext();
                setTimeout(() => {
                    try {
                        loseContext.restoreContext();
                    } catch (e) {
                        // Ignore errors during cleanup
                    }
                }, 0);
            }
            
            return isValid;
        } catch (e) {
            console.warn('Error checking WebGL support:', e);
            return false;
        }
    }

    /**
     * Set up UI elements
     */
    setupUI() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.status = document.getElementById('status');
        this.preview = document.getElementById('preview');
        this.resultUrl = document.getElementById('resultUrl');
        this.resultContainer = document.getElementById('resultContainer');
        
        // Initialize cancel button if available
        this.cancelButton = document.getElementById('cancelProcessing');
        if (this.cancelButton) {
            this.cancelButton.addEventListener('click', () => {
                this.processingAborted = true;
                this.showStatus('Processing cancelled by user', 'error');
                this.metrics.recordError('Processing cancelled by user');
                this.metrics.endProcessing();
            });
        }
    }

    /**
     * Bind event listeners to UI elements
     */
    bindEvents() {
        // Handle drag and drop events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
            this.dropZone.addEventListener(event, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(event => {
            this.dropZone.addEventListener(event, () => {
                this.dropZone.classList.add('drag-active');
            });
        });

        ['dragleave', 'drop'].forEach(event => {
            this.dropZone.addEventListener(event, () => {
                this.dropZone.classList.remove('drag-active');
            });
        });

        this.dropZone.addEventListener('drop', (e) => this.handleDrop(e));
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Listen for page unload to clean up resources
        window.addEventListener('beforeunload', () => this.cleanup());
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
     * Show status message in UI
     * @param {string} message - Status message
     * @param {string} type - Status type (processing, error, success)
     * @param {string} details - Optional details
     */
    showStatus(message, type = 'processing', details = '') {
        const statusText = details ? `${message}\n${details}` : message;
        this.status.textContent = statusText;
        this.status.className = `status ${type}`;
        this.status.style.display = 'block';
        console.log(`[${type}] ${statusText}`); // Add logging for debugging
    }

    /**
     * Reinitialize encoder if WebGL context is lost
     * @returns {Promise<boolean>} Success of reinitialization
     */
    async reinitializeEncoder() {
        try {
            this.encoder = new window.GPUBitStreamEncoder(window.CONFIG.SAFE_CHARS);
            
            // Apply benchmark results if available
            if (this.benchmarkCompleted && this.benchmark) {
                this.benchmark.applyResults(this.encoder);
            }
            
            return true;
        } catch (error) {
            console.error('Failed to reinitialize encoder:', error);
            this.showStatus('Failed to reinitialize graphics processor', 'error');
            return false;
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
        if (this.encoder && typeof this.encoder.cleanup === 'function') {
            try {
                this.encoder.cleanup();
            } catch (e) {
                console.warn('Error cleaning up encoder:', e);
            }
        }
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
            const success = await this.reinitializeEncoder();
            if (!success) {
                this.metrics.recordError('Failed to reinitialize graphics processor');
                this.metrics.endProcessing();
                return;
            }
        }
        
        // Validate input format
        if (!this.validateInputFormat(file)) {
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
            const previewUrl = this.createAndTrackObjectURL(file);
            this.preview.src = previewUrl;
            this.preview.style.display = 'block';
            
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
            
            this.showStatus(
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
                    
                    await this.generateResult(initialEncoded);
                    this.updateImageStats();
                    
                    this.metrics.endStage('finalization');
                    this.metrics.endProcessing();
                    
                    this.showStatus(this.getProcessingStats(), 'success');
                    return;
                }
            } catch (error) {
                console.warn('Error testing initial encoding:', error);
                this.metrics.recordError(`Initial encoding test failed: ${error.message}`, error);
                // Continue to optimization
            }
    
            // Need to optimize the image - get recommended formats from analysis
            this.metrics.updateStageStatus('formatSelection', 'Image requires optimization');
            
            const optimalFormats = await this.determineOptimalFormats(file, analysisResults);
            
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
                    const result = await this.compressImageHeuristic(file, format, initialQuality);
                    
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
                
                await this.generateResult(bestResult.encoded);
                this.updateImageStats();
                
                this.metrics.endStage('encoding');
                this.metrics.endProcessing();
                
                this.showStatus(this.getProcessingStats(), 'success');
                return;
            }
            
            // If we failed with all attempted formats, try brute force approach
            this.metrics.updateStageStatus('compression', 'Trying aggressive compression');
            const bruteForceFormat = optimalFormats[0] || 'image/webp'; // Default to webp for brute force
            
            const bruteForceResult = await this.compressImageBruteForce(file, bruteForceFormat);
            
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
                
                await this.generateResult(bruteForceResult.encoded);
                this.updateImageStats();
                
                this.metrics.endStage('encoding');
                this.metrics.endProcessing();
                
                this.showStatus(this.getProcessingStats(), 'success');
                return;
            }
            
            // If we get here, we failed to compress the image sufficiently
            throw new Error(
                'Unable to compress image sufficiently\n' +
                `Original size: ${(this.originalSize / 1024).toFixed(2)}KB\n` +
                `Target URL length: ${this.maxSize}\n` +
                `Try uploading a smaller image or reducing image quality/dimensions before uploading`
            );
    
        } catch (error) {
            console.error('Processing error:', error);
            this.metrics.recordError(error.message, error);
            this.metrics.endProcessing();
            
            this.showStatus(
                'Processing error',
                'error',
                error.message
            );
        }
    }

    /**
     * Validate input file format
     * @param {File} file - Input file
     * @returns {boolean} - Whether the format is valid
     */
    validateInputFormat(file) {
        if (!window.CONFIG.SUPPORTED_INPUT_FORMATS.includes(file.type)) {
            this.metrics.recordError(
                `Unsupported format: ${file.type}`,
                new Error(`Supported formats: ${window.CONFIG.SUPPORTED_INPUT_FORMATS.join(', ')}`)
            );
            this.metrics.endProcessing();
            this.showStatus(
                `Unsupported format: ${file.type}`,
                'error',
                `Supported formats: ${window.CONFIG.SUPPORTED_INPUT_FORMATS.join(', ')}`
            );
            return false;
        }
        return true;
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

    /**
     * Determine optimal formats for compression
     * @param {File} file - Image file
     * @param {Object} analysisResults - Analysis results
     * @returns {Promise<string[]>} - Array of format MIME types
     */
    async determineOptimalFormats(file, analysisResults) {
        let optimalFormats;
        
        if (analysisResults && analysisResults.recommendations && analysisResults.recommendations.formatRankings) {
            // Use analyzed format rankings
            optimalFormats = analysisResults.recommendations.formatRankings.map(f => f.format);
            
            this.metrics.updateStageStatus(
                'formatSelection', 
                `Selected formats: ${optimalFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}`
            );
        } else {
            // Fallback to original method
            try {
                const detectedFormat = await this.detectOptimalFormat(file);
                optimalFormats = [detectedFormat];
                
                this.metrics.updateStageStatus(
                    'formatSelection',
                    `Detected optimal format: ${detectedFormat.split('/')[1].toUpperCase()}`
                );
            } catch (error) {
                console.warn('Format detection failed:', error);
                // Default to common web formats if detection fails
                optimalFormats = ['image/webp', 'image/jpeg', 'image/png'];
                
                this.metrics.updateStageStatus(
                    'formatSelection',
                    'Using default formats: WEBP, JPEG, PNG'
                );
            }
        }
        
        // Add webp as a fallback if not already in the list
        if (!optimalFormats.includes('image/webp')) {
            optimalFormats.push('image/webp');
        }
        
        return optimalFormats;
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
        const gl = (this.encoder && this.encoder.gl) || document.createElement('canvas').getContext('webgl2');
        
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
            // Plus 20% safety margin
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
     * Update image statistics in UI
     */
    updateImageStats() {
        window.updateImageStats({
            originalSize: `${(this.originalSize / 1024).toFixed(2)} KB`,
            processedSize: `${(this.processedSize / 1024).toFixed(2)} KB`,
            originalFormat: this.originalFormat,
            finalFormat: this.processedFormat
        });
    }

    /**
     * Get processing statistics as formatted string
     * @returns {string} Formatted stats
     */
    getProcessingStats() {
        const originalSize = typeof this.originalSize === 'number' ? this.originalSize : 0;
        const processedSize = typeof this.processedSize === 'number' ? this.processedSize : originalSize;
        
        const originalSizeKB = (originalSize / 1024).toFixed(2);
        const processedSizeKB = (processedSize / 1024).toFixed(2);

        let compressionRatio = 0;
        if (originalSize > 0 && processedSize > 0) {
            compressionRatio = ((1 - (processedSize / originalSize)) * 100).toFixed(1);
        }
        
        return `Successfully processed image:
                Original: ${originalSizeKB}KB (${this.originalFormat})
                Final: ${processedSizeKB}KB (${this.processedFormat})
                Compression: ${compressionRatio}% reduction`;
    }

    /**
     * Verify encoded data integrity
     * PTA_3: Preserve byte boundaries during verification
     * @param {string} encodedData - Encoded data string
     * @returns {boolean} - Whether data is valid
     */
    verifyEncodedData(encodedData) {
        // Ensure we have data to verify
        if (!encodedData || encodedData.length === 0) {
            throw new Error('No encoded data provided for verification');
        }
        
        // Check that all characters are from our safe set
        const invalidChars = [...encodedData].filter(char => !window.CONFIG.SAFE_CHARS.includes(char));
        if (invalidChars.length > 0) {
            if (invalidChars.length <= 10) {
                throw new Error(`Invalid characters found in encoded data: ${invalidChars.join(', ')}`);
            } else {
                throw new Error(`Found ${invalidChars.length} invalid characters in encoded data`);
            }
        }
        
        // Verify data length is within limits
        if (encodedData.length > this.maxSize) {
            throw new Error(`Encoded data exceeds maximum length: ${encodedData.length} > ${this.maxSize}`);
        }
        
        return true;
    }

    /**
     * Generate final result URL
     * @param {string} encodedData - Encoded data string
     * @returns {Promise<void>}
     */
    async generateResult(encodedData) {
        this.verifyEncodedData(encodedData);
        const baseUrl = window.location.href.split('?')[0].replace('index.html', '');
        
        // Don't use encodeURIComponent here since our SAFE_CHARS are already URL-safe
        const finalUrl = `${baseUrl}${encodedData}`;
        
        // PC_3: Check max URL length
        if (finalUrl.length > this.maxSize) {
            throw new Error(
                'Generated URL exceeds maximum length\n' +
                `URL length: ${finalUrl.length}\n` +
                `Maximum allowed: ${this.maxSize}`
            );
        }

        this.resultUrl.textContent = finalUrl;
        this.resultContainer.style.display = 'block';

        // Add URL to browser history for easy sharing
        try {
            window.history.pushState({}, '', finalUrl);
        } catch (error) {
            console.warn('Failed to update browser history:', error);
            // Non-critical error, continue
        }
    }

    /**
     * Compress image using heuristic approach
     * @param {File} file - Image file
     * @param {string} targetFormat - Target format MIME type
     * @param {number} initialQuality - Initial quality (0-1)
     * @returns {Promise<Object|null>} Compression result or null if failed
     */
    async compressImageHeuristic(file, targetFormat, initialQuality = 0.85) {
        const img = await createImageBitmap(file);
        this.metrics.updateStageStatus(
            'compression',
            `Original dimensions: ${img.width}×${img.height}`
        );
        
        // Calculate base URL overhead to ensure we account for it in compression targets
        const baseUrl = window.location.href.split('?')[0].replace('index.html', '');
        const baseUrlLength = baseUrl.length;
        const effectiveMaxLength = this.maxSize - baseUrlLength - 10; // 10 char buffer
        
        // For very large images, start with a more aggressive quality
        if (img.width * img.height > 1000000) { // > 1 megapixel
            initialQuality = Math.min(initialQuality, 0.75);
        }
        
        // Try initial compression with provided quality
        const initialResult = await this.tryCompressionLevel(img, {
            format: targetFormat,
            quality: initialQuality,
            scale: 1.0
        }, effectiveMaxLength);
        
        // Abort if processing was cancelled
        if (this.processingAborted) {
            return null;
        }
        
        // Record the attempt
        this.metrics.recordCompressionAttempt({
            format: targetFormat,
            quality: initialQuality,
            width: img.width,
            height: img.height,
            size: initialResult.data ? initialResult.data.size : null,
            encodedLength: initialResult.encodedLength,
            success: initialResult.success
        });
    
        // If high quality works, return immediately
        if (initialResult.success) {
            return initialResult.data;
        }
    
        // Binary search to find first working compression
        this.metrics.updateStageStatus('compression', 'Binary searching for optimal compression');
        
        // Start with more aggressive parameters for large images
        let initialMinQuality = 0.1;
        let initialMaxQuality = initialQuality;
        let initialMinScale = 0.1;
        let initialMaxScale = 1.0;
        
        // Adjust scaling more aggressively based on how far we are from target
        if (initialResult.encodedLength > effectiveMaxLength * 3) {
            initialMaxScale = 0.5; // Much more aggressive scaling for very large images
        } else if (initialResult.encodedLength > effectiveMaxLength * 2) {
            initialMaxScale = 0.7;
        } else if (initialResult.encodedLength > effectiveMaxLength * 1.5) {
            initialMaxScale = 0.8;
        }
        
        // Try multiple binary searches with different starting parameters
        const searchAttempts = [
            { minQuality: initialMinQuality, maxQuality: initialMaxQuality, minScale: initialMinScale, maxScale: initialMaxScale },
            { minQuality: initialMinQuality, maxQuality: initialMaxQuality * 0.9, minScale: initialMinScale, maxScale: initialMaxScale * 0.8 },
            { minQuality: initialMinQuality, maxQuality: initialMaxQuality * 0.8, minScale: initialMinScale, maxScale: initialMaxScale * 0.6 }
        ];
        
        let result = null;
        
        for (const searchParams of searchAttempts) {
            // Abort if processing was cancelled
            if (this.processingAborted) {
                return null;
            }
            
            result = await this.binarySearchCompression(
                img, 
                targetFormat, 
                initialResult.encodedLength,
                searchParams.minQuality,
                searchParams.maxQuality,
                searchParams.minScale,
                searchParams.maxScale,
                effectiveMaxLength
            );
            
            if (result && result.success) {
                this.metrics.updateStageStatus('compression', 'Optimizing compression parameters');
                const optimized = await this.optimizeCompression(img, targetFormat, result.params, effectiveMaxLength);
                
                // Abort if processing was cancelled
                if (this.processingAborted) {
                    return null;
                }
                
                return optimized.data;
            }
            
            // If we're getting closer but still not there, continue to the next attempt
            if (result && result.encodedLength < initialResult.encodedLength * 0.7) {
                this.metrics.updateStageStatus('compression', 'Progress made, trying more aggressive compression');
            } else {
                // If we're not making significant progress, move on to aggressive methods
                break;
            }
        }
    
        // Try fallback to more aggressive compression
        this.metrics.updateStageStatus('compression', 'Trying aggressive scaling');
        
        // Get aspect ratio to maintain proportions during aggressive scaling
        const aspectRatio = img.width / img.height;
        
        // Try more aggressive scaling strategies with lower starting point
        for (let scale = 0.6; scale >= 0.1; scale -= 0.1) {
            // Abort if processing was cancelled
            if (this.processingAborted) {
                return null;
            }
            
            // Calculate dimensions while maintaining aspect ratio
            const width = Math.round(img.width * scale);
            const height = Math.round(img.height * scale);
            
            // Try a range of quality values for each scale
            const qualities = [0.7, 0.5, 0.3];
            
            for (const quality of qualities) {
                this.metrics.updateStageStatus(
                    'compression', 
                    `Trying scale ${(scale * 100).toFixed(0)}% (${width}×${height}) at quality ${(quality * 100).toFixed(0)}%`
                );
                
                try {
                    const result = await this.tryCompressionLevel(img, {
                        format: targetFormat,
                        quality,
                        scale
                    }, effectiveMaxLength);
                    
                    // Abort if processing was cancelled
                    if (this.processingAborted) {
                        return null;
                    }
                    
                    // Record the attempt
                    this.metrics.recordCompressionAttempt({
                        format: targetFormat,
                        quality,
                        width,
                        height,
                        size: result.data ? result.data.size : null,
                        encodedLength: result.encodedLength,
                        success: result.success
                    });
                    
                    if (result.success) {
                        return result.data;
                    }
                } catch (error) {
                    console.warn('Aggressive scaling attempt failed:', error);
                }
            }
        }
        
        // If we get here, we couldn't find a working compression
        return null;
    }

    /**
     * Try a specific compression level for an image
     * @param {ImageBitmap} img - Image to compress
     * @param {Object} params - Compression parameters
     * @param {number} effectiveMaxLength - Maximum URL length to target
     * @returns {Promise<Object>} Compression result
     */
    async tryCompressionLevel(img, params, effectiveMaxLength) {
        // Abort if processing was cancelled
        if (this.processingAborted) {
            return {
                success: false,
                encodedLength: Infinity,
                data: null,
                params
            };
        }
        
        try {
            const { buffer, size } = await this.tryCompression(img, {
                format: params.format,
                quality: params.quality,
                width: Math.round(img.width * params.scale),
                height: Math.round(img.height * params.scale)
            });
    
            // Update metrics with compression attempt details
            this.metrics.updateStageStatus(
                'compression',
                `${params.format.split('/')[1].toUpperCase()} @ ` +
                `Q${Math.round(params.quality * 100)}, ` +
                `${Math.round(img.width * params.scale)}×${Math.round(img.height * params.scale)} = ` +
                `${(size / 1024).toFixed(2)}KB`
            );
    
            const bits = await this.encoder.toBitArray(buffer);
            const encoded = await this.encoder.encodeBits(bits);
            
            const success = encoded.length <= effectiveMaxLength;
            
            if (success) {
                // Update preview if successful
                const blob = new Blob([buffer], { type: params.format });
                
                // Revoke previous preview URL if it exists
                if (this.preview.src && this.preview.src.startsWith('blob:')) {
                    this.revokeTrackedObjectURL(this.preview.src);
                }
                
                this.preview.src = this.createAndTrackObjectURL(blob);
                
                // Log success
                this.metrics.updateStageStatus(
                    'compression',
                    `Success! URL length: ${encoded.length} characters (max: ${effectiveMaxLength})`
                );
            } else {
                this.metrics.updateStageStatus(
                    'compression',
                    `Too large: ${encoded.length} chars (max: ${effectiveMaxLength})`
                );
            }
    
            return {
                success,
                encodedLength: encoded.length,
                data: success ? {
                    encoded,
                    format: params.format,
                    size
                } : null,
                params
            };
        } catch (error) {
            console.warn('Compression attempt failed:', params, error);
            
            this.metrics.updateStageStatus(
                'compression',
                `Compression failed: ${error.message}`
            );
            
            return {
                success: false,
                encodedLength: Infinity,
                data: null,
                params,
                error
            };
        }
    }

    /**
     * Binary search to find optimal compression parameters
     * @param {ImageBitmap} img - Image to compress
     * @param {string} format - Target format
     * @param {number} initialLength - Initial encoded length
     * @param {number} minQuality - Minimum quality
     * @param {number} maxQuality - Maximum quality
     * @param {number} minScale - Minimum scale
     * @param {number} maxScale - Maximum scale
     * @param {number} effectiveMaxLength - Maximum URL length
     * @returns {Promise<Object>} Search result
     */
    async binarySearchCompression(img, format, initialLength, minQuality = 0.1, maxQuality = 0.95, minScale = 0.1, maxScale = 1.0, effectiveMaxLength) {
        const targetSize = effectiveMaxLength * 0.95; // Leave some buffer
        
        let bestResult = null;
        let iterations = 0;
        const maxIterations = 8; // Prevent infinite loops
    
        while (iterations < maxIterations) {
            // Abort if processing was cancelled
            if (this.processingAborted) {
                return { success: false, encodedLength: initialLength };
            }
            
            const quality = (minQuality + maxQuality) / 2;
            const scale = (minScale + maxScale) / 2;
            
            const result = await this.tryCompressionLevel(img, {
                format,
                quality,
                scale
            }, effectiveMaxLength);
    
            if (result.success) {
                // Found a working compression, store it and try for better quality
                bestResult = result;
                minQuality = quality;
                minScale = scale;
            } else {
                // Compression not sufficient, need to be more aggressive
                maxQuality = quality;
                maxScale = scale;
            }
    
            // If we're close enough to target size or ranges are very small, break
            if (Math.abs(maxQuality - minQuality) < 0.05 && Math.abs(maxScale - minScale) < 0.05) {
                break;
            }
    
            iterations++;
        }
    
        return bestResult || { success: false, encodedLength: initialLength };
    }

    /**
     * Optimize compression by incrementally improving parameters
     * @param {ImageBitmap} img - Image to compress
     * @param {string} format - Target format
     * @param {Object} workingParams - Initial working parameters
     * @param {number} effectiveMaxLength - Maximum URL length
     * @returns {Promise<Object>} Optimized result
     */
    async optimizeCompression(img, format, workingParams, effectiveMaxLength) {
        const optimizationSteps = [
            { quality: 0.05, scale: 0.05 }, // Small steps
            { quality: 0.1, scale: 0.1 }    // Medium steps
        ];
    
        let bestResult = await this.tryCompressionLevel(img, workingParams, effectiveMaxLength);
        
        // Try increasing quality and scale incrementally
        for (const step of optimizationSteps) {
            // Abort if processing was cancelled
            if (this.processingAborted) {
                return bestResult;
            }
            
            let improved = true;
            let iterationCount = 0;
            const maxIterations = 3; // Limit iterations to prevent infinite loops
            
            while (improved && iterationCount < maxIterations) {
                improved = false;
                iterationCount++;
                
                // Abort if processing was cancelled
                if (this.processingAborted) {
                    return bestResult;
                }
                
                // Try increasing quality
                if (workingParams.quality + step.quality <= 0.95) {
                    const qualityResult = await this.tryCompressionLevel(img, {
                        ...workingParams,
                        quality: workingParams.quality + step.quality
                    }, effectiveMaxLength);
                    
                    // If successful and better than current best, update best result
                    if (qualityResult.success && qualityResult.encodedLength <= bestResult.encodedLength) {
                        bestResult = qualityResult;
                        workingParams = {...workingParams, quality: workingParams.quality + step.quality};
                        improved = true;
                        continue; // Move to the next iteration
                    }
                }
                
                // Abort if processing was cancelled
                if (this.processingAborted) {
                    return bestResult;
                }
                
                // Try increasing scale
                if (workingParams.scale + step.scale <= 1.0) {
                    const scaleResult = await this.tryCompressionLevel(img, {
                        ...workingParams,
                        scale: workingParams.scale + step.scale
                    }, effectiveMaxLength);
                    
                    // If successful and better than current best, update best result
                    if (scaleResult.success && scaleResult.encodedLength <= bestResult.encodedLength) {
                        bestResult = scaleResult;
                        workingParams = {...workingParams, scale: workingParams.scale + step.scale};
                        improved = true;
                    }
                }
            }
        }
        
        return bestResult;
    }
    
    /**
     * Try image compression with specified parameters
     * @param {ImageBitmap} img - Image to compress
     * @param {Object} options - Compression options
     * @returns {Promise<Object>} Compression result with buffer and size
     */
    async tryCompression(img, options) {
        const { format, quality = 0.85, width = null, height = null } = options;
        
        // Use canvas to perform the compression
        const canvas = document.createElement('canvas');
        const targetWidth = width || img.width;
        const targetHeight = height || img.height;
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Unable to get 2D context for compression');
        }
        
        // Draw image to canvas with specified dimensions
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        // Get the blob with specified format and quality
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error(`Failed to encode image as ${format}`));
                        return;
                    }
                    
                    // Convert blob to ArrayBuffer for processing
                    const reader = new FileReader();
                    reader.onload = () => {
                        resolve({
                            buffer: reader.result,
                            size: blob.size
                        });
                    };
                    reader.onerror = () => {
                        reject(new Error('Failed to read compressed image data'));
                    };
                    reader.readAsArrayBuffer(blob);
                },
                format,
                quality
            );
        });
    }

    /**
     * Brute force compression approach for last resort
     * @param {File} file - Image file
     * @param {string} targetFormat - Target format MIME type
     * @returns {Promise<Object|null>} Compression result or null if failed
     */
    async compressImageBruteForce(file, targetFormat) {
        const img = await createImageBitmap(file);
        let bestResult = null;
    
        // Calculate base URL overhead
        const baseUrl = window.location.href.split('?')[0].replace('index.html', '');
        const baseUrlLength = baseUrl.length;
        const effectiveMaxLength = this.maxSize - baseUrlLength - 10; // 10 char buffer
    
        // Calculate a size reduction scale factor based on the original encoded size vs target
        const buffer = await file.arrayBuffer();
        let initialBits, initialEncoded;
        
        try {
            initialBits = await this.encoder.toBitArray(buffer);
            initialEncoded = await this.encoder.encodeBits(initialBits);
        } catch (error) {
            console.warn('Error getting initial encoded size:', error);
            // Default to a conservative estimate if encoding fails
            initialEncoded = new Array(buffer.byteLength * 2).fill('A').join('');
        }
        
        // Calculate minimum scale needed based on ratio of encoded size to target
        const encodedRatio = initialEncoded.length / effectiveMaxLength;
        const minScale = Math.max(0.05, Math.min(0.5, 1 / (encodedRatio * 2))); // More aggressive scaling for larger encodings
        
        // Define quality steps based on image size
        const qualitySteps = img.width * img.height > 1000000 ? 
            [0.6, 0.4, 0.2, 0.1, 0.05] : 
            [0.8, 0.6, 0.4, 0.2, 0.1];
        
        // Define scale steps - go from smaller to larger to find minimum acceptable size
        const startScale = Math.min(0.5, minScale * 1.5);
        const scaleSteps = [
            startScale * 0.5, 
            startScale * 0.75, 
            startScale, 
            startScale * 1.25, 
            startScale * 1.5
        ].filter(scale => scale <= 1.0 && scale >= 0.05);
        
        this.metrics.updateStageStatus(
            'compression',
            `Brute force with scales ${scaleSteps.map(s => (s * 100).toFixed(0) + '%').join(', ')} and qualities ${qualitySteps.map(q => (q * 100).toFixed(0) + '%').join(', ')}`
        );
        
        // Try combinations of scale and quality
        for (const scale of scaleSteps) {
            // Abort if processing was cancelled
            if (this.processingAborted) {
                return null;
            }
            
            // Round dimensions to even numbers for better encoder performance
            const width = Math.floor(img.width * scale / 2) * 2;
            const height = Math.floor(img.height * scale / 2) * 2;
            
            for (const quality of qualitySteps) {
                // Abort if processing was cancelled
                if (this.processingAborted) {
                    return null;
                }
                
                try {
                    this.metrics.updateStageStatus(
                        'compression',
                        `Trying ${targetFormat.split('/')[1].toUpperCase()} at ${(scale * 100).toFixed(0)}% scale, ${(quality * 100).toFixed(0)}% quality (${width}x${height})`
                    );
                    
                    const { buffer, size } = await this.tryCompression(img, {
                        format: targetFormat,
                        quality: quality,
                        width: width,
                        height: height
                    });
                    
                    // Record this attempt in metrics
                    this.metrics.recordCompressionAttempt({
                        format: targetFormat,
                        quality: quality,
                        width: width,
                        height: height,
                        size: size
                    });
    
                    this.metrics.updateStageStatus(
                        'compression',
                        `Compressed to ${(size / 1024).toFixed(2)}KB, encoding...`
                    );
                    
                    // Convert to bits
                    const bits = await this.encoder.toBitArray(buffer);
                    // Encode to URL
                    const encoded = await this.encoder.encodeBits(bits);
    
                    this.metrics.updateStageStatus(
                        'compression',
                        `Encoded length: ${encoded.length} chars (limit: ${effectiveMaxLength})`
                    );
    
                    // Check if within limit
                    if (encoded.length <= effectiveMaxLength) {
                        // Update preview with compressed version
                        const blob = new Blob([buffer], { type: targetFormat });
                        
                        // Revoke previous preview URL if it exists
                        if (this.preview.src && this.preview.src.startsWith('blob:')) {
                            this.revokeTrackedObjectURL(this.preview.src);
                        }
                        
                        this.preview.src = this.createAndTrackObjectURL(blob);
                        
                        bestResult = {
                            encoded,
                            format: targetFormat,
                            size: size
                        };
                        
                        this.metrics.updateStageStatus(
                            'compression',
                            `Success! Found working compression: ${(size / 1024).toFixed(2)}KB, ${encoded.length} chars`
                        );
                        
                        return bestResult; // Return immediately on first success
                    }
                } 
                catch (error) {
                    console.warn(
                        `Compression attempt failed:`,
                        `Scale=${scale}, Quality=${quality}`,
                        `Error=${error.message}`
                    );
                    continue;
                }
            }
        }
    
        if (!bestResult) {
            this.metrics.updateStageStatus(
                'compression',
                `Failed to find working compression after trying all combinations`
            );
            
            // Try one last extreme attempt for very large images
            if (img.width * img.height > 500000) {
                try {
                    // Abort if processing was cancelled
                    if (this.processingAborted) {
                        return null;
                    }
                    
                    // Tiny thumbnail as last resort
                    const maxDimension = 200;
                    const thumbScale = Math.min(maxDimension / img.width, maxDimension / img.height);
                    const thumbWidth = Math.floor(img.width * thumbScale / 2) * 2;
                    const thumbHeight = Math.floor(img.height * thumbScale / 2) * 2;
                    
                    this.metrics.updateStageStatus(
                        'compression',
                        `Last resort: Creating thumbnail (${thumbWidth}x${thumbHeight})`
                    );
                    
                    const { buffer, size } = await this.tryCompression(img, {
                        format: targetFormat,
                        quality: 0.4,
                        width: thumbWidth,
                        height: thumbHeight
                    });
                    
                    const bits = await this.encoder.toBitArray(buffer);
                    const encoded = await this.encoder.encodeBits(bits);
                    
                    if (encoded.length <= effectiveMaxLength) {
                        const blob = new Blob([buffer], { type: targetFormat });
                        
                        // Revoke previous preview URL if it exists
                        if (this.preview.src && this.preview.src.startsWith('blob:')) {
                            this.revokeTrackedObjectURL(this.preview.src);
                        }
                        
                        this.preview.src = this.createAndTrackObjectURL(blob);
                        
                        bestResult = {
                            encoded,
                            format: targetFormat,
                            size: size
                        };
                        
                        this.metrics.updateStageStatus(
                            'compression',
                            `Created thumbnail: ${(size / 1024).toFixed(2)}KB, ${encoded.length} chars`
                        );
                        
                        return bestResult;
                    }
                } catch (error) {
                    console.warn('Thumbnail creation failed:', error);
                }
            }
            
            throw new Error('Image too large even after maximum compression');
        }
    
        return bestResult;
    }

    /**
     * Enhanced image analysis with proper error handling
     * @param {File} file - Image file to analyze
     * @returns {Promise<Object>} Analysis results
     */
    async enhancedAnalyzeImageProperties(file) {
        try {
            // Start analysis stage
            this.metrics.startStage('analysis', 'Analyzing image properties');
            
            // Use the ImageAnalyzer for detailed analysis
            const analysisResults = await this.analyzer.analyzeImage(file);
            
            // Store results in metrics
            this.metrics.setAnalysis(analysisResults);
            
            // Get optimal format recommendations
            const formatRankings = analysisResults.recommendations.formatRankings;
            const optimalFormats = formatRankings.map(format => format.format);
            
            this.metrics.endStage('analysis');
            
            return {
                analysis: analysisResults,
                optimalFormats,
                suggestedQuality: analysisResults.recommendations.suggestedQuality
            };
        } catch (error) {
            console.error('Image analysis error:', error);
            this.metrics.recordError('Image analysis failed', error);
            
            // Fallback to basic format detection
            this.metrics.endStage('analysis');
            
            // Detect optimal format using existing method
            const optimalFormat = await this.detectOptimalFormat(file);
            return {
                optimalFormats: [optimalFormat],
                suggestedQuality: 0.85
            };
        }
    }

    /**
     * Detect optimal format for an image
     * @param {File} file - Image file
     * @returns {Promise<string>} - Best format MIME type
     */
    async detectOptimalFormat(file) {
        // Convert the image to different formats and compare sizes
        const img = await createImageBitmap(file);
        let bestFormat = null;
        let smallestSize = Infinity;

        // PTA_5: Use formats from config
        const formats = window.CONFIG.SUPPORTED_INPUT_FORMATS.filter(format => 
            format !== 'image/svg+xml' && // Skip SVG as it's not suitable for conversion
            format !== 'image/gif'        // Skip GIF as it might be animated
        );

        for (const format of formats) {
            try {
                const { size } = await this.tryCompression(img, { 
                    format, 
                    quality: 0.95 
                });

                if (size < smallestSize) {
                    smallestSize = size;
                    bestFormat = format;
                }
            } catch (error) {
                console.warn(`Format ${format} not supported:`, error);
            }
        }

        return bestFormat || file.type;
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
