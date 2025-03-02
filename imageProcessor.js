// imageProcessor.js
window.ImageProcessor = class ImageProcessor {
    constructor() {
        // PTA_1: Use safe character set from config
        // PTA_5: Reference shared config
        this.encoder = new window.GPUBitStreamEncoder(window.CONFIG.SAFE_CHARS);
        if (!this.checkWebGLSupport()) {
            throw new Error('WebGL2 support is required for image processing');
        }

        // Check for ImageAnalyzer dependency before instantiation
        if (!window.ImageAnalyzer) {
            console.warn('ImageAnalyzer not found. Some analysis features may be limited.');
            this.analyzer = null;
        } else {
            this.analyzer = new window.ImageAnalyzer();
        }
    
        // Check for ProcessingMetrics dependency
        if (!window.ProcessingMetrics) {
            console.warn('ProcessingMetrics not found. Metrics tracking will be disabled.');
            this.metrics = {
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
        } else {
            // Initialize metrics tracking
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
        }
        
        // Check for AdvancedUI dependency
        if (!window.AdvancedUI) {
            console.warn('AdvancedUI not found. Advanced UI features will be disabled.');
            this.advancedUI = {
                initialize: () => {}
            };
        } else {
            // Initialize advanced UI components
            this.advancedUI = new window.AdvancedUI();
            this.advancedUI.initialize();
        }
        
        this.setupUI();
        this.bindEvents();
        
        // Track processing state
        this.originalSize = 0;
        this.processedSize = 0;
        this.originalFormat = '';
        this.processedFormat = '';

        this.maxSize = window.CONFIG.MAX_URL_LENGTH;
    }

    checkWebGLSupport() {
        const canvas = document.createElement('canvas');
        return !!canvas.getContext('webgl2');
    }

    setupUI() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.status = document.getElementById('status');
        this.preview = document.getElementById('preview');
        this.resultUrl = document.getElementById('resultUrl');
        this.resultContainer = document.getElementById('resultContainer');
    }

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
    }

    async handleDrop(e) {
        const files = e.dataTransfer.files;
        if (files.length) await this.processFile(files[0]);
    }

    async handleFileSelect(e) {
        const files = e.target.files;
        if (files.length) await this.processFile(files[0]);
    }

    showStatus(message, type = 'processing', details = '') {
        const statusText = details ? `${message}\n${details}` : message;
        this.status.textContent = statusText;
        this.status.className = `status ${type}`;
        this.status.style.display = 'block';
        console.log(`[${type}] ${statusText}`); // Add logging for debugging
    }

    // Added method to reinitialize encoder if WebGL context is lost
    async reinitializeEncoder() {
        try {
            this.encoder = new window.GPUBitStreamEncoder(window.CONFIG.SAFE_CHARS);
            return true;
        } catch (error) {
            console.error('Failed to reinitialize encoder:', error);
            this.showStatus('Failed to reinitialize graphics processor', 'error');
            return false;
        }
    }

    async processFile(file) {
        this.metrics.startProcessing();
        this.metrics.startStage('initialization', 'Initializing processor');
        
        // Check if WebGL context is lost and try to reinitialize
        if (this.encoder.gl && this.encoder.gl.isContextLost()) {
            this.metrics.updateStageStatus('initialization', 'Reinitializing graphics processor');
            const success = await this.reinitializeEncoder();
            if (!success) {
                this.metrics.recordError('Failed to reinitialize graphics processor');
                this.metrics.endProcessing();
                return;
            }
        }
        
        // Validate input format
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
            const previewUrl = URL.createObjectURL(file);
            this.preview.src = previewUrl;
            this.preview.style.display = 'block';
            
            // Perform advanced image analysis
            this.metrics.updateStageStatus('analysis', 'Analyzing image properties');
            const analysisResults = await this.analyzer.analyzeImage(file);
            
            // Store analysis results in metrics
            this.metrics.setAnalysis(analysisResults);
            
            // Show status with analysis info
            const imageType = analysisResults.analysis.imageType || 'image';
            
            this.showStatus(
                `Analyzed ${imageType} (${(file.size / 1024).toFixed(2)}KB)`,
                'processing',
                `${analysisResults.dimensions.width}×${analysisResults.dimensions.height}, ` +
                `${analysisResults.analysis.hasTransparency ? 'transparent' : 'opaque'}`
            );
            
            this.metrics.endStage('analysis');
            this.metrics.startStage('formatSelection', 'Selecting optimal format');
            
            // PTA_2: Use raw file as base2 for encoding/decoding
            this.metrics.updateStageStatus('formatSelection', 'Testing initial encoding');
            const buffer = await file.arrayBuffer();
            const initialBits = await this.encoder.toBitArray(buffer);
            const initialEncoded = await this.encoder.encodeBits(initialBits);
            
            this.metrics.updateStageStatus('formatSelection', 'Checking URL size limits');
            
            // Check if original file fits within URL limit (PC_3)
            if (initialEncoded.length <= window.CONFIG.MAX_URL_LENGTH) {
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
    
            // Need to optimize the image - get recommended formats from analysis
            this.metrics.updateStageStatus('formatSelection', 'Image requires optimization');
            
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
                const detectedFormat = await this.detectOptimalFormat(file);
                optimalFormats = [detectedFormat];
                
                this.metrics.updateStageStatus(
                    'formatSelection',
                    `Detected optimal format: ${detectedFormat.split('/')[1].toUpperCase()}`
                );
            }
            
            this.metrics.endStage('formatSelection');
            this.metrics.startStage('compression', 'Compressing image');
            
            // Try compression with recommended formats
            let bestResult = null;
            let bestFormat = null;
            
            for (const format of optimalFormats) {
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
                    bestResult.size < window.CONFIG.MAX_URL_LENGTH * 0.6) {
                    break;
                }
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
            
            const bruteForceResult = await this.compressImageBruteForce(file, optimalFormats[0]);
            if (bruteForceResult) {
                this.processedFormat = optimalFormats[0];
                this.processedSize = bruteForceResult.size;
                
                this.metrics.setProcessedImage({
                    size: bruteForceResult.size,
                    format: optimalFormats[0]
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
                `Target URL length: ${window.CONFIG.MAX_URL_LENGTH}`
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
     * Checks if sufficient GPU memory is available for processing
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

    updateImageStats() {
        window.updateImageStats({
            originalSize: `${(this.originalSize / 1024).toFixed(2)} KB`,
            processedSize: `${(this.processedSize / 1024).toFixed(2)} KB`,
            originalFormat: this.originalFormat,
            finalFormat: this.processedFormat
        });
    }

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

    // PTA_3: Preserve byte boundaries during verification
    verifyEncodedData(encodedData) {
        // Check that all characters are from our safe set
        const invalidChars = [...encodedData].filter(char => !window.CONFIG.SAFE_CHARS.includes(char));
        if (invalidChars.length > 0) {
            throw new Error(`Invalid characters found in encoded data: ${invalidChars.join(', ')}`);
        }
        return true;
    }

    async generateResult(encodedData) {
        this.verifyEncodedData(encodedData);
        const baseUrl = window.location.href.split('?')[0].replace('index.html', '');
        
        // Don't use encodeURIComponent here since our SAFE_CHARS are already URL-safe
        const finalUrl = `${baseUrl}${encodedData}`;
        
        // PC_3: Check max URL length
        if (finalUrl.length > window.CONFIG.MAX_URL_LENGTH) {
            throw new Error(
                'Generated URL exceeds maximum length\n' +
                `URL length: ${finalUrl.length}\n` +
                `Maximum allowed: ${window.CONFIG.MAX_URL_LENGTH}`
            );
        }

        this.resultUrl.textContent = finalUrl;
        this.resultContainer.style.display = 'block';

        // Add URL to browser history for easy sharing
        window.history.pushState({}, '', finalUrl);
    }

    async compressImageHeuristic(file, targetFormat, initialQuality = 0.95) {
        const img = await createImageBitmap(file);
        this.metrics.updateStageStatus(
            'compression',
            `Original dimensions: ${img.width}×${img.height}`
        );
        
        // Try initial compression with provided quality
        const initialResult = await this.tryCompressionLevel(img, {
            format: targetFormat,
            quality: initialQuality,
            scale: 1.0
        });
        
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
        const result = await this.binarySearchCompression(img, targetFormat, initialResult.encodedLength);
        
        // If we found a working compression, try to optimize it
        if (result && result.success) {
            this.metrics.updateStageStatus('compression', 'Optimizing compression parameters');
            const optimized = await this.optimizeCompression(img, targetFormat, result.params);
            return optimized.data;
        }
    
        // Try fallback to more aggressive compression
        this.metrics.updateStageStatus('compression', 'Trying aggressive scaling');
        
        // Get aspect ratio to maintain proportions during aggressive scaling
        const aspectRatio = img.width / img.height;
        
        // Try more aggressive scaling strategies
        for (let scale = 0.8; scale >= 0.3; scale -= 0.1) {
            // Calculate dimensions while maintaining aspect ratio
            const width = Math.round(img.width * scale);
            const height = Math.round(img.height * scale);
            
            // Try medium quality
            const quality = 0.8;
            
            this.metrics.updateStageStatus(
                'compression', 
                `Trying scale ${(scale * 100).toFixed(0)}% (${width}×${height})`
            );
            
            try {
                const result = await this.tryCompressionLevel(img, {
                    format: targetFormat,
                    quality,
                    scale
                });
                
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
        
        // If we get here, we couldn't find a working compression
        return null;
    }

    async tryCompressionLevel(img, params) {
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
            
            const success = encoded.length <= window.CONFIG.MAX_URL_LENGTH;
            
            if (success) {
                // Update preview if successful
                const blob = new Blob([buffer], { type: params.format });
                this.preview.src = URL.createObjectURL(blob);
                
                // Log success
                this.metrics.updateStageStatus(
                    'compression',
                    `Success! URL length: ${encoded.length} characters`
                );
            } else {
                this.metrics.updateStageStatus(
                    'compression',
                    `Too large: ${encoded.length} chars (max: ${window.CONFIG.MAX_URL_LENGTH})`
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
                params
            };
        }
    }

    async binarySearchCompression(img, format, initialLength) {
        const targetSize = window.CONFIG.MAX_URL_LENGTH * 0.95; // Leave some buffer
        const ratio = initialLength / targetSize;
        
        // Initialize search ranges
        let minQuality = 0.1;
        let maxQuality = 0.95;
        let minScale = 0.1;
        let maxScale = 1.0;
        
        // Adjust initial ranges based on ratio
        if (ratio > 4) {
            maxQuality = 0.7;
            maxScale = 0.7;
        } else if (ratio > 2) {
            maxQuality = 0.8;
            maxScale = 0.8;
        }
    
        let bestResult = null;
        let iterations = 0;
        const maxIterations = 8; // Prevent infinite loops
    
        while (iterations < maxIterations) {
            const quality = (minQuality + maxQuality) / 2;
            const scale = (minScale + maxScale) / 2;
            
            const result = await this.tryCompressionLevel(img, {
                format,
                quality,
                scale
            });
    
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
    
        return bestResult || { success: false };
    }

    async optimizeCompression(img, format, workingParams) {
        const optimizationSteps = [
            { quality: 0.05, scale: 0.05 }, // Small steps
            { quality: 0.1, scale: 0.1 },   // Medium steps
            { quality: 0.2, scale: 0.2 }    // Large steps
        ];
    
        let bestResult = await this.tryCompressionLevel(img, workingParams);
        
        // Try increasing quality and scale incrementally
        for (const step of optimizationSteps) {
            let improved = true;
            let iterationCount = 0;
            const maxIterations = 5; // Limit iterations to prevent infinite loops
            
            while (improved && iterationCount < maxIterations) {
                improved = false;
                iterationCount++;
                
                // Try increasing quality
                const qualityResult = await this.tryCompressionLevel(img, {
                    ...workingParams,
                    quality: Math.min(0.95, workingParams.quality + step.quality)
                });
                
                // Try increasing scale
                const scaleResult = await this.tryCompressionLevel(img, {
                    ...workingParams,
                    scale: Math.min(1.0, workingParams.scale + step.scale)
                });
                
                // Pick the better improvement if any
                if (qualityResult.success || scaleResult.success) {
                    const better = (qualityResult.success && scaleResult.success) ? 
                        (qualityResult.encodedLength < scaleResult.encodedLength ? qualityResult : scaleResult) : 
                        (qualityResult.success ? qualityResult : scaleResult);
                        
                    if (better.success) {
                        // Make sure we're actually improving by checking encoded length is acceptable
                        if (better.encodedLength <= window.CONFIG.MAX_URL_LENGTH) {
                            bestResult = better;
                            workingParams = better.params;
                            improved = true;
                        }
                    }
                }
            }
        }
        
        return bestResult;
    }
    

    async compressImageBruteForce(file, targetFormat) {
        const img = await createImageBitmap(file);
        let bestResult = null;

        let width = img.width;
        let height = img.height;
        console.log('Original dimensions:', width, 'x', height);
        
        // Try different compression strategies in order
        for (const strategy of window.CONFIG.COMPRESSION_STRATEGIES) {
            // PTA_6: Use unsigned bigints for scaling calculations
            const scaleArray = new BigUint64Array(1);
            scaleArray[0] = BigInt(100); // Start at 100%
            
            // Create step size using BigUint64Array
            const stepArray = new BigUint64Array(1);
            stepArray[0] = BigInt(10);
            
            // Create minimum scale using BigUint64Array
            const minScaleArray = new BigUint64Array(1);
            minScaleArray[0] = BigInt(10);
            
            for (let scale = scaleArray[0]; scale >= minScaleArray[0]; scale -= stepArray[0]) {
                // Convert BigInt to number for dimension calculations
                const scalePercent = Number(scale);
                try {
                    // PTA_6: Use unsigned bigints for dimension calculations
                    const widthBig = new BigUint64Array(1);
                    widthBig[0] = BigInt(width);
                    const heightBig = new BigUint64Array(1);
                    heightBig[0] = BigInt(height);
                    
                    const scaledWidth = Number(widthBig[0] * BigInt(scalePercent) / BigInt(100));
                    const scaledHeight = Number(heightBig[0] * BigInt(scalePercent) / BigInt(100));
                    
                    console.log(
                        `Trying compression:`,
                        `Format=${targetFormat}`,
                        `Quality=${strategy.quality}`,
                        `Scale=${scalePercent}%`,
                        `Dimensions=${scaledWidth}x${scaledHeight}`
                    );

                    const { buffer, size } = await this.tryCompression(img, {
                        ...strategy,
                        format: targetFormat,
                        width: scaledWidth,
                        height: scaledHeight
                    });

                    // PTA_2: Convert buffer to bit array
                    console.log('Converting compressed buffer to bit array...');
                    const bits = this.encoder.toBitArray(buffer);
                    
                    // PTA_3: Encode while preserving byte boundaries
                    console.log('Encoding compressed data...');
                    const encoded = await this.encoder.encodeBits(bits);

                    console.log('Compressed size:', (size / 1024).toFixed(2), 'KB');
                    console.log('Encoded length:', encoded.length);

                    if (encoded.length <= window.CONFIG.MAX_URL_LENGTH) {
                        // Update preview with compressed version
                        const blob = new Blob([buffer], { type: targetFormat });
                        this.preview.src = URL.createObjectURL(blob);
                        
                        bestResult = {
                            encoded,
                            format: targetFormat,
                            size: size
                        };
                        break;
                    }
                } 
                catch (error) {
                    console.warn(
                        `Compression attempt failed:`,
                        `Scale=${scale}%`,
                        `Error=${error.message}`
                    );
                    continue;
                }
            }
            
            if (bestResult) break; // Exit loop if we found a working solution
        }

        if (!bestResult) {
            throw new Error('Image too large even after maximum compression');
        }

        return bestResult;
    }

    async tryCompression(img, { format, quality, width, height }) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Ensure valid dimensions
        width = width || img.width;
        height = height || img.height;
        quality = quality || 0.95;

        // Calculate dimensions while maintaining aspect ratio
        let scale = 1;
        if (width && height) {
            scale = Math.min(width / img.width, height / img.height);
            width = Math.round(img.width * scale);
            height = Math.round(img.height * scale);
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        blob.arrayBuffer().then(buffer => {
                            resolve({
                                buffer,
                                size: blob.size
                            });
                        }).catch(reject);
                    } else {
                        reject(new Error('Blob creation failed'));
                    }
                },
                format,
                quality
            );
        });
    }

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
    document.addEventListener('DOMContentLoaded', () => new ImageProcessor());
} else {
    new ImageProcessor();
}
