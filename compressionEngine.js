/**
 * Optimized Compression Engine for BitStream Image Share
 * 
 * Handles intelligent image compression with adaptive optimization strategies.
 * Focuses on maximizing URL data density while maintaining acceptable quality.
 * 
 * Key Features:
 * - Progressive and binary search compression strategies
 * - Format-aware optimization (WEBP, AVIF, JPEG, PNG)
 * - Real-time progress tracking and visualization
 * - Memory-efficient processing with early termination
 * - Comprehensive error handling and recovery
 */
window.CompressionEngine = class CompressionEngine {
    /**
     * Initialize compression engine with required dependencies
     * @param {ImageProcessor} imageProcessor - Parent image processor instance
     * @throws {Error} If required dependencies are missing
     */
    constructor(imageProcessor) {
        this.imageProcessor = imageProcessor;
        this.encoder = imageProcessor.encoder;
        this.metrics = imageProcessor?.metrics;
        this.preview = imageProcessor?.uiController?.elements?.preview;
                      
        this.maxSize = imageProcessor.maxSize;
        this.processingAborted = false;
        
        // Enhanced compression parameters based on URL encoding constraints
        this.compressionParams = {
            qualitySteps: [0.95, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15, 0.08],
            scaleSteps: [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2],
            maxIterations: 12,
            targetEfficiency: 0.95 // Use 95% of available URL space
        };
        
        // Track compression history for analysis and visualization
        this.compressionHistory = [];
        this.binarySearchHistory = [];
        
        // Strategy flags for different compression approaches
        this.useProgressiveCompression = true;
        this.enableAdaptiveScaling = true;
        this.enableFormatOptimization = true;
        
        // Validate encoder availability
        this.validateEncoder();
        
        console.log('🗜️ Optimized CompressionEngine initialized');
    }

    /**
     * Validate that the encoder has all required methods
     * @throws {Error} If encoder is missing or invalid
     */
    validateEncoder() {
        if (!this.encoder) {
            throw new Error('Encoder is undefined. Please ensure BitStream encoder is initialized properly.');
        }

        const requiredMethods = ['encodeBits', 'toBitArray'];
        const missingMethods = requiredMethods.filter(method => 
            typeof this.encoder[method] !== 'function'
        );
        
        if (missingMethods.length > 0) {
            throw new Error(`Encoder missing required methods: ${missingMethods.join(', ')}`);
        }
        
        console.log('✅ Encoder validation passed');
    }

    /**
     * Set a new encoder instance (for reinitialization scenarios)
     * @param {Object} encoder - New encoder instance
     */
    setEncoder(encoder) {
        this.encoder = encoder;
        this.validateEncoder();
    }

    /**
     * Get current encoder with validation
     * @returns {Object} Current encoder instance
     * @throws {Error} If encoder is not available
     */
    getEncoder() {
        if (!this.encoder && this.imageProcessor?.encoder) {
            this.encoder = this.imageProcessor.encoder;
            this.validateEncoder();
        }
        
        if (!this.encoder) {
            throw new Error('Encoder not available. Please ensure BitStream encoder is initialized properly.');
        }
        
        return this.encoder;
    }
    
    /**
     * Clear binary search history for new operations
     */
    clearBinarySearchHistory() {
        this.binarySearchHistory = [];
    }

    /**
     * Record binary search iteration for visualization
     * @param {Object} iteration - Search iteration data
     */
    recordBinarySearchIteration(iteration) {
        this.binarySearchHistory.push({
            ...iteration,
            timestamp: performance.now()
        });
        
        // Dispatch event for real-time visualization
        document.dispatchEvent(new CustomEvent('binary-search-progress', {
            detail: {
                history: this.binarySearchHistory,
                current: iteration
            },
            bubbles: true
        }));
    }

    /**
     * Main compression method using heuristic approach
     * Employs progressive refinement with binary search optimization
     * 
     * @param {File} file - Image file to compress
     * @param {string} targetFormat - Target format MIME type
     * @param {number} initialQuality - Initial quality setting (0-1)
     * @returns {Promise<Object|null>} Compression result or null if failed
     */
    async compressImageHeuristic(file, targetFormat, initialQuality = 0.85) {
        const img = await createImageBitmap(file);
        
        // Clear search history for new compression
        this.clearBinarySearchHistory();
        
        // Update metrics with image dimensions
        if (this.metrics) {
            this.metrics.updateStageStatus(
                'compression',
                `Processing ${img.width}×${img.height} image`
            );
        }
        
        // Calculate effective URL space (accounting for base URL)
        const baseUrl = this.getBaseUrl();
        const baseUrlLength = baseUrl.length;
        const effectiveMaxLength = this.maxSize - baseUrlLength - 10; // 10 char safety buffer
        
        // Adjust initial quality for very large images
        if (img.width * img.height > 1000000) { // > 1 megapixel
            initialQuality = Math.min(initialQuality, 0.75);
        }
        
        // Try initial compression at specified quality
        const initialResult = await this.tryCompressionLevel(img, {
            format: targetFormat,
            quality: initialQuality,
            scale: 1.0
        }, effectiveMaxLength);
        
        // Check for processing abortion
        if (this.processingAborted) {
            return null;
        }
        
        // Record the initial attempt
        this.recordCompressionAttempt(initialResult);

        // If initial quality works, return immediately (best case)
        if (initialResult.success) {
            if (this.metrics) {
                this.metrics.updateStageStatus('compression', 'Initial quality sufficient - no optimization needed');
            }
            return initialResult.data;
        }

        // Need optimization - start binary search process
        if (this.metrics) {
            this.metrics.updateStageStatus('compression', 'Optimizing compression parameters');
        }
        
        // Determine search bounds based on initial result severity
        const searchBounds = this.calculateSearchBounds(initialResult, effectiveMaxLength, initialQuality);
        
        // Try multiple binary search strategies
        let bestResult = await this.multiStrategyBinarySearch(img, targetFormat, searchBounds, effectiveMaxLength);
        
        // Check for processing abortion
        if (this.processingAborted) {
            return null;
        }
        
        // If binary search succeeded, optimize further
        if (bestResult && bestResult.success) {
            if (this.metrics) {
                this.metrics.updateStageStatus('compression', 'Fine-tuning compression parameters');
            }
            bestResult = await this.optimizeCompression(img, targetFormat, bestResult.params, effectiveMaxLength);
        }
        
        // Final fallback to aggressive scaling if still not successful
        if (!bestResult || !bestResult.success) {
            if (this.metrics) {
                this.metrics.updateStageStatus('compression', 'Applying aggressive scaling strategy');
            }
            bestResult = await this.aggressiveScalingFallback(img, targetFormat, effectiveMaxLength);
        }
        
        return bestResult?.success ? bestResult.data : null;
    }

    /**
     * Calculate optimal search bounds based on initial compression result
     * @param {Object} initialResult - Initial compression attempt result
     * @param {number} effectiveMaxLength - Target URL length
     * @param {number} initialQuality - Starting quality value
     * @returns {Object} Search bounds configuration
     */
    calculateSearchBounds(initialResult, effectiveMaxLength, initialQuality) {
        const overshoot = initialResult.encodedLength / effectiveMaxLength;
        
        // More aggressive bounds for severe overshoots
        let maxQuality = initialQuality;
        let maxScale = 1.0;
        
        if (overshoot > 3) {
            maxQuality *= 0.6;
            maxScale = 0.5;
        } else if (overshoot > 2) {
            maxQuality *= 0.7;
            maxScale = 0.7;
        } else if (overshoot > 1.5) {
            maxQuality *= 0.8;
            maxScale = 0.8;
        }
        
        return {
            minQuality: 0.1,
            maxQuality,
            minScale: 0.1,
            maxScale
        };
    }

    /**
     * Multi-strategy binary search with different parameter ranges
     * @param {ImageBitmap} img - Image to compress
     * @param {string} targetFormat - Target format
     * @param {Object} baseBounds - Base search bounds
     * @param {number} effectiveMaxLength - Target URL length
     * @returns {Promise<Object|null>} Best compression result
     */
    async multiStrategyBinarySearch(img, targetFormat, baseBounds, effectiveMaxLength) {
        const strategies = [
            // Strategy 1: Balanced approach
            { ...baseBounds },
            
            // Strategy 2: Quality-focused (higher quality, lower scale)
            { 
                minQuality: baseBounds.minQuality, 
                maxQuality: baseBounds.maxQuality * 0.9,
                minScale: baseBounds.minScale, 
                maxScale: baseBounds.maxScale * 0.8 
            },
            
            // Strategy 3: Scale-focused (lower quality, higher scale) 
            { 
                minQuality: baseBounds.minQuality, 
                maxQuality: baseBounds.maxQuality * 0.8,
                minScale: baseBounds.minScale, 
                maxScale: baseBounds.maxScale * 0.6 
            }
        ];
        
        let bestResult = null;
        
        for (const [index, bounds] of strategies.entries()) {
            // Check for processing abortion
            if (this.processingAborted) {
                return null;
            }
            
            if (this.metrics) {
                this.metrics.updateStageStatus(
                    'compression', 
                    `Binary search strategy ${index + 1}/3: Q=${bounds.minQuality.toFixed(2)}-${bounds.maxQuality.toFixed(2)}, S=${bounds.minScale.toFixed(2)}-${bounds.maxScale.toFixed(2)}`
                );
            }
            
            const result = await this.binarySearchCompression(
                img, 
                targetFormat, 
                bounds,
                effectiveMaxLength
            );
            
            // Track best result across strategies
            if (result?.success) {
                if (!bestResult || result.encodedLength < bestResult.encodedLength) {
                    bestResult = result;
                }
                
                // If we found a very efficient result, stop early
                if (result.encodedLength < effectiveMaxLength * 0.8) {
                    break;
                }
            }
        }
        
        return bestResult;
    }

    /**
     * Binary search to find optimal compression parameters
     * @param {ImageBitmap} img - Image to compress
     * @param {string} format - Target format
     * @param {Object} bounds - Search bounds (minQuality, maxQuality, minScale, maxScale)
     * @param {number} effectiveMaxLength - Maximum URL length
     * @returns {Promise<Object>} Search result
     */
    async binarySearchCompression(img, format, bounds, effectiveMaxLength) {
        const targetSize = effectiveMaxLength * 0.95; // Leave 5% buffer
        
        let bestResult = null;
        let iterations = 0;
        const maxIterations = 8;
        
        // Initialize search bounds
        let { minQuality, maxQuality, minScale, maxScale } = bounds;
    
        while (iterations < maxIterations) {
            iterations++;
            
            // Check for processing abortion
            if (this.processingAborted) {
                return { success: false, encodedLength: Infinity, params: { format, quality: 0, scale: 0 } };
            }
            
            const quality = (minQuality + maxQuality) / 2;
            const scale = (minScale + maxScale) / 2;
            
            if (this.metrics) {
                this.metrics.updateStageStatus(
                    'compression',
                    `Binary search iteration ${iterations}/${maxIterations}: Q=${quality.toFixed(2)}, S=${scale.toFixed(2)}`
                );
            }
            
            const result = await this.tryCompressionLevel(img, {
                format,
                quality,
                scale
            }, effectiveMaxLength);

            // Record iteration for visualization
            this.recordBinarySearchIteration({
                iteration: iterations,
                quality: quality,
                scale: scale,
                encodedLength: result.encodedLength,
                success: result.success,
                minQuality,
                maxQuality,
                minScale,
                maxScale,
                targetLength: effectiveMaxLength
            });
    
            if (result.success) {
                // Found working compression - try for better quality
                bestResult = { 
                    ...result,
                    params: { format, quality, scale }
                };
                minQuality = quality;
                minScale = scale;
            } else {
                // Need more aggressive compression
                maxQuality = quality;
                maxScale = scale;
            }
    
            // Check for convergence
            if (Math.abs(maxQuality - minQuality) < 0.05 && Math.abs(maxScale - minScale) < 0.05) {
                if (this.metrics) {
                    this.metrics.updateStageStatus('compression', `Converged after ${iterations} iterations`);
                }
                break;
            }
        }
    
        return bestResult || { 
            success: false, 
            encodedLength: Infinity,
            params: { format, quality: (minQuality + maxQuality) / 2, scale: (minScale + maxScale) / 2 }
        };
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
            { quality: 0.02, scale: 0.02 }, // Fine steps
            { quality: 0.05, scale: 0.05 }  // Medium steps
        ];

        let bestResult = await this.tryCompressionLevel(img, workingParams, effectiveMaxLength);
        let currentParams = { ...workingParams };
        
        for (const step of optimizationSteps) {
            let improved = true;
            let iterationCount = 0;
            const maxIterations = 3;
            
            while (improved && iterationCount < maxIterations) {
                improved = false;
                iterationCount++;
                
                // Check for processing abortion
                if (this.processingAborted) {
                    return bestResult;
                }
                
                // Try increasing quality first (usually more important)
                if (currentParams.quality + step.quality <= 0.95) {
                    const qualityTest = await this.tryCompressionLevel(img, {
                        ...currentParams,
                        quality: currentParams.quality + step.quality
                    }, effectiveMaxLength);
                    
                    if (qualityTest.success && qualityTest.encodedLength <= bestResult.encodedLength) {
                        bestResult = qualityTest;
                        currentParams.quality += step.quality;
                        improved = true;
                        continue;
                    }
                }
                
                // Check for processing abortion
                if (this.processingAborted) {
                    return bestResult;
                }
                
                // Try increasing scale
                if (currentParams.scale + step.scale <= 1.0) {
                    const scaleTest = await this.tryCompressionLevel(img, {
                        ...currentParams,
                        scale: currentParams.scale + step.scale
                    }, effectiveMaxLength);
                    
                    if (scaleTest.success && scaleTest.encodedLength <= bestResult.encodedLength) {
                        bestResult = scaleTest;
                        currentParams.scale += step.scale;
                        improved = true;
                    }
                }
            }
        }
        
        return bestResult;
    }

    /**
     * Aggressive scaling fallback when other methods fail
     * @param {ImageBitmap} img - Image to compress
     * @param {string} targetFormat - Target format
     * @param {number} effectiveMaxLength - Maximum URL length
     * @returns {Promise<Object|null>} Result or null if failed
     */
    async aggressiveScalingFallback(img, targetFormat, effectiveMaxLength) {
        // Calculate aspect ratio for proportional scaling
        const aspectRatio = img.width / img.height;
        
        // Very aggressive scale steps
        const scaleSteps = [0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1];
        const qualitySteps = [0.7, 0.5, 0.3, 0.2, 0.1];
        
        for (const scale of scaleSteps) {
            // Check for processing abortion
            if (this.processingAborted) {
                return null;
            }
            
            // Calculate dimensions maintaining aspect ratio
            const width = Math.round(img.width * scale / 2) * 2; // Even numbers for better encoding
            const height = Math.round(img.height * scale / 2) * 2;
            
            for (const quality of qualitySteps) {
                if (this.metrics) {
                    this.metrics.updateStageStatus(
                        'compression', 
                        `Aggressive attempt: ${(scale * 100).toFixed(0)}% scale (${width}×${height}), ${(quality * 100).toFixed(0)}% quality`
                    );
                }
                
                try {
                    const result = await this.tryCompressionLevel(img, {
                        format: targetFormat,
                        quality,
                        scale
                    }, effectiveMaxLength);
                    
                    // Record attempt
                    this.recordCompressionAttempt(result);
                    
                    if (result.success) {
                        return result;
                    }
                } catch (error) {
                    console.warn('Aggressive scaling attempt failed:', error);
                    continue;
                }
            }
        }
        
        return null; // Complete failure
    }

    /**
     * Try image compression with specified parameters
     * @param {ImageBitmap} img - Image to compress
     * @param {Object} options - Compression options (format, quality, width, height)
     * @returns {Promise<Object>} Compression result with buffer and size
     */
    async tryCompression(img, options) {
        const { format, quality = 0.85, width = null, height = null } = options;
        
        // Create canvas for compression
        const canvas = document.createElement('canvas');
        const targetWidth = width || img.width;
        const targetHeight = height || img.height;
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Unable to get 2D context for compression');
        }
        
        // Configure context for optimal quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw image to canvas with specified dimensions
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        
        // Convert to blob with compression
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error(`Failed to encode image as ${format}`));
                        return;
                    }
                    
                    // Convert blob to ArrayBuffer for encoding
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
     * Try a specific compression level and validate against URL limits
     * @param {ImageBitmap} img - Image to compress
     * @param {Object} params - Compression parameters
     * @param {number} effectiveMaxLength - Target URL length (unused - calculated internally)
     * @returns {Promise<Object>} Compression result
     */
    async tryCompressionLevel(img, params, effectiveMaxLength) {
        // Check for processing abortion
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

            // Update metrics with compression details
            if (this.metrics) {
                this.metrics.updateStageStatus(
                    'compression',
                    `${params.format.split('/')[1].toUpperCase()} @ ` +
                    `Q${Math.round(params.quality * 100)}, ` +
                    `${Math.round(img.width * params.scale)}×${Math.round(img.height * params.scale)} = ` +
                    `${(size / 1024).toFixed(2)}KB`
                );
            }

            // Encode with comprehensive error handling
            let encoded;
            try {
                encoded = await this.encoder.encodeBits(buffer);
            } catch (encodingError) {
                console.error('Encoding error:', encodingError);
                throw new Error(`Failed to encode compressed data: ${encodingError.message}`);
            }

            // Store encoded string in metrics for real-time display
            if (this.metrics && typeof this.metrics.setCurrentEncodedString === 'function') {
                this.metrics.setCurrentEncodedString(encoded);
            }
            
            // Use consistent URL length validation
            const success = this.verifyFinalUrlLength(encoded);
            
            if (success) {
                // Update preview on successful compression
                this.updatePreview(buffer, params.format);
                
                if (this.metrics) {
                    this.metrics.updateStageStatus(
                        'compression',
                        `✅ Success! Final URL: ${this.getBaseUrl().length + encoded.length} chars (max: ${this.maxSize})`
                    );
                }
            } else {
                const finalLength = this.getBaseUrl().length + encoded.length;
                if (this.metrics) {
                    this.metrics.updateStageStatus(
                        'compression',
                        `❌ Too large: ${finalLength} chars (max: ${this.maxSize})`
                    );
                }
            }

            return {
                success,
                encodedLength: encoded.length,
                finalUrlLength: this.getBaseUrl().length + encoded.length,
                data: success ? {
                    encoded,
                    format: params.format,
                    size
                } : null,
                params
            };
        } catch (error) {
            console.warn('Compression attempt failed:', params, error);
            
            if (this.metrics) {
                this.metrics.updateStageStatus(
                    'compression',
                    `❌ Failed: ${error.message}`
                );
            }
            
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
     * Determine optimal formats for compression based on analysis
     * @param {File} file - Image file
     * @param {Object} analysisResults - Analysis results
     * @returns {Promise<string[]>} Array of format MIME types
     */
    async determineOptimalFormats(file, analysisResults) {
        let optimalFormats;
        
        if (analysisResults?.recommendations?.formatRankings) {
            // Use analysis-based format rankings
            optimalFormats = analysisResults.recommendations.formatRankings.map(f => f.format);
            
            if (this.metrics) {
                this.metrics.updateStageStatus(
                    'formatSelection', 
                    `Analyzed formats: ${optimalFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}`
                );
            }
        } else {
            // Fallback to format detection
            try {
                const detectedFormat = await this.detectOptimalFormat(file);
                optimalFormats = [detectedFormat];
                
                if (this.metrics) {
                    this.metrics.updateStageStatus(
                        'formatSelection',
                        `Detected format: ${detectedFormat.split('/')[1].toUpperCase()}`
                    );
                }
            } catch (error) {
                console.warn('Format detection failed:', error);
                // Default to efficient web formats
                optimalFormats = ['image/webp', 'image/avif', 'image/jpeg', 'image/png'];
                
                if (this.metrics) {
                    this.metrics.updateStageStatus(
                        'formatSelection',
                        'Using default formats: WEBP, AVIF, JPEG, PNG'
                    );
                }
            }
        }
        
        // Ensure WEBP is included as fallback
        if (!optimalFormats.includes('image/webp')) {
            optimalFormats.push('image/webp');
        }
        
        return optimalFormats;
    }

    /**
     * Detect optimal format for an image through size comparison
     * @param {File} file - Image file
     * @returns {Promise<string>} Best format MIME type
     */
    async detectOptimalFormat(file) {
        const img = await createImageBitmap(file);
        let bestFormat = null;
        let smallestSize = Infinity;

        // Test formats from configuration
        const formats = window.CONFIG.SUPPORTED_INPUT_FORMATS.filter(format => 
            format !== 'image/svg+xml' && // Skip SVG for raster conversion
            format !== 'image/gif'        // Skip GIF to avoid animation loss
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

    /**
     * Update preview image with compressed result
     * @param {ArrayBuffer} buffer - Compressed image buffer
     * @param {string} format - Image format
     */
    updatePreview(buffer, format) {
        if (!this.preview) return;
        
        try {
            const blob = new Blob([buffer], { type: format });
            
            // Clean up previous preview URL
            if (this.preview.src && this.preview.src.startsWith('blob:')) {
                if (this.imageProcessor?.resourceManager) {
                    this.imageProcessor.resourceManager.revokeTrackedObjectURL(this.preview.src);
                } else {
                    URL.revokeObjectURL(this.preview.src);
                }
            }
            
            // Set new preview URL
            if (this.imageProcessor?.resourceManager) {
                this.preview.src = this.imageProcessor.resourceManager.createAndTrackObjectURL(blob);
            } else {
                this.preview.src = URL.createObjectURL(blob);
            }
        } catch (error) {
            console.warn('Failed to update preview:', error);
        }
    }

    /**
     * Record compression attempt for metrics and visualization
     * @param {Object} result - Compression result
     * @param {string} [phase='compression'] - Processing phase
     */
    recordCompressionAttempt(result, phase = 'compression') {
        const attempt = {
            ...result,
            timestamp: performance.now(),
            phase
        };
        
        this.compressionHistory.push(attempt);
        
        // Forward to metrics system
        if (this.metrics) {
            this.metrics.recordCompressionAttempt({
                format: result.params?.format,
                quality: result.params?.quality,
                width: result.params?.width,
                height: result.params?.height,
                size: result.data?.size,
                encodedLength: result.encodedLength,
                finalUrlLength: result.finalUrlLength,
                success: result.success,
                phase
            });
        }
    }

    /**
     * Get consistent base URL calculation
     * @returns {string} Base URL for final result
     */
    getBaseUrl() {
        return window.location.href.split('?')[0].replace('index.html', '');
    }

    /**
     * Calculate effective max length consistently
     * @returns {number} Effective maximum length for encoded data
     */
    getEffectiveMaxLength() {
        const baseUrl = this.getBaseUrl();
        const baseUrlLength = baseUrl.length;
        const safetyBuffer = 10;
        
        return this.maxSize - baseUrlLength - safetyBuffer;
    }

    /**
     * Verify that final URL will fit within limits
     * @param {string} encodedData - Encoded data string
     * @returns {boolean} Whether URL will fit
     */
    verifyFinalUrlLength(encodedData) {
        const baseUrl = this.getBaseUrl();
        const finalUrl = `${baseUrl}${encodedData}`;
        const fits = finalUrl.length <= this.maxSize;
        
        return fits;
    }

    /**
     * Validate encoded data integrity
     * @param {string} encodedData - Encoded data string
     * @returns {boolean} Whether data is valid
     * @throws {Error} If validation fails
     */
    verifyEncodedData(encodedData) {
        if (!encodedData || encodedData.length === 0) {
            throw new Error('No encoded data provided for verification');
        }
        
        // Check character set validity
        if (window.CONFIG?.SAFE_CHARS) {
            const invalidChars = [...encodedData].filter(char => !window.CONFIG.SAFE_CHARS.includes(char));
            if (invalidChars.length > 0) {
                const sample = invalidChars.slice(0, 10).join(', ');
                throw new Error(`Invalid characters in encoded data: ${sample}`);
            }
        }
        
        // Check length constraints
        if (encodedData.length > this.maxSize) {
            throw new Error(`Encoded data exceeds maximum length: ${encodedData.length} > ${this.maxSize}`);
        }
        
        return true;
    }

    /**
     * Legacy method for backward compatibility
     * @deprecated Use compressImageHeuristic instead
     */
    async compressImageBruteForce(file, targetFormat) {
        console.warn('compressImageBruteForce is deprecated, using heuristic method');
        return this.compressImageHeuristic(file, targetFormat);
    }

    /**
     * Get compression statistics
     * @returns {Object} Compression statistics
     */
    getCompressionStats() {
        return {
            totalAttempts: this.compressionHistory.length,
            successfulAttempts: this.compressionHistory.filter(a => a.success).length,
            binarySearchIterations: this.binarySearchHistory.length,
            bestResult: this.compressionHistory.reduce((best, current) => {
                if (!current.success) return best;
                if (!best || current.encodedLength < best.encodedLength) return current;
                return best;
            }, null)
        };
    }
};
