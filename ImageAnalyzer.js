/**
 * ImageAnalyzer.js
 * 
 * Advanced image analysis component for optimal codec selection
 * Detects image characteristics to determine the best compression approach
 */
window.ImageAnalyzer = class ImageAnalyzer {
     constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Enhanced compression profiles optimized for URL encoding
        this.compressionProfiles = {
            'photo-simple': {
                'image/webp': { quality: 0.82, priority: 1, urlEfficiency: 0.95 },
                'image/avif': { quality: 0.80, priority: 2, urlEfficiency: 0.98 },
                'image/jpeg': { quality: 0.85, priority: 3, urlEfficiency: 0.85 },
                'image/png': { quality: 1.0, priority: 4, urlEfficiency: 0.65 }
            },
            'photo-complex': {
                'image/avif': { quality: 0.75, priority: 1, urlEfficiency: 0.98 },
                'image/webp': { quality: 0.78, priority: 2, urlEfficiency: 0.95 },
                'image/jpeg': { quality: 0.82, priority: 3, urlEfficiency: 0.85 },
                'image/png': { quality: 1.0, priority: 4, urlEfficiency: 0.65 }
            },
            'graphic-sharp': {
                'image/png': { quality: 0.95, priority: 1, urlEfficiency: 0.8 },
                'image/webp': { quality: 0.90, priority: 2, urlEfficiency: 0.95 },
                'image/avif': { quality: 0.88, priority: 3, urlEfficiency: 0.98 },
                'image/jpeg': { quality: 0.92, priority: 4, urlEfficiency: 0.85 }
            },
            'graphic-smooth': {
                'image/webp': { quality: 0.88, priority: 1, urlEfficiency: 0.95 },
                'image/avif': { quality: 0.85, priority: 2, urlEfficiency: 0.98 },
                'image/png': { quality: 0.90, priority: 3, urlEfficiency: 0.8 },
                'image/jpeg': { quality: 0.90, priority: 4, urlEfficiency: 0.85 }
            },
            'text-document': {
                'image/png': { quality: 1.0, priority: 1, urlEfficiency: 0.8 },
                'image/webp': { quality: 1.0, priority: 2, urlEfficiency: 0.95 },
                'image/avif': { quality: 0.95, priority: 3, urlEfficiency: 0.98 }
            },
            'transparent-simple': {
                'image/png': { quality: 0.90, priority: 2, urlEfficiency: 0.8 },
                'image/webp': { quality: 0.85, priority: 1, urlEfficiency: 0.95 },
                'image/avif': { quality: 0.85, priority: 3, urlEfficiency: 0.98 }
            },
            'transparent-complex': {
                'image/webp': { quality: 0.80, priority: 1, urlEfficiency: 0.95 },
                'image/avif': { quality: 0.78, priority: 2, urlEfficiency: 0.98 },
                'image/png': { quality: 0.85, priority: 3, urlEfficiency: 0.8 }
            },
            'icon-small': {
                'image/png': { quality: 0.95, priority: 1, urlEfficiency: 0.9 },
                'image/webp': { quality: 0.90, priority: 2, urlEfficiency: 0.95 },
                'image/avif': { quality: 0.88, priority: 3, urlEfficiency: 0.98 }
            }
        };
        
        // URL encoding efficiency factors
        this.urlEncodingFactors = {
            compressionToUrlRatio: 1.35, // Average ratio of compression to URL encoding efficiency
            formatOverheadBytes: {
                'image/jpeg': 2,
                'image/png': 8,
                'image/webp': 4,
                'image/avif': 6
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
            
            this.canvas.width = bitmap.width;
            this.canvas.height = bitmap.height;
            this.ctx.drawImage(bitmap, 0, 0);
            
            const imageData = this.ctx.getImageData(0, 0, bitmap.width, bitmap.height);
            
            // Core analysis
            const coreAnalysis = await this.performCoreAnalysis(imageData);
            
            // Enhanced classification
            const classification = this.enhancedClassification(coreAnalysis, imageData);
            
            // URL-optimized format rankings
            const formatRankings = this.generateUrlOptimizedRankings(classification, coreAnalysis);
            
            // Compression strategy recommendations
            const strategy = this.recommendCompressionStrategy(classification, coreAnalysis, imageFile.size);
            
            const endTime = performance.now();
            
            return {
                dimensions: {
                    width: bitmap.width,
                    height: bitmap.height,
                    aspectRatio: (bitmap.width / bitmap.height).toFixed(2),
                    pixelCount: bitmap.width * bitmap.height
                },
                analysis: {
                    ...coreAnalysis,
                    classification: classification,
                    complexity: this.calculateComplexityScore(coreAnalysis),
                    urlSuitability: this.calculateUrlSuitability(coreAnalysis, imageFile.size)
                },
                recommendations: {
                    formatRankings: formatRankings,
                    compressionStrategy: strategy,
                    estimatedUrlLength: this.estimateUrlLength(imageFile.size, classification),
                    suggestedQuality: this.suggestOptimalQuality(classification, coreAnalysis),
                    estimatedSavings: this.estimateCompressionSavings(classification, coreAnalysis, imageFile.size)
                },
                performance: {
                    analysisTime: (endTime - startTime).toFixed(2) + "ms"
                }
            };
        } catch (error) {
            console.error('Enhanced image analysis failed:', error);
            return this.getFallbackAnalysis(imageFile);
        }
    }
    
    async performCoreAnalysis(imageData) {
        const pixels = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // Use sampling for large images to improve performance
        const sampleRate = (width * height > 250000) ? 4 : 1;
        
        // Parallel analysis for better performance
        const [
            transparency,
            colorMetrics,
            textureMetrics,
            edgeMetrics
        ] = await Promise.all([
            this.analyzeTransparency(pixels, sampleRate),
            this.analyzeColorMetrics(pixels, sampleRate),
            this.analyzeTextureMetrics(imageData, sampleRate),
            this.analyzeEdgeMetrics(imageData, sampleRate)
        ]);
        
        return {
            hasTransparency: transparency.hasTransparency,
            transparencyComplexity: transparency.complexity,
            colorCount: colorMetrics.uniqueColors,
            colorDistribution: colorMetrics.distribution,
            colorDepth: colorMetrics.effectiveDepth,
            entropy: textureMetrics.entropy,
            smoothness: textureMetrics.smoothness,
            patterns: textureMetrics.patterns,
            edgeComplexity: edgeMetrics.complexity,
            edgeDensity: edgeMetrics.density,
            noiseLevel: this.calculateNoiseLevel(pixels, sampleRate)
        };
    }
    
    /**
     * Enhanced transparency analysis
     */
    analyzeTransparency(pixels, sampleRate) {
        let transparentPixels = 0;
        let semiTransparentPixels = 0;
        let totalSampled = 0;
        const alphaValues = new Set();
        
        for (let i = 3; i < pixels.length; i += 4 * sampleRate) {
            const alpha = pixels[i];
            alphaValues.add(alpha);
            
            if (alpha < 255) {
                if (alpha === 0) {
                    transparentPixels++;
                } else {
                    semiTransparentPixels++;
                }
            }
            totalSampled++;
        }
        
        const hasTransparency = transparentPixels > 0 || semiTransparentPixels > 0;
        const transparencyRatio = (transparentPixels + semiTransparentPixels) / totalSampled;
        
        return {
            hasTransparency,
            complexity: this.calculateTransparencyComplexity(alphaValues, transparencyRatio)
        };
    }
    
    /**
     * Calculate transparency complexity for format optimization
     */
    calculateTransparencyComplexity(alphaValues, transparencyRatio) {
        if (alphaValues.size <= 2) return 'binary'; // Simple on/off transparency
        if (alphaValues.size <= 16 && transparencyRatio < 0.1) return 'simple';
        if (transparencyRatio < 0.3) return 'moderate';
        return 'complex';
    }
    
    /**
     * Enhanced color analysis
     */
    analyzeColorMetrics(pixels, sampleRate) {
        const colorMap = new Map();
        const rgbSums = { r: 0, g: 0, b: 0 };
        let totalSampled = 0;
        
        for (let i = 0; i < pixels.length; i += 4 * sampleRate) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            
            // Create color signature
            const colorKey = `${r},${g},${b}`;
            colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
            
            rgbSums.r += r;
            rgbSums.g += g;
            rgbSums.b += b;
            totalSampled++;
        }
        
        // Calculate distribution metrics
        const colors = Array.from(colorMap.values());
        const maxCount = Math.max(...colors);
        const distribution = this.calculateColorDistribution(colors);
        
        return {
            uniqueColors: colorMap.size,
            distribution: distribution,
            effectiveDepth: this.estimateEffectiveColorDepth(colorMap),
            dominantColorRatio: maxCount / totalSampled,
            averageColor: {
                r: Math.round(rgbSums.r / totalSampled),
                g: Math.round(rgbSums.g / totalSampled),
                b: Math.round(rgbSums.b / totalSampled)
            }
        };
    }
    
    /**
     * Calculate color distribution characteristics
     */
    calculateColorDistribution(colorCounts) {
        const total = colorCounts.reduce((sum, count) => sum + count, 0);
        const probabilities = colorCounts.map(count => count / total);
        
        // Calculate entropy of color distribution
        const entropy = -probabilities.reduce((sum, p) => {
            return p > 0 ? sum + p * Math.log2(p) : sum;
        }, 0);
        
        // Calculate distribution uniformity
        const maxEntropy = Math.log2(colorCounts.length);
        const uniformity = maxEntropy > 0 ? entropy / maxEntropy : 0;
        
        return {
            entropy: entropy,
            uniformity: uniformity,
            type: uniformity > 0.8 ? 'uniform' : uniformity > 0.4 ? 'varied' : 'concentrated'
        };
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

    analyzeTextureMetrics(imageData, sampleRate) {
        const luminanceData = this.calculateLuminance(imageData.data, sampleRate);
        
        return {
            entropy: this.calculateLuminanceEntropy(luminanceData),
            smoothness: this.calculateSmoothness(luminanceData, imageData.width),
            patterns: this.detectPatterns(luminanceData, imageData.width)
        };
    }
    
    /**
     * Calculate luminance entropy for texture analysis
     */
    calculateLuminanceEntropy(luminanceData) {
        const histogram = new Array(256).fill(0);
        
        luminanceData.forEach(lum => {
            histogram[Math.round(lum)]++;
        });
        
        const total = luminanceData.length;
        let entropy = 0;
        
        for (let i = 0; i < histogram.length; i++) {
            if (histogram[i] > 0) {
                const probability = histogram[i] / total;
                entropy -= probability * Math.log2(probability);
            }
        }
        
        return entropy;
    }
    
    /**
     * Enhanced image classification
     */
    enhancedClassification(analysis, imageData) {
        const { colorCount, edgeComplexity, entropy, hasTransparency, smoothness } = analysis;
        const pixelCount = imageData.width * imageData.height;
        const colorDensity = colorCount / pixelCount;
        
        // Multi-factor classification
        if (hasTransparency) {
            if (colorCount < 32 && pixelCount < 10000) {
                return 'icon-small';
            } else if (edgeComplexity > 0.7 || smoothness < 0.3) {
                return 'transparent-complex';
            } else {
                return 'transparent-simple';
            }
        }
        
        if (colorCount < 64 && pixelCount < 40000) {
            return 'icon-small';
        }
        
        if (edgeComplexity > 0.8 && smoothness < 0.2) {
            return 'text-document';
        }
        
        if (edgeComplexity > 0.5 && colorDensity < 0.1) {
            return smoothness > 0.6 ? 'graphic-smooth' : 'graphic-sharp';
        }
        
        if (entropy > 6.5 && colorDensity > 0.3) {
            return 'photo-complex';
        }
        
        return 'photo-simple';
    }
    
    /**
     * Generate URL-optimized format rankings
     */
    generateUrlOptimizedRankings(classification, analysis) {
        const profile = this.compressionProfiles[classification] || this.compressionProfiles['photo-simple'];
        
        // Filter by supported formats
        const supportedFormats = window.CONFIG?.SUPPORTED_INPUT_FORMATS || [
            'image/jpeg', 'image/png', 'image/webp', 'image/avif'
        ];
        
        const rankings = Object.entries(profile)
            .filter(([format]) => supportedFormats.includes(format))
            .map(([format, settings]) => {
                // Adjust quality based on analysis
                let adjustedQuality = settings.quality;
                
                // Adjust for complexity
                if (analysis.entropy > 7) {
                    adjustedQuality *= 0.92; // Reduce quality for high entropy
                } else if (analysis.entropy < 4) {
                    adjustedQuality = Math.min(1.0, adjustedQuality * 1.05); // Increase quality for low entropy
                }
                
                // Adjust for edge complexity
                if (analysis.edgeComplexity > 0.7) {
                    adjustedQuality = Math.min(1.0, adjustedQuality * 1.03); // Preserve edges
                }
                
                // Calculate URL efficiency score
                const urlEfficiencyScore = this.calculateUrlEfficiencyScore(
                    format, 
                    adjustedQuality, 
                    analysis
                );
                
                return {
                    format,
                    quality: Math.max(0.1, Math.min(1.0, adjustedQuality)),
                    priority: settings.priority,
                    urlEfficiency: urlEfficiencyScore,
                    estimatedCompression: this.estimateFormatCompression(format, adjustedQuality, analysis)
                };
            })
            .sort((a, b) => {
                // Sort by URL efficiency first, then priority
                if (Math.abs(a.urlEfficiency - b.urlEfficiency) > 0.05) {
                    return b.urlEfficiency - a.urlEfficiency;
                }
                return a.priority - b.priority;
            });
        
        return rankings;
    }
    
    /**
     * Calculate URL efficiency score for format/quality combination
     */
    calculateUrlEfficiencyScore(format, quality, analysis) {
        const baseEfficiency = this.compressionProfiles['photo-simple'][format]?.urlEfficiency || 0.8;
        
        // Adjust based on image characteristics
        let efficiency = baseEfficiency;
        
        // Transparency penalty for JPEG
        if (format === 'image/jpeg' && analysis.hasTransparency) {
            return 0; // JPEG cannot handle transparency
        }
        
        // Quality impact
        efficiency *= (0.7 + 0.3 * quality); // Lower quality = lower efficiency
        
        // Complexity adjustments
        if (analysis.edgeComplexity > 0.7) {
            // High edge complexity favors lossless or high-quality lossy
            if (format === 'image/png') efficiency *= 1.1;
            else if (quality < 0.8) efficiency *= 0.9;
        }
        
        if (analysis.entropy > 7) {
            // High entropy favors efficient lossy compression
            if (format === 'image/avif' || format === 'image/webp') efficiency *= 1.05;
        }
        
        return Math.min(1.0, efficiency);
    }
    
    /**
     * Recommend compression strategy
     */
    recommendCompressionStrategy(classification, analysis, originalSize) {
        const strategy = {
            approach: 'progressive',
            initialQuality: 0.85,
            scaleStrategy: 'adaptive',
            priorityFormats: [],
            estimatedIterations: 5
        };
        
        // Adjust strategy based on classification
        switch (classification) {
            case 'photo-complex':
                strategy.approach = 'aggressive';
                strategy.initialQuality = 0.75;
                strategy.estimatedIterations = 8;
                break;
                
            case 'text-document':
            case 'graphic-sharp':
                strategy.approach = 'conservative';
                strategy.initialQuality = 0.92;
                strategy.scaleStrategy = 'preserve-detail';
                break;
                
            case 'icon-small':
                strategy.approach = 'minimal';
                strategy.initialQuality = 0.95;
                strategy.scaleStrategy = 'maintain-sharpness';
                strategy.estimatedIterations = 3;
                break;
        }
        
        // Adjust for original size
        if (originalSize > 500 * 1024) { // Large files need aggressive compression
            strategy.approach = 'aggressive';
            strategy.initialQuality *= 0.9;
            strategy.estimatedIterations += 3;
        }
        
        return strategy;
    }
    
    /**
     * Estimate URL length after compression and encoding
     */
    estimateUrlLength(originalSize, classification) {
        const compressionRatios = {
            'photo-simple': 0.15,
            'photo-complex': 0.25,
            'graphic-sharp': 0.4,
            'graphic-smooth': 0.3,
            'text-document': 0.6,
            'transparent-simple': 0.5,
            'transparent-complex': 0.7,
            'icon-small': 0.8
        };
        
        const ratio = compressionRatios[classification] || 0.3;
        const compressedSize = originalSize * ratio;
        
        // Apply URL encoding efficiency (from config)
        const encodingEfficiency = window.CONFIG?.ENCODING_EFFICIENCY?.CURRENT || 6.0;
        const urlChars = Math.ceil((compressedSize * 8) / encodingEfficiency);
        
        // Add metadata overhead
        const metadataOverhead = 20;
        
        return {
            estimated: urlChars + metadataOverhead,
            compressedSize: Math.round(compressedSize),
            compressionRatio: ratio
        };
    }
    
    /**
     * Calculate complexity score for processing optimization
     */
    calculateComplexityScore(analysis) {
        let score = 0;
        
        // Color complexity (0-30 points)
        score += Math.min(30, (analysis.colorCount / 1000) * 30);
        
        // Edge complexity (0-25 points)
        score += analysis.edgeComplexity * 25;
        
        // Entropy (0-25 points)
        score += (analysis.entropy / 8) * 25;
        
        // Transparency complexity (0-20 points)
        if (analysis.hasTransparency) {
            const transparencyScore = {
                'binary': 5,
                'simple': 10,
                'moderate': 15,
                'complex': 20
            };
            score += transparencyScore[analysis.transparencyComplexity] || 10;
        }
        
        return Math.round(score);
    }
    
    /**
     * Calculate URL suitability score
     */
    calculateUrlSuitability(analysis, originalSize) {
        let score = 100;
        
        // Size penalty
        if (originalSize > 100 * 1024) score -= 20;
        if (originalSize > 500 * 1024) score -= 30;
        
        // Complexity penalty
        if (analysis.edgeComplexity > 0.8) score -= 15;
        if (analysis.colorCount > 10000) score -= 10;
        if (analysis.entropy > 7.5) score -= 10;
        
        // Transparency penalty
        if (analysis.hasTransparency && analysis.transparencyComplexity === 'complex') {
            score -= 15;
        }
        
        return Math.max(0, Math.min(100, score));
    }
    
    // Helper methods
    calculateLuminance(pixels, sampleRate) {
        const luminance = [];
        for (let i = 0; i < pixels.length; i += 4 * sampleRate) {
            const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
            luminance.push(lum);
        }
        return luminance;
    }
    
    calculateSmoothness(luminanceData, width) {
        let totalVariation = 0;
        let comparisons = 0;
        
        for (let i = 0; i < luminanceData.length - 1; i++) {
            const diff = Math.abs(luminanceData[i] - luminanceData[i + 1]);
            totalVariation += diff;
            comparisons++;
        }
        
        const avgVariation = totalVariation / comparisons;
        return Math.max(0, 1 - (avgVariation / 255));
    }
    
    analyzeEdgeMetrics(imageData, sampleRate) {
        // Simplified Sobel edge detection
        const { data, width, height } = imageData;
        let edgeCount = 0;
        let totalPixels = 0;
        
        for (let y = 1; y < height - 1; y += sampleRate) {
            for (let x = 1; x < width - 1; x += sampleRate) {
                const idx = (y * width + x) * 4;
                
                // Get luminance of surrounding pixels
                const center = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                const right = 0.299 * data[idx + 4] + 0.587 * data[idx + 5] + 0.114 * data[idx + 6];
                const bottom = 0.299 * data[idx + width * 4] + 0.587 * data[idx + width * 4 + 1] + 0.114 * data[idx + width * 4 + 2];
                
                // Simple edge detection
                const gradientX = Math.abs(center - right);
                const gradientY = Math.abs(center - bottom);
                const gradient = Math.sqrt(gradientX * gradientX + gradientY * gradientY);
                
                if (gradient > 30) edgeCount++;
                totalPixels++;
            }
        }
        
        const density = edgeCount / totalPixels;
        return {
            complexity: Math.min(1, density * 5), // Normalize to 0-1
            density: density
        };
    }
    
    calculateNoiseLevel(pixels, sampleRate) {
        // Simple noise estimation using local variance
        let totalVariance = 0;
        let windowCount = 0;
        
        for (let i = 0; i < pixels.length - 12; i += 12 * sampleRate) {
            // 3x3 window variance
            const window = [
                pixels[i], pixels[i + 4], pixels[i + 8],
                pixels[i + 1], pixels[i + 5], pixels[i + 9],
                pixels[i + 2], pixels[i + 6], pixels[i + 10]
            ];
            
            const mean = window.reduce((sum, val) => sum + val, 0) / window.length;
            const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
            
            totalVariance += variance;
            windowCount++;
        }
        
        return windowCount > 0 ? totalVariance / windowCount : 0;
    }
    
    detectPatterns(luminanceData, width) {
        // Simple pattern detection - look for repetitive structures
        const patterns = { repetitive: false, frequency: 0 };
        
        // Check for horizontal patterns
        let repetitions = 0;
        const checkLength = Math.min(50, width);
        
        for (let i = 0; i < luminanceData.length - checkLength * 2; i += width) {
            let matches = 0;
            for (let j = 0; j < checkLength; j++) {
                if (Math.abs(luminanceData[i + j] - luminanceData[i + j + checkLength]) < 10) {
                    matches++;
                }
            }
            
            if (matches / checkLength > 0.8) repetitions++;
        }
        
        patterns.repetitive = repetitions > 3;
        patterns.frequency = repetitions;
        
        return patterns;
    }
    
    estimateEffectiveColorDepth(colorMap) {
        const uniqueColors = colorMap.size;
        
        if (uniqueColors <= 2) return 1;
        if (uniqueColors <= 16) return 4;
        if (uniqueColors <= 256) return 8;
        if (uniqueColors <= 4096) return 12;
        return 24;
    }
    
    estimateFormatCompression(format, quality, analysis) {
        // Rough estimates based on format characteristics
        const baseRatios = {
            'image/jpeg': 0.1 + (1 - quality) * 0.4,
            'image/webp': 0.08 + (1 - quality) * 0.35,
            'image/avif': 0.06 + (1 - quality) * 0.3,
            'image/png': analysis.colorCount < 256 ? 0.4 : 0.8
        };
        
        return baseRatios[format] || 0.5;
    }
    
    suggestOptimalQuality(classification, analysis) {
        const baseQualities = {
            'photo-simple': 0.85,
            'photo-complex': 0.78,
            'graphic-sharp': 0.92,
            'graphic-smooth': 0.88,
            'text-document': 0.95,
            'transparent-simple': 0.88,
            'transparent-complex': 0.82,
            'icon-small': 0.95
        };
        
        let quality = baseQualities[classification] || 0.85;
        
        // Adjust for complexity
        if (analysis.entropy > 7) quality *= 0.95;
        if (analysis.edgeComplexity > 0.8) quality *= 1.05;
        
        return Math.max(0.1, Math.min(1.0, quality));
    }
    
    estimateCompressionSavings(classification, analysis, originalSize) {
        const estimates = this.estimateUrlLength(originalSize, classification);
        
        return {
            originalBytes: originalSize,
            estimatedCompressedBytes: estimates.compressedSize,
            estimatedUrlChars: estimates.estimated,
            compressionRatio: estimates.compressionRatio,
            spaceSavings: `${((1 - estimates.compressionRatio) * 100).toFixed(1)}%`,
            urlEfficiency: estimates.estimated < (window.CONFIG?.MAX_URL_LENGTH || 2000) ? 'good' : 'challenging'
        };
    }
    
    getFallbackAnalysis(imageFile) {
        return {
            dimensions: { width: 0, height: 0, aspectRatio: '1.0' },
            analysis: { 
                hasTransparency: false, 
                classification: 'photo-simple',
                complexity: 50,
                urlSuitability: 70
            },
            recommendations: {
                formatRankings: [
                    { format: 'image/webp', quality: 0.85, priority: 1 },
                    { format: 'image/jpeg', quality: 0.85, priority: 2 }
                ],
                compressionStrategy: { approach: 'progressive', initialQuality: 0.85 }
            },
            error: 'Analysis failed, using fallback recommendations'
        };
    }
    
};
