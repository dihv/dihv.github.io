// imageProcessor.js
window.ImageProcessor = class ImageProcessor {
    constructor() {
        // PTA_1: Use safe character set from config
        // PTA_5: Reference shared config
        this.encoder = new BitStreamEncoder(CONFIG.SAFE_CHARS);
        this.setupUI();
        this.bindEvents();
        
        // Track processing state
        this.originalSize = 0;
        this.processedSize = 0;
        this.originalFormat = '';
        this.processedFormat = '';
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

    showStatus(message, type = 'processing') {
        this.status.textContent = message;
        this.status.className = `status ${type}`;
        this.status.style.display = 'block';
    }

    async processFile(file) {
        if (!CONFIG.SUPPORTED_INPUT_FORMATS.includes(file.type)) {
            this.showStatus(`Unsupported format: ${file.type}. Supported formats: ${CONFIG.SUPPORTED_INPUT_FORMATS.join(', ')}`, 'error');
            return;
        }

        try {
            this.originalSize = file.size;
            this.originalFormat = file.type;
            this.showStatus('Processing image...', 'processing');

            // Create initial preview
            const previewUrl = URL.createObjectURL(file);
            this.preview.src = previewUrl;
            this.preview.style.display = 'block';

            // PTA_2: Use raw file as base2 for encoding/decoding
            const buffer = await file.arrayBuffer();
            const initialBits = this.encoder.toBitArray(buffer);
            const initialEncoded = this.encoder.encodeBits(initialBits);

            // Check if original file fits within URL limit (PC_3)
            if (initialEncoded.length <= CONFIG.MAX_URL_LENGTH) {
                // Original file fits within URL limit
                this.processedSize = file.size;
                this.processedFormat = file.type;
                await this.generateResult(initialEncoded);
                this.updateImageStats();
                this.showStatus(this.getProcessingStats(), 'success');
                return;
            }

            // Need to optimize the image
            this.showStatus('Image needs optimization. Analyzing best format...', 'processing');
            const optimalFormat = await this.detectOptimalFormat(file);
            
            // Try compression with optimal format
            this.showStatus('Compressing image...', 'processing');
            const { encoded: compressedData, format: finalFormat, size: finalSize } = 
                await this.compressImage(file, optimalFormat);

            this.processedFormat = finalFormat;
            this.processedSize = finalSize;
            
            await this.generateResult(compressedData);
            this.updateImageStats();
            this.showStatus(this.getProcessingStats(), 'success');

        } catch (error) {
            console.error('Processing error:', error);
            this.showStatus(`Error: ${error.message}`, 'error');
        }
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
        const originalSizeKB = (this.originalSize / 1024).toFixed(2);
        const processedSizeKB = (this.processedSize / 1024).toFixed(2);
        const compressionRatio = ((1 - (this.processedSize / this.originalSize)) * 100).toFixed(1);
        
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
        const finalUrl = `${baseUrl}${encodeURIComponent(encodedData)}`;
        
        // PC_3: Check max URL length
        if (finalUrl.length > CONFIG.MAX_URL_LENGTH) {
            throw new Error(`Generated URL exceeds maximum length (${CONFIG.MAX_URL_LENGTH} characters)`);
        }

        this.resultUrl.textContent = finalUrl;
        this.resultContainer.style.display = 'block';

        // Add URL to browser history for easy sharing
        window.history.pushState({}, '', finalUrl);
    }

    async compressImage(file, targetFormat) {
        const img = await createImageBitmap(file);
        let bestResult = null;
        
        // Try different compression strategies in order
        for (const strategy of CONFIG.COMPRESSION_STRATEGIES) {
            try {
                // PTA_4: Derive compression parameters from first principles
                const { buffer, size } = await this.tryCompression(img, {
                    ...strategy,
                    format: targetFormat || strategy.format
                });
                
                // PTA_2 & PTA_3: Convert to bit array preserving boundaries
                const bits = this.encoder.toBitArray(buffer);
                const encoded = this.encoder.encodeBits(bits);

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
            } catch (error) {
                console.warn(`Compression attempt failed:`, error);
                continue;
            }
        }

        if (!bestResult) {
            throw new Error('Image too large even after maximum compression');
        }

        return bestResult;
    }

    async tryCompression(img, strategy) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculate dimensions while maintaining aspect ratio
        let scale = 1;
        let width = img.width;
        let height = img.height;

        // PTA_6: Use unsigned operations for calculations
        const targetSize = new Uint32Array([CONFIG.MAX_URL_LENGTH])[0];
        
        // Estimate size and adjust scale if needed
        while ((width * height * 4 * strategy.quality) > targetSize) {
            scale *= 0.9;
            width = Math.floor(img.width * scale);
            height = Math.floor(img.height * scale);
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
                strategy.format,
                strategy.quality
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
