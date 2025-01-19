// imageProcessor.js
window.ImageProcessor = class ImageProcessor {
    constructor() {
        this.encoder = new BitStreamEncoder(CONFIG.SAFE_CHARS);
        this.setupUI();
        this.bindEvents();
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
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
            this.dropZone.addEventListener(event, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(event => {
            this.dropZone.addEventListener(event, () => this.dropZone.classList.add('drag-active'));
        });

        ['dragleave', 'drop'].forEach(event => {
            this.dropZone.addEventListener(event, () => this.dropZone.classList.remove('drag-active'));
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
            this.showStatus('Please upload a supported image format', 'error');
            return;
        }

        try {
            this.showStatus('Processing image...', 'processing');

            // Create initial preview
            const previewUrl = URL.createObjectURL(file);
            this.preview.src = previewUrl;
            this.preview.style.display = 'block';

            // First try with original format
            const buffer = await file.arrayBuffer();
            const initialBits = this.encoder.toBitArray(buffer);
            const initialEncoded = this.encoder.encodeBits(initialBits);

            if (initialEncoded.length <= CONFIG.MAX_URL_LENGTH) {
                // Original file fits within URL limit
                await this.generateResult(initialEncoded);
                this.showStatus('Image processed successfully (no compression needed)', 'success');
                return;
            }

            // Need to compress/convert the image
            this.showStatus('Compressing image...', 'processing');
            const compressedData = await this.compressImage(file);
            await this.generateResult(compressedData);
            this.showStatus('Image processed and compressed successfully', 'success');

        } catch (error) {
            console.error('Processing error:', error);
            this.showStatus(`Error: ${error.message}`, 'error');
        }
    }

    verifyEncodedData(encodedData) {
        // Check that all characters are from our safe set
        const invalidChars = [...encodedData].filter(char => !this.encoder.SAFE_CHARS.includes(char));
        if (invalidChars.length > 0) {
            throw new Error(`Invalid characters found in encoded data: ${invalidChars.join(', ')}`);
        }
        return true;
    }

    async generateResult(encodedData) {
        this.verifyEncodedData(encodedData);
        const baseUrl = window.location.href.split('?')[0].replace('index.html', '');
        const finalUrl = `${baseUrl}${encodeURIComponent(encodedData)}`;
        
        if (finalUrl.length > CONFIG.MAX_URL_LENGTH) {
            throw new Error('Generated URL exceeds maximum length even after compression');
        }

        this.resultUrl.textContent = finalUrl;
        this.resultContainer.style.display = 'block';

        // Add URL to browser history for easy sharing
        window.history.pushState({}, '', finalUrl);
    }

    async compressImage(file) {
        const img = await createImageBitmap(file);
        
        for (const strategy of CONFIG.COMPRESSION_STRATEGIES) {
            try {
                const compressed = await this.tryCompression(img, strategy);
                const bits = this.encoder.toBitArray(compressed);
                const encoded = this.encoder.encodeBits(bits);

                if (encoded.length <= CONFIG.MAX_URL_LENGTH) {
                    // Update preview with compressed version
                    const blob = new Blob([compressed], { type: strategy.format });
                    this.preview.src = URL.createObjectURL(blob);
                    return encoded;
                }
            } catch (error) {
                console.warn(`Compression attempt failed:`, error);
                continue;
            }
        }

        throw new Error('Image too large even after maximum compression');
    }

    async tryCompression(img, strategy) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculate dimensions to maintain aspect ratio while reducing size
        let scale = 1;
        let width = img.width;
        let height = img.height;

        // Estimate size and adjust scale if needed
        while ((width * height * 4 * strategy.quality) > CONFIG.MAX_URL_LENGTH * 1.00) {
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
                        blob.arrayBuffer().then(resolve).catch(reject);
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
        const formats = ['image/webp', 'image/jpeg', 'image/png'];
        const img = await createImageBitmap(file);
        let bestFormat = null;
        let smallestSize = Infinity;

        for (const format of formats) {
            try {
                const buffer = await this.tryCompression(img, { format, quality: 0.95 });
                if (buffer.byteLength < smallestSize) {
                    smallestSize = buffer.byteLength;
                    bestFormat = format;
                }
            } catch (error) {
                console.warn(`Format ${format} not supported:`, error);
            }
        }

        return bestFormat || file.type;
    }
}

// Initialize processor when document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new ImageProcessor());
} else {
    new ImageProcessor();
}
