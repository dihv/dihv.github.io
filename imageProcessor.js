// imageProcessor.js
window.ImageProcessor = class ImageProcessor {
    constructor() {
        // PTA_1: Use safe character set from config
        // PTA_5: Reference shared config
        this.encoder = new GPUBitStreamEncoder(CONFIG.SAFE_CHARS);
        if (!this.checkWebGLSupport()) {
            throw new Error('WebGL2 support is required for image processing');
        }
        
        this.setupUI();
        this.bindEvents();
        
        // Track processing state
        this.originalSize = 0;
        this.processedSize = 0;
        this.originalFormat = '';
        this.processedFormat = '';

        this.maxSize = CONFIG.MAX_URL_LENGTH;
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

    async processFile(file) {
        if (this.encoder.gl.isContextLost()) {
            await this.reinitializeEncoder();
        }
        
        if (!CONFIG.SUPPORTED_INPUT_FORMATS.includes(file.type)) {
            this.showStatus(
                `Unsupported format: ${file.type}`,
                'error',
                `Supported formats: ${CONFIG.SUPPORTED_INPUT_FORMATS.join(', ')}`
            );
            return;
        }

        try {
            // Add GPU memory estimation
            const estimatedGPUMemory = file.size * 1.5; // 50% overhead for processing
            if (!this.checkGPUMemoryAvailable(estimatedGPUMemory)) {
                throw new Error(
                    'Insufficient GPU memory available. ' +
                    `Required: ${(requiredMemory / (1024 * 1024)).toFixed(2)}MB`
                );
            }
            
            this.originalSize = file.size;
            this.originalFormat = file.type;
            this.processedSize = file.size;  // Initialize to original size
            this.processedFormat = file.type; // Initialize to original format

            this.showStatus(
                'Processing image...',
                'processing',
                `Original size: ${(this.originalSize / 1024).toFixed(2)}KB`
            );

            // Create initial preview
            const previewUrl = URL.createObjectURL(file);
            this.preview.src = previewUrl;
            this.preview.style.display = 'block';

            // PTA_2: Use raw file as base2 for encoding/decoding
            console.log('Converting file to ArrayBuffer...');
            const buffer = await file.arrayBuffer();
            console.log('Creating bit array...');
            const initialBits = await this.encoder.toBitArray(buffer);
            console.log('Encoding with bit stream...');
            const initialEncoded = await this.encoder.encodeBits(initialBits);
            console.log('Initial encoded length:', initialEncoded.length);


            // Check if original file fits within URL limit (PC_3)
            if (initialEncoded.length <= CONFIG.MAX_URL_LENGTH) {
                // Original file fits within URL limit
                this.processedSize = file.originalSize;
                this.processedFormat = file.type;
                await this.generateResult(initialEncoded);
                this.updateImageStats();
                this.showStatus(this.getProcessingStats(), 'success');
                return;
            }

            // Need to optimize the image
           this.showStatus(
                'Image needs optimization',
                'processing',
                `Encoded size (${initialEncoded.length}) exceeds limit (${CONFIG.MAX_URL_LENGTH})`
            );
            const optimalFormat = await this.detectOptimalFormat(file);
            console.log('Optimal format detected:', optimalFormat);
            
            // Try compression with optimal format
            this.showStatus('Compressing image...', 'processing');
            
            const result = await this.compressImageHeuristic(file, optimalFormat);
            if (!result) {
                throw new Error(
                    'Unable to compress image sufficiently\n' +
                    `Original size: ${(this.originalSize / 1024).toFixed(2)}KB\n` +
                    `Target URL length: ${CONFIG.MAX_URL_LENGTH}`
                );
            }
            const { encoded: compressedData, format: finalFormat, size: finalSize } = result;


            this.processedFormat = finalFormat;
            this.processedSize = finalSize;
            
            await this.generateResult(compressedData);
            this.updateImageStats();
            this.showStatus(
                'Processing complete',
                'success',
                `Compressed size: ${(finalSize / 1024).toFixed(2)}KB`
            );


        } catch (error) {
            console.error('Processing error:', error);
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
        const gl = this.encoder.gl || document.createElement('canvas').getContext('webgl2');
        
        if (!gl) {
            console.warn('WebGL2 context not available for memory check');
            return false;
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
        const invalidChars = [...encodedData].filter(char => !CONFIG.SAFE_CHARS.includes(char));
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
        if (finalUrl.length > CONFIG.MAX_URL_LENGTH) {
            throw new Error(
                'Generated URL exceeds maximum length\n' +
                `URL length: ${finalUrl.length}\n` +
                `Maximum allowed: ${CONFIG.MAX_URL_LENGTH}`
            );
        }

        this.resultUrl.textContent = finalUrl;
        this.resultContainer.style.display = 'block';

        // Add URL to browser history for easy sharing
        window.history.pushState({}, '', finalUrl);
    }

    async compressImageHeuristic(file, targetFormat) {
        const img = await createImageBitmap(file);
        console.log('Original dimensions:', img.width, 'x', img.height);
        
        // Try initial compression with high quality
        const initialResult = await this.tryCompressionLevel(img, {
            format: targetFormat,
            quality: 0.95,
            scale: 1.0
        });
    
        // If high quality works, return immediately
        if (initialResult.success) {
            return initialResult.data;
        }
    
        // Binary search to find first working compression
        const result = await this.binarySearchCompression(img, targetFormat, initialResult.encodedLength);
        
        // If we found a working compression, try to optimize it
        if (result.success) {
            const optimized = await this.optimizeCompression(img, targetFormat, result.params);
            return optimized.data;
        }
    
        throw new Error('Unable to compress image sufficiently even with aggressive optimization');
    }

    async tryCompressionLevel(img, params) {
        try {
            const { buffer, size } = await this.tryCompression(img, {
                format: params.format,
                quality: params.quality,
                width: Math.round(img.width * params.scale),
                height: Math.round(img.height * params.scale)
            });
    
            const bits = this.encoder.toBitArray(buffer);
            const encoded = await this.encoder.encodeBits(bits);
            
            const success = encoded.length <= CONFIG.MAX_URL_LENGTH;
            
            if (success) {
                // Update preview if successful
                const blob = new Blob([buffer], { type: params.format });
                this.preview.src = URL.createObjectURL(blob);
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
            return {
                success: false,
                encodedLength: Infinity,
                data: null,
                params
            };
        }
    }

    async binarySearchCompression(img, format, initialLength) {
        const targetSize = CONFIG.MAX_URL_LENGTH * 0.95; // Leave some buffer
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
            while (improved) {
                improved = false;
                
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
                    const better = qualityResult.encodedLength < scaleResult.encodedLength ? 
                        qualityResult : scaleResult;
                        
                    if (better.success) {
                        bestResult = better;
                        workingParams = better.params;
                        improved = true;
                    }
                }
            }
        }
    }
    

    async compressImageBruteForce(file, targetFormat) {
        const img = await createImageBitmap(file);
        let bestResult = null;

        let width = img.width;
        let height = img.height;
        console.log('Original dimensions:', width, 'x', height);
        
        // Try different compression strategies in order
        for (const strategy of CONFIG.COMPRESSION_STRATEGIES) {
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
                    
                    const scaledWidth = Number(widthBig[0] * scale / BigInt(100));
                    const scaledHeight = Number(heightBig[0] * scale / BigInt(100));
                    
                    console.log(
                        `Trying compression:`,
                        `Format=${targetFormat}`,
                        `Quality=${strategy.quality}`,
                        `Scale=${Number(scale)}%`,
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
                    const encoded = this.encoder.encodeBits(bits);

                    console.log('Compressed size:', (size / 1024).toFixed(2), 'KB');
                    console.log('Encoded length:', encoded.length);

                    if (encoded.length <= CONFIG.MAX_URL_LENGTH) {
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

        // const targetSize = new BigUint64Array([CONFIG.MAX_URL_LENGTH])[0];
        
        // // Estimate size and adjust scale if needed
        // while ((width * height * 4 * strategy.quality) > targetSize) {
        //     scale *= 0.9;
        //     width = Math.floor(img.width * scale);
        //     height = Math.floor(img.height * scale);
        // }

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

    async detectOptimalFormat(file) {
        // Convert the image to different formats and compare sizes
        const img = await createImageBitmap(file);
        let bestFormat = null;
        let smallestSize = Infinity;

        // PTA_5: Use formats from config
        const formats = CONFIG.SUPPORTED_INPUT_FORMATS.filter(format => 
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
