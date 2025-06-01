window.CompressionEngine = class CompressionEngine {
    constructor(imageProcessor) {
        this.imageProcessor = imageProcessor;
        this.encoder = imageProcessor.encoder;
        this.metrics = imageProcessor && imageProcessor.metrics ? imageProcessor.metrics : null;
        this.preview = imageProcessor && imageProcessor.uiController && 
                      imageProcessor.uiController.elements ? 
                      imageProcessor.uiController.elements.preview : null;
                      
        this.maxSize = imageProcessor.maxSize;
        this.processingAborted = false;
        
        // Track binary search history for visualization
        this.binarySearchHistory = [];
        
        // Check if encoder is available and log error if not
        if (!this.encoder) {
            console.error('CompressionEngine initialization error: encoder is undefined');
            throw new Error('Encoder not available. Please ensure BitStream encoder is initialized properly.');
        }
    }

    setEncoder(encoder) {
        this.encoder = encoder;
    }

    getEncoder() {
        // If encoder is not available, try to get it from imageProcessor
        if (!this.encoder && this.imageProcessor && this.imageProcessor.encoder) {
            this.encoder = this.imageProcessor.encoder;
        }
        
        if (!this.encoder) {
            throw new Error('Encoder not available. Please ensure BitStream encoder is initialized properly.');
        }
        
        return this.encoder;
    }
    
    /**
     * Clear binary search history
     */
    clearBinarySearchHistory() {
        this.binarySearchHistory = [];
    }

    /**
     * Record binary search iteration
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
 * Compress image using heuristic approach
 * @param {File} file - Image file
 * @param {string} targetFormat - Target format MIME type
 * @param {number} initialQuality - Initial quality (0-1)
 * @returns {Promise<Object|null>} Compression result or null if failed
 */
async compressImageHeuristic(file, targetFormat, initialQuality = 0.85) {
    const img = await createImageBitmap(file);
    
    // Clear search history at start
    this.clearBinarySearchHistory();
    
    // Fix: Check if metrics is available before calling methods
    if (this.metrics) {
        this.metrics.updateStageStatus(
            'compression',
            `Original dimensions: ${img.width}×${img.height}`
        );
    } else {
        console.log(`Original dimensions: ${img.width}×${img.height}`);
    }
    
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
    if (this.metrics) {
        this.metrics.recordCompressionAttempt({
            format: targetFormat,
            quality: initialQuality,
            width: img.width,
            height: img.height,
            size: initialResult.data ? initialResult.data.size : null,
            encodedLength: initialResult.encodedLength,
            success: initialResult.success
        });
    }

    // If high quality works, return immediately
    if (initialResult.success) {
        return initialResult.data;
    }

    // Binary search to find first working compression
    if (this.metrics) {
        this.metrics.updateStageStatus('compression', 'Binary searching for optimal compression');
    }
    
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
    
    let bestResult = null;
    let closestResult = null;
    let closestDistance = Infinity;
    
    for (const searchParams of searchAttempts) {
        // Abort if processing was cancelled
        if (this.processingAborted) {
            return null;
        }
        
        if (this.metrics) {
            this.metrics.updateStageStatus(
                'compression', 
                `Binary search with Q=${searchParams.minQuality.toFixed(2)}-${searchParams.maxQuality.toFixed(2)}, S=${searchParams.minScale.toFixed(2)}-${searchParams.maxScale.toFixed(2)}`
            );
        }
        
        const result = await this.binarySearchCompression(
            img, 
            targetFormat, 
            initialResult.encodedLength,
            searchParams.minQuality,
            searchParams.maxQuality,
            searchParams.minScale,
            searchParams.maxScale,
            effectiveMaxLength
        );
        
        // Track the closest result to target size
        if (result && result.success) {
            if (!bestResult || result.encodedLength < bestResult.encodedLength) {
                bestResult = result;
            }
            if (this.metrics) {
                this.metrics.updateStageStatus(
                    'compression', 
                    `Found working parameters: Q=${result.params.quality.toFixed(2)}, S=${result.params.scale.toFixed(2)}`
                );
            }
        } else if (result) {
            const distance = result.encodedLength - effectiveMaxLength;
            if (distance < closestDistance) {
                closestDistance = distance;
                closestResult = result;
            }
        }
        
        // Record how close we got for diagnostics
        if (result && this.metrics) {
            this.metrics.updateStageStatus(
                'compression',
                `Attempt result: ${result.encodedLength} chars (${((result.encodedLength / effectiveMaxLength) * 100).toFixed(1)}% of limit)`
            );
        }
        
        // Continue to the next attempt, don't break early
    }
    
    // After trying all parameters, optimize the best result we found
    if (bestResult && bestResult.success) {
        if (this.metrics) {
            this.metrics.updateStageStatus('compression', 'Optimizing compression parameters');
        }
        const optimized = await this.optimizeCompression(img, targetFormat, bestResult.params, effectiveMaxLength);
        
        // Abort if processing was cancelled
        if (this.processingAborted) {
            return null;
        }
        
        return optimized.data;
    } else if (closestResult && this.metrics) {
        // If we got close but not quite there, try to make small adjustments
        this.metrics.updateStageStatus(
            'compression', 
            `Close attempt (${((closestDistance / effectiveMaxLength) * 100).toFixed(1)}% over limit), trying refinements`
        );
    }

    // Try fallback to more aggressive compression
    if (this.metrics) {
        this.metrics.updateStageStatus('compression', 'Trying aggressive scaling');
    }
    
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
            if (this.metrics) {
                this.metrics.updateStageStatus(
                    'compression', 
                    `Trying scale ${(scale * 100).toFixed(0)}% (${width}×${height}) at quality ${(quality * 100).toFixed(0)}%`
                );
            }
            
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
                if (this.metrics) {
                    this.metrics.recordCompressionAttempt({
                        format: targetFormat,
                        quality,
                        width,
                        height,
                        size: result.data ? result.data.size : null,
                        encodedLength: result.encodedLength,
                        success: result.success
                    });
                }
                
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
        
        // Initialize search bounds
        let currentMinQuality = minQuality;
        let currentMaxQuality = maxQuality;
        let currentMinScale = minScale;
        let currentMaxScale = maxScale;
    
        while (iterations < maxIterations) {
            // Increment iterations counter first to ensure it's counted
            iterations++;
            
            // Abort if processing was cancelled
            if (this.processingAborted) {
                return { 
                    success: false, 
                    encodedLength: initialLength,
                    params: {
                        format,
                        quality: (currentMinQuality + currentMaxQuality) / 2,
                        scale: (currentMinScale + currentMaxScale) / 2
                    }
                };
            }
            
            const quality = (currentMinQuality + currentMaxQuality) / 2;
            const scale = (currentMinScale + currentMaxScale) / 2;
            
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

            // Record this iteration in binary search history
            this.recordBinarySearchIteration({
                iteration: iterations,
                quality: quality,
                scale: scale,
                encodedLength: result.encodedLength,
                success: result.success,
                minQuality: currentMinQuality,
                maxQuality: currentMaxQuality,
                minScale: currentMinScale,
                maxScale: currentMaxScale,
                targetLength: effectiveMaxLength
            });
    
            if (result.success) {
                // Found a working compression, store it and try for better quality
                bestResult = { 
                    ...result,
                    params: {
                        format,
                        quality,
                        scale
                    }
                };
                currentMinQuality = quality;
                currentMinScale = scale;
            } else {
                // Compression not sufficient, need to be more aggressive
                currentMaxQuality = quality;
                currentMaxScale = scale;
            }
    
            // If we're close enough to target size or ranges are very small, break
            if (Math.abs(currentMaxQuality - currentMinQuality) < 0.05 && Math.abs(currentMaxScale - currentMinScale) < 0.05) {
                if (this.metrics) {
                    this.metrics.updateStageStatus(
                        'compression',
                        `Binary search converged after ${iterations} iterations`
                    );
                }
                break;
            }
        }
    
        // Always return with proper params property
        return bestResult || { 
            success: false, 
            encodedLength: initialLength,
            params: {
                format,
                quality: (currentMinQuality + currentMaxQuality) / 2,
                scale: (currentMinScale + currentMaxScale) / 2
            }
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
        let initialEncoded;
        
        try {
            // Use DirectBaseEncoder directly
            initialEncoded = await this.encoder.encodeBits(buffer);
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
        
        if (this.metrics) {
            this.metrics.updateStageStatus(
                'compression',
                `Brute force with scales ${scaleSteps.map(s => (s * 100).toFixed(0) + '%').join(', ')} and qualities ${qualitySteps.map(q => (q * 100).toFixed(0) + '%').join(', ')}`
            );
        }
        
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
                    if (this.metrics) {
                        this.metrics.updateStageStatus(
                            'compression',
                            `Trying ${targetFormat.split('/')[1].toUpperCase()} at ${(scale * 100).toFixed(0)}% scale, ${(quality * 100).toFixed(0)}% quality (${width}x${height})`
                        );
                    }
                    
                    const { buffer, size } = await this.tryCompression(img, {
                        format: targetFormat,
                        quality: quality,
                        width: width,
                        height: height
                    });
                    
                    // Record this attempt in metrics
                    if (this.metrics) {
                        this.metrics.recordCompressionAttempt({
                            format: targetFormat,
                            quality: quality,
                            width: width,
                            height: height,
                            size: size
                        });
                    }

                    if (this.metrics) {
                        this.metrics.updateStageStatus(
                            'compression',
                            `Compressed to ${(size / 1024).toFixed(2)}KB, encoding...`
                        );
                    }
                    
                    // Encode directly with DirectBaseEncoder
                    const encoded = await this.encoder.encodeBits(buffer);

                    if (this.metrics) {
                        this.metrics.updateStageStatus(
                            'compression',
                            `Encoded length: ${encoded.length} chars (limit: ${effectiveMaxLength})`
                        );
                    }

                    // Check if within limit
                    if (encoded.length <= effectiveMaxLength) {
                        // Update preview with compressed version
                        const blob = new Blob([buffer], { type: targetFormat });
                        
                        // Only update preview if it exists
                        if (this.preview) {
                            // Revoke previous preview URL if it exists
                            if (this.preview.src && this.preview.src.startsWith('blob:')) {
                                if (this.imageProcessor && this.imageProcessor.resourceManager) {
                                    this.imageProcessor.resourceManager.revokeTrackedObjectURL(this.preview.src);
                                } else {
                                    URL.revokeObjectURL(this.preview.src);
                                }
                            }
                            
                            // Create and set new preview URL
                            if (this.imageProcessor && this.imageProcessor.resourceManager) {
                                this.preview.src = this.imageProcessor.resourceManager.createAndTrackObjectURL(blob);
                            } else {
                                this.preview.src = URL.createObjectURL(blob);
                            }
                        }
                        
                        bestResult = {
                            encoded,
                            format: targetFormat,
                            size: size
                        };
                        
                        if (this.metrics) {
                            this.metrics.updateStageStatus(
                                'compression',
                                `Success! Found working compression: ${(size / 1024).toFixed(2)}KB, ${encoded.length} chars`
                            );
                        }
                        
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
            if (this.metrics) {
                this.metrics.updateStageStatus(
                    'compression',
                    `Failed to find working compression after trying all combinations`
                );
            }
            
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
                    
                    if (this.metrics) {
                        this.metrics.updateStageStatus(
                            'compression',
                            `Last resort: Creating thumbnail (${thumbWidth}x${thumbHeight})`
                        );
                    }
                    
                    const { buffer, size } = await this.tryCompression(img, {
                        format: targetFormat,
                        quality: 0.4,
                        width: thumbWidth,
                        height: thumbHeight
                    });
                    
                    const encoded = await this.encoder.encodeBits(buffer);
                    
                    if (encoded.length <= effectiveMaxLength) {
                        const blob = new Blob([buffer], { type: targetFormat });
                        
                        // Only update preview if it exists
                        if (this.preview) {
                            // Revoke previous preview URL if it exists
                            if (this.preview.src && this.preview.src.startsWith('blob:')) {
                                if (this.imageProcessor && this.imageProcessor.resourceManager) {
                                    this.imageProcessor.resourceManager.revokeTrackedObjectURL(this.preview.src);
                                } else {
                                    URL.revokeObjectURL(this.preview.src);
                                }
                            }
                            
                            // Create and set new preview URL
                            if (this.imageProcessor && this.imageProcessor.resourceManager) {
                                this.preview.src = this.imageProcessor.resourceManager.createAndTrackObjectURL(blob);
                            } else {
                                this.preview.src = URL.createObjectURL(blob);
                            }
                        }
                        
                        bestResult = {
                            encoded,
                            format: targetFormat,
                            size: size
                        };
                        
                        if (this.metrics) {
                            this.metrics.updateStageStatus(
                                'compression',
                                `Created thumbnail: ${(size / 1024).toFixed(2)}KB, ${encoded.length} chars`
                            );
                        }
                        
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
            if (this.metrics) {
                this.metrics.startStage('analysis', 'Analyzing image properties');
            }
            
            // Use the ImageAnalyzer for detailed analysis
            const analysisResults = await this.analyzer.analyzeImage(file);
            
            // Store results in metrics
            if (this.metrics) {
                this.metrics.setAnalysis(analysisResults);
            }
            
            // Get optimal format recommendations
            const formatRankings = analysisResults.recommendations.formatRankings;
            const optimalFormats = formatRankings.map(format => format.format);
            
            if (this.metrics) {
                this.metrics.endStage('analysis');
            }
            
            return {
                analysis: analysisResults,
                optimalFormats,
                suggestedQuality: analysisResults.recommendations.suggestedQuality
            };
        } catch (error) {
            console.error('Image analysis error:', error);
            if (this.metrics) {
                this.metrics.recordError('Image analysis failed', error);
                // Fallback to basic format detection
                this.metrics.endStage('analysis');
            }
            
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
            if (this.metrics) {
                this.metrics.updateStageStatus(
                    'compression',
                    `${params.format.split('/')[1].toUpperCase()} @ ` +
                    `Q${Math.round(params.quality * 100)}, ` +
                    `${Math.round(img.width * params.scale)}×${Math.round(img.height * params.scale)} = ` +
                    `${(size / 1024).toFixed(2)}KB`
                );
            } else {
                console.log(
                    `${params.format.split('/')[1].toUpperCase()} @ ` +
                    `Q${Math.round(params.quality * 100)}, ` +
                    `${Math.round(img.width * params.scale)}×${Math.round(img.height * params.scale)} = ` +
                    `${(size / 1024).toFixed(2)}KB`
                );
            }
    
            const encoded = await this.encoder.encodeBits(buffer);

            if (this.metrics && typeof this.metrics.setCurrentEncodedString === 'function') {
                this.metrics.setCurrentEncodedString(encoded);
            }
            
            const success = encoded.length <= effectiveMaxLength;
            
            if (success) {
                // Update preview if successful
                const blob = new Blob([buffer], { type: params.format });
                
                // Only update preview if it exists
                if (this.preview) {
                    // Revoke previous preview URL if it exists
                    if (this.preview.src && this.preview.src.startsWith('blob:')) {
                        if (this.imageProcessor && this.imageProcessor.resourceManager) {
                            this.imageProcessor.resourceManager.revokeTrackedObjectURL(this.preview.src);
                        } else {
                            URL.revokeObjectURL(this.preview.src);
                        }
                    }
                    
                    // Create and set new preview URL
                    if (this.imageProcessor && this.imageProcessor.resourceManager) {
                        this.preview.src = this.imageProcessor.resourceManager.createAndTrackObjectURL(blob);
                    } else {
                        this.preview.src = URL.createObjectURL(blob);
                    }
                }
                
                // Log success
                if (this.metrics) {
                    this.metrics.updateStageStatus(
                        'compression',
                        `Success! URL length: ${encoded.length} characters (max: ${effectiveMaxLength})`
                    );
                } else {
                    console.log(`Success! URL length: ${encoded.length} characters (max: ${effectiveMaxLength})`);
                }
            } else {
                if (this.metrics) {
                    this.metrics.updateStageStatus(
                        'compression',
                        `Too large: ${encoded.length} chars (max: ${effectiveMaxLength})`
                    );
                } else {
                    console.log(`Too large: ${encoded.length} chars (max: ${effectiveMaxLength})`);
                }
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
            
            if (this.metrics) {
                this.metrics.updateStageStatus(
                    'compression',
                    `Compression failed: ${error.message}`
                );
            } else {
                console.log(`Compression failed: ${error.message}`);
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
            
            if (this.metrics) {
                this.metrics.updateStageStatus(
                    'formatSelection', 
                    `Selected formats: ${optimalFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}`
                );
            }
        } else {
            // Fallback to original method
            try {
                const detectedFormat = await this.detectOptimalFormat(file);
                optimalFormats = [detectedFormat];
                
                if (this.metrics) {
                    this.metrics.updateStageStatus(
                        'formatSelection',
                        `Detected optimal format: ${detectedFormat.split('/')[1].toUpperCase()}`
                    );
                }
            } catch (error) {
                console.warn('Format detection failed:', error);
                // Default to common web formats if detection fails
                optimalFormats = ['image/webp', 'image/jpeg', 'image/png'];
                
                if (this.metrics) {
                    this.metrics.updateStageStatus(
                        'formatSelection',
                        'Using default formats: WEBP, JPEG, PNG'
                    );
                }
            }
        }
        
        // Add webp as a fallback if not already in the list
        if (!optimalFormats.includes('image/webp')) {
            optimalFormats.push('image/webp');
        }
        
        return optimalFormats;
    }

    /**
     * What: Verify encoded data integrity
     * How: 
     * @param {string} encodedData - Encoded data string
     * @returns {boolean} - Whether data is valid
     */
    verifyEncodedData(encodedData) {
        // Ensure we have data to verify
        if (!encodedData || encodedData.length === 0) {
            throw new Error('No encoded data provided for verification');
        }
        
        // Check that all characters are from our safe set
        if (!window.CONFIG || !window.CONFIG.SAFE_CHARS) {
            console.warn('CONFIG.SAFE_CHARS not available for verification');
            return true; // Can't verify without config, assume valid
        }
        
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

};
