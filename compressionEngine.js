/**
 * Optimized Compression Engine for BitStream Image Share (Refactored)
 *
 * Handles intelligent image compression with adaptive optimization strategies.
 * It is decoupled from UI and metrics, reporting its progress via the event bus.
 */
window.CompressionEngine = class CompressionEngine {
    /**
     * Initialize compression engine with required dependencies.
     * @param {GPUBitStreamEncoder} encoder - The encoder instance for URL-safe string conversion.
     * @param {EventBus} eventBus - The central event bus for communication.
     * @param {Object} config - The application's configuration object.
     * @param {SharedUtils} utils - Shared utility functions.
     */
    constructor(encoder, eventBus, configValidator, utils) {
        // Get the actual config object from the validator
        const config = configValidator ? configValidator.getConfig() : null;
    
        this.encoder = encoder;
        this.eventBus = eventBus;
        this.config = config;
        this.utils = utils;
    
        // Validate dependencies to prevent future errors
        if (!this.eventBus || typeof this.eventBus.on !== 'function') {
            throw new Error("CompressionEngine: A valid EventBus instance is required.");
        }
        if (!this.config) {
            throw new Error("CompressionEngine: A valid configuration object is required.");
        }
    
        this.processingAborted = false;
    
        // Listen for cancellation events
        this.eventBus.on('processing:cancel', () => {
            this.processingAborted = true;
        });
    
        console.log('🗜️ CompressionEngine initialized');
    }

    /**
     * Main compression method using a heuristic approach.
     * Employs progressive refinement with binary search optimization.
     *
     * @param {File} file - Image file to compress.
     * @param {Object} analysisResults - The results from the ImageAnalyzer.
     * @param {number} effectiveMaxLength - The target URL length for the encoded data.
     * @returns {Promise<Object|null>} Compression result or null if failed.
     */
    async compressImageHeuristic(file, analysisResults, effectiveMaxLength) {
        this.processingAborted = false;
        const img = await createImageBitmap(file);

        const optimalFormats = this.determineOptimalFormats(analysisResults);

        for (const format of optimalFormats) {
            if (this.processingAborted) return null;

            this.eventBus.emit('processing:stage-changed', {
                stageName: 'compression',
                message: `Attempting compression with ${this.utils.formatImageFormat(format)}...`
            });

            try {
                // Find the recommended quality for this format from the analysis
                const ranking = analysisResults.recommendations.formatRankings.find(f => f.format === format);
                const initialQuality = ranking ? ranking.quality : this.config.COMPRESSION_QUALITY_MAX || 0.85;

                const result = await this.findOptimalCompression(img, format, initialQuality, effectiveMaxLength);

                if (result && result.success) {
                    this.eventBus.emit('processing:stage-changed', {
                        stageName: 'compression',
                        message: `Successfully compressed to ${this.utils.formatImageFormat(format)}.`
                    });
                    return result; // Return the first successful result
                }
            } catch (error) {
                this.eventBus.emit('warning', {
                    message: `Compression with ${format} failed: ${error.message}`,
                    category: 'compression'
                });
            }
        }

        this.eventBus.emit('warning', {
             message: 'Could not find a suitable compression. Trying aggressive fallback.',
             category: 'compression'
        });

        // If no format worked, try a last-ditch aggressive compression
        const fallbackFormat = 'image/webp';
        const aggressiveResult = await this.aggressiveScalingFallback(img, fallbackFormat, effectiveMaxLength);

        return aggressiveResult?.success ? aggressiveResult : null;
    }

    /**
     * Uses a binary search to find the best compression parameters (quality and scale).
     * @param {ImageBitmap} img - The image to compress.
     * @param {string} format - The target image format.
     * @param {number} initialQuality - The starting quality for the search.
     * @param {number} effectiveMaxLength - The maximum allowed length for the encoded string.
     * @returns {Promise<Object|null>} The best successful compression result.
     */
    async findOptimalCompression(img, format, initialQuality, effectiveMaxLength) {
        let low = 0;
        let high = 1;
        let bestResult = null;
        const maxIterations = 8; // Limit iterations to prevent endless loops

        for (let i = 0; i < maxIterations; i++) {
            if (this.processingAborted) return null;

            const mid = (low + high) / 2;
            // 'mid' now represents a combination of quality and scale
            const quality = this.utils.getNestedProperty(this.config, 'COMPRESSION_QUALITY_MIN', 0.1) + (initialQuality - this.utils.getNestedProperty(this.config, 'COMPRESSION_QUALITY_MIN', 0.1)) * mid;
            const scale = this.utils.getNestedProperty(this.config, 'COMPRESSION_SCALE_MIN', 0.1) + (this.utils.getNestedProperty(this.config, 'COMPRESSION_SCALE_MAX', 1.0) - this.utils.getNestedProperty(this.config, 'COMPRESSION_SCALE_MIN', 0.1)) * mid;
            
            this.eventBus.emit('processing:stage-changed', {
                stageName: 'compression',
                message: `Testing [${format.split('/')[1].toUpperCase()}] at quality ${quality.toFixed(2)}, scale ${scale.toFixed(2)}`
            });

            const currentResult = await this.tryCompressionLevel(img, { format, quality, scale }, effectiveMaxLength);
            this.eventBus.emit('metrics:compression-attempt', { attempt: currentResult });

            if (currentResult.success) {
                bestResult = currentResult;
                low = mid; // It worked, try for higher quality/scale
            } else {
                high = mid; // It failed, need more compression
            }

            // If we've converged enough, exit
            if ((high - low) < 0.05) break;
        }

        return bestResult;
    }
    
    /**
     * Aggressive scaling fallback when other methods fail.
     * @param {ImageBitmap} img - The image to compress.
     * @param {string} targetFormat - The target image format.
     * @param {number} effectiveMaxLength - The maximum allowed length for the encoded string.
     * @returns {Promise<Object|null>} The result of the aggressive compression attempt.
     */
    async aggressiveScalingFallback(img, targetFormat, effectiveMaxLength) {
        this.eventBus.emit('processing:stage-changed', {
            stageName: 'compression',
            message: 'Trying aggressive scaling fallback...'
        });

        const aggressiveSteps = [0.5, 0.3, 0.15];
        for (const scale of aggressiveSteps) {
            if (this.processingAborted) return null;
            const quality = this.utils.getNestedProperty(this.config, 'COMPRESSION_QUALITY_MIN', 0.1);
            const result = await this.tryCompressionLevel(img, { format: targetFormat, quality, scale }, effectiveMaxLength);
            this.eventBus.emit('metrics:compression-attempt', { attempt: result });
            if (result.success) {
                return result;
            }
        }
        return null;
    }

    /**
     * Tries a specific compression level and validates the result against the URL length limit.
     * @param {ImageBitmap} img - The image to compress.
     * @param {Object} params - The compression parameters (format, quality, scale).
     * @param {number} effectiveMaxLength - The target URL length.
     * @returns {Promise<Object>} An object containing the result of the compression attempt.
     */
    async tryCompressionLevel(img, params, effectiveMaxLength) {
        if (this.processingAborted) {
            return { success: false, reason: 'aborted' };
        }

        try {
            const { buffer, size } = await this.tryCompression(img, {
                format: params.format,
                quality: params.quality,
                width: Math.round(img.width * params.scale),
                height: Math.round(img.height * params.scale)
            });

            const encoded = await this.encoder.encodeBits(buffer);

            const success = encoded.length <= effectiveMaxLength;
            
            // On success, emit an event to update the preview
            if (success) {
                this.eventBus.emit('ui:update-preview', { buffer, format: params.format });
            }

            return {
                success,
                encodedLength: encoded.length,
                data: success ? { encoded, format: params.format, size } : null,
                params
            };
        } catch (error) {
            return {
                success: false,
                reason: 'error',
                error: error,
                params
            };
        }
    }

    /**
     * Compresses an image to a blob with the specified parameters.
     * @param {ImageBitmap} img - The image to compress.
     * @param {Object} options - Compression options (format, quality, width, height).
     * @returns {Promise<{buffer: ArrayBuffer, size: number}>} The compressed image data.
     */
    async tryCompression(img, options) {
        const { format, quality = 0.85, width, height } = options;

        const canvas = document.createElement('canvas');
        canvas.width = width || img.width;
        canvas.height = height || img.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) throw new Error('Could not get 2D context for compression.');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (!blob) return reject(new Error(`Failed to encode image as ${format}`));
                    const reader = new FileReader();
                    reader.onload = () => resolve({ buffer: reader.result, size: blob.size });
                    reader.onerror = () => reject(new Error('Failed to read compressed blob.'));
                    reader.readAsArrayBuffer(blob);
                },
                format,
                quality
            );
        });
    }

    /**
     * Determines the optimal formats to try for compression based on image analysis.
     * @param {Object} analysisResults - The results from the ImageAnalyzer.
     * @returns {string[]} An array of format MIME types, sorted by preference.
     */
    determineOptimalFormats(analysisResults) {
        if (analysisResults?.recommendations?.formatRankings?.length > 0) {
            return analysisResults.recommendations.formatRankings.map(f => f.format);
        }

        // Fallback to a default order if analysis fails
        return ['image/webp', 'image/jpeg', 'image/png'];
    }

    /**
     * Cleans up resources used by the compression engine.
     */
    cleanup() {
        this.processingAborted = false;
        console.log('CompressionEngine cleaned up');
    }
};
