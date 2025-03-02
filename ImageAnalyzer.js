/**
 * ImageAnalyzer.js
 * 
 * Advanced image analysis component for optimal codec selection
 * Detects image characteristics to determine the best compression approach
 */
window.ImageAnalyzer = class ImageAnalyzer {
    constructor() {
        // Initialize canvas for image analysis
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Reference for compression settings by image type
        this.compressionProfiles = {
            'photo': {
                // Photos: favor JPEG/WEBP, higher compression acceptable
                'image/jpeg': { quality: 0.85, priority: 2 },
                'image/webp': { quality: 0.85, priority: 1 },
                'image/avif': { quality: 0.85, priority: 3 },
                'image/png': { quality: 1.0, priority: 4 }
            },
            'graphic': {
                // Graphics: favor PNG/WEBP, lower compression to maintain sharp edges
                'image/png': { quality: 0.95, priority: 1 },
                'image/webp': { quality: 0.92, priority: 2 },
                'image/avif': { quality: 0.9, priority: 3 },
                'image/jpeg': { quality: 0.9, priority: 4 }
            },
            'text': {
                // Text: favor lossless formats to maintain readability
                'image/png': { quality: 1.0, priority: 1 },
                'image/webp': { quality: 1.0, priority: 2 }, // Lossless WEBP
                'image/avif': { quality: 0.95, priority: 3 },
                'image/jpeg': { quality: 0.95, priority: 4 }
            },
            'transparent': {
                // Images with transparency: exclude JPEG
                'image/png': { quality: 0.9, priority: 2 },
                'image/webp': { quality: 0.85, priority: 1 },
                'image/avif': { quality: 0.85, priority: 3 }
            },
            'low-color': {
                // Low-color images: favor formats with good palette support
                'image/png': { quality: 0.95, priority: 1 },
                'image/webp': { quality: 0.9, priority: 2 },
                'image/avif': { quality: 0.85, priority: 4 },
                'image/jpeg': { quality: 0.9, priority: 3 }
            }
        };
    }
    
    /**
     * Main analysis method that determines image characteristics
     * @param {File|Blob} imageFile - The image file to analyze
     * @returns {Promise<Object>} Analysis results
     */
    async analyzeImage(imageFile) {
        try {
            const startTime = performance.now();
            const bitmap = await createImageBitmap(imageFile);
            
            // Set canvas dimensions to match image
            this.canvas.width = bitmap.width;
            this.canvas.height = bitmap.height;
            
            // Draw image to canvas for pixel analysis
            this.ctx.drawImage(bitmap, 0, 0);
            
            // Get image data for analysis
            const imageData = this.ctx.getImageData(0, 0, bitmap.width, bitmap.height);
            
            // Run various analyses
            const hasTransparency = this.detectTransparency(imageData);
            const colorCount = this.countColors(imageData);
            const imageType = this.classifyImageType(imageData);
            const entropy = this.calculateEntropy(imageData);
            const edgeComplexity = this.detectEdgeComplexity(imageData);
            const colorDepth = this.estimateColorDepth(imageData);
            
            // Generate recommended format rankings
            const formatRankings = this.rankFormats({
                hasTransparency,
                colorCount,
                imageType,
                entropy,
                edgeComplexity,
                colorDepth,
                width: bitmap.width,
                height: bitmap.height
            });
            
            const endTime = performance.now();
            
            return {
                dimensions: {
                    width: bitmap.width,
                    height: bitmap.height,
                    aspectRatio: (bitmap.width / bitmap.height).toFixed(2)
                },
                analysis: {
                    hasTransparency,
                    colorCount,
                    imageType,
                    entropy: entropy.toFixed(2),
                    edgeComplexity: edgeComplexity.toFixed(2),
                    colorDepth,
                    bytes: imageData.data.length,
                    avgBytesPerPixel: (imageData.data.length / (bitmap.width * bitmap.height)).toFixed(2)
                },
                recommendations: {
                    formatRankings,
                    suggestedQuality: this.suggestQuality(imageType, entropy),
                    estimatedSavings: this.estimateCompressionSavings(imageType, entropy, imageData.data.length)
                },
                performance: {
                    analysisTime: (endTime - startTime).toFixed(2) + "ms"
                }
            };
        } catch (error) {
            console.error('Image analysis failed:', error);
            return {
                error: error.message,
                fallbackRecommendation: ['image/webp', 'image/jpeg', 'image/png']
            };
        }
    }
    
    /**
     * Detects if the image has transparent pixels
     * @param {ImageData} imageData
     * @returns {boolean}
     */
    detectTransparency(imageData) {
        const pixels = imageData.data;
        
        // Alpha is stored every 4th byte (RGBA)
        for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] < 255) {
                return true; // Found a transparent pixel
            }
        }
        
        return false;
    }
    
    /**
     * Estimates the number of unique colors in the image
     * Uses sampling for large images to improve performance
     * @param {ImageData} imageData
     * @returns {number} Estimated number of unique colors
     */
    countColors(imageData) {
        const pixels = imageData.data;
        const totalPixels = pixels.length / 4;
        
        // For large images, use sampling to estimate
        const sampleRate = totalPixels > 250000 ? 10 : 1; // Sample every 10th pixel for large images
        const colorSet = new Set();
        
        for (let i = 0; i < pixels.length; i += 4 * sampleRate) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            // Create a color signature (ignore alpha for color counting)
            colorSet.add(`${r},${g},${b}`);
        }
        
        return colorSet.size;
    }
    
    /**
     * Classifies the image as photo, graphic, or text based on characteristics
     * @param {ImageData} imageData
     * @returns {string} Classification (photo, graphic, text, low-color)
     */
    classifyImageType(imageData) {
        const pixels = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // Calculate various metrics
        const colorCount = this.countColors(imageData);
        const edgeComplexity = this.detectEdgeComplexity(imageData);
        const colorTransitions = this.calculateColorTransitions(imageData);
        const hasTransparency = this.detectTransparency(imageData);
        
        // Calculate color diversity ratio (unique colors / total pixels)
        const totalPixels = width * height;
        const colorDiversity = colorCount / totalPixels;
        
        // Determine image type based on metrics
        if (colorCount < 64) {
            return 'low-color'; // Icons, logos, simple graphics
        } else if (edgeComplexity > 0.7 && colorTransitions < 0.4) {
            return 'text'; // High edges but low color transitions indicates text
        } else if (colorDiversity > 0.5 || edgeComplexity < 0.2) {
            return 'photo'; // High color diversity or low edge complexity indicates photo
        } else {
            return 'graphic'; // Charts, diagrams, illustrations
        }
    }
    
    /**
     * Calculates image entropy (measure of randomness/complexity)
     * @param {ImageData} imageData
     * @returns {number} Entropy value
     */
    calculateEntropy(imageData) {
        const pixels = imageData.data;
        const totalPixels = pixels.length / 4;
        
        // Calculate luminance histogram
        const histogram = new Array(256).fill(0);
        
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            
            // Convert RGB to luminance
            const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            histogram[luminance]++;
        }
        
        // Calculate entropy
        let entropy = 0;
        for (let i = 0; i < histogram.length; i++) {
            if (histogram[i] > 0) {
                const probability = histogram[i] / totalPixels;
                entropy -= probability * Math.log2(probability);
            }
        }
        
        return entropy;
    }
    
    /**
     * Measure edge complexity (useful for distinguishing photos from text/graphics)
     * @param {ImageData} imageData
     * @returns {number} Edge complexity score (0-1)
     */
    detectEdgeComplexity(imageData) {
        const pixels = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        let edgeCount = 0;
        const totalPixels = (width - 1) * (height - 1); // Edges can't be calculated for border pixels
        
        // Sample the image for edge detection
        const sampleRate = Math.max(1, Math.floor(width * height / 100000));
        
        // Simple edge detection by comparing adjacent pixels
        for (let y = 0; y < height - 1; y += sampleRate) {
            for (let x = 0; x < width - 1; x += sampleRate) {
                const pos = (y * width + x) * 4;
                const rightPos = pos + 4;
                const bottomPos = ((y + 1) * width + x) * 4;
                
                // Get luminance of current pixel and neighbors
                const curLum = 0.299 * pixels[pos] + 0.587 * pixels[pos + 1] + 0.114 * pixels[pos + 2];
                const rightLum = 0.299 * pixels[rightPos] + 0.587 * pixels[rightPos + 1] + 0.114 * pixels[rightPos + 2];
                const bottomLum = 0.299 * pixels[bottomPos] + 0.587 * pixels[bottomPos + 1] + 0.114 * pixels[bottomPos + 2];
                
                // Check if edges exists (significant luminance difference)
                if (Math.abs(curLum - rightLum) > 20 || Math.abs(curLum - bottomLum) > 20) {
                    edgeCount++;
                }
            }
        }
        
        // Normalize edge count to get complexity score
        return edgeCount / (totalPixels / sampleRate / sampleRate);
    }
    
    /**
     * Calculate color transitions to help identify photos vs graphics
     * @param {ImageData} imageData
     * @returns {number} Color transition ratio
     */
    calculateColorTransitions(imageData) {
        const pixels = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        let transitions = 0;
        let totalComparisons = 0;
        
        // Sample the image to improve performance
        const sampleRate = Math.max(1, Math.floor(width * height / 100000));
        
        for (let y = 0; y < height - sampleRate; y += sampleRate) {
            for (let x = 0; x < width - sampleRate; x += sampleRate) {
                const pos = (y * width + x) * 4;
                const nextPos = ((y + sampleRate) * width + x + sampleRate) * 4;
                
                const rDiff = Math.abs(pixels[pos] - pixels[nextPos]);
                const gDiff = Math.abs(pixels[pos + 1] - pixels[nextPos + 1]);
                const bDiff = Math.abs(pixels[pos + 2] - pixels[nextPos + 2]);
                
                // Calculate color distance
                const distance = Math.sqrt(rDiff*rDiff + gDiff*gDiff + bDiff*bDiff);
                
                // Count significant transitions
                if (distance > 30) {
                    transitions++;
                }
                
                totalComparisons++;
            }
        }
        
        return transitions / totalComparisons;
    }
    
    /**
     * Estimate effective color depth of the image
     * @param {ImageData} imageData
     * @returns {number} Estimated bits per channel
     */
    estimateColorDepth(imageData) {
        const pixels = imageData.data;
        const uniqueValues = new Set();
        
        // Sample the image to check color distribution
        const sampleRate = Math.max(1, Math.floor(pixels.length / 40000));
        
        for (let i = 0; i < pixels.length; i += 4 * sampleRate) {
            uniqueValues.add(pixels[i]);     // R
            uniqueValues.add(pixels[i + 1]); // G
            uniqueValues.add(pixels[i + 2]); // B
        }
        
        // Estimate bits per channel based on unique values
        const uniqueCount = uniqueValues.size;
        
        if (uniqueCount <= 2) return 1;      // 1-bit
        if (uniqueCount <= 16) return 4;     // 4-bit
        if (uniqueCount <= 64) return 6;     // 6-bit
        if (uniqueCount <= 128) return 7;    // 7-bit
        if (uniqueCount <= 256) return 8;    // 8-bit
        
        return 8; // Default to 8-bit
    }
    
    /**
     * Ranks formats based on image characteristics
     * @param {Object} analysisResults
     * @returns {Array} Ranked formats with quality settings
     */
    rankFormats(analysisResults) {
        let profileName = analysisResults.imageType;
        
        // Special case for transparency
        if (analysisResults.hasTransparency) {
            profileName = 'transparent';
        }
        
        // Get the profile based on image type
        const profile = this.compressionProfiles[profileName] || this.compressionProfiles['photo'];
        
        // Create a sorted list of formats by priority
        const sortedFormats = Object.entries(profile)
            .filter(([format]) => window.CONFIG.SUPPORTED_INPUT_FORMATS.includes(format))
            .sort((a, b) => a[1].priority - b[1].priority)
            .map(([format, settings]) => {
                // Adjust quality based on entropy
                let adjustedQuality = settings.quality;
                
                // Higher entropy (more complex images) can use lower quality settings
                if (analysisResults.entropy > 7) {
                    adjustedQuality *= 0.9;
                } 
                // Low entropy images need higher quality
                else if (analysisResults.entropy < 4) {
                    adjustedQuality = Math.min(1.0, adjustedQuality * 1.1);
                }
                
                // Ensure quality is in valid range
                adjustedQuality = Math.max(0.7, Math.min(1.0, adjustedQuality));
                
                return {
                    format,
                    quality: adjustedQuality,
                    priority: settings.priority
                };
            });
        
        return sortedFormats;
    }
    
    /**
     * Suggests a quality setting based on image type and complexity
     * @param {string} imageType
     * @param {number} entropy
     * @returns {number} Suggested quality value (0-1)
     */
    suggestQuality(imageType, entropy) {
        // Base quality by image type
        let baseQuality = 0.85;
        
        switch (imageType) {
            case 'text':
                baseQuality = 0.92;
                break;
            case 'graphic':
                baseQuality = 0.88;
                break;
            case 'photo':
                baseQuality = 0.82;
                break;
            case 'low-color':
                baseQuality = 0.90;
                break;
        }
        
        // Adjust based on entropy
        const entropyFactor = Math.max(0, Math.min(1, (entropy - 2) / 6));
        const qualityAdjustment = (1 - entropyFactor) * 0.15;
        
        return Math.min(0.98, Math.max(0.7, baseQuality + qualityAdjustment));
    }
    
    /**
     * Estimates potential compression savings
     * @param {string} imageType
     * @param {number} entropy
     * @param {number} originalSizeBytes
     * @returns {Object} Estimated savings range
     */
    estimateCompressionSavings(imageType, entropy, originalSizeBytes) {
        // Estimate compression potential by image type and entropy
        let minSaving = 0.1; // 10%
        let maxSaving = 0.4; // 40%
        
        // Photos compress better than text/graphics
        switch (imageType) {
            case 'photo':
                minSaving = 0.4;
                maxSaving = 0.75;
                break;
            case 'graphic':
                minSaving = 0.3;
                maxSaving = 0.6;
                break;
            case 'text':
                minSaving = 0.2;
                maxSaving = 0.5;
                break;
            case 'low-color':
                minSaving = 0.6;
                maxSaving = 0.85;
                break;
        }
        
        // Higher entropy = better compression
        const entropyFactor = Math.min(1, entropy / 8);
        const savingRange = maxSaving - minSaving;
        const estimatedSaving = minSaving + (savingRange * entropyFactor);
        
        // Calculate byte estimates
        const minSavedBytes = Math.floor(originalSizeBytes * minSaving);
        const maxSavedBytes = Math.floor(originalSizeBytes * maxSaving);
        const likelySavedBytes = Math.floor(originalSizeBytes * estimatedSaving);
        
        return {
            minPercent: Math.floor(minSaving * 100),
            maxPercent: Math.floor(maxSaving * 100),
            likelyPercent: Math.floor(estimatedSaving * 100),
            minSavedBytes,
            maxSavedBytes,
            likelySavedBytes,
            originalBytes: originalSizeBytes
        };
    }
};
