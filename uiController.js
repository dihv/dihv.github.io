/**
 * uiController.js
 * Handles all UI-related operations for the image processor
 */
window.UIController = class UIController {
    /**
     * Initialize the UI controller
     * @param {ImageProcessor} imageProcessor - Reference to the main processor
     */
    constructor(imageProcessor) {
        this.imageProcessor = imageProcessor;
        this.elements = {
            dropZone: null,
            fileInput: null,
            status: null,
            preview: null,
            resultUrl: null,
            resultContainer: null,
            cancelButton: null,
            progressBar: null,
            progressText: null
        };
    }

    /**
     * Set up UI elements
     */
    setupUI() {
        this.elements.dropZone = document.getElementById('dropZone');
        this.elements.fileInput = document.getElementById('fileInput');
        this.elements.status = document.getElementById('status');
        this.elements.preview = document.getElementById('preview');
        this.elements.resultUrl = document.getElementById('resultUrl');
        this.elements.resultContainer = document.getElementById('resultContainer');
        this.elements.progressBar = document.getElementById('progressBar');
        this.elements.progressText = document.getElementById('progressText');
        
        // Initialize cancel button if available
        this.elements.cancelButton = document.getElementById('cancelProcessing');
        this.setupCancelButton();
    }

    /**
     * Set up cancel button functionality
     */
    setupCancelButton() {
        if (this.elements.cancelButton) {
            this.elements.cancelButton.addEventListener('click', () => {
                this.imageProcessor.processingAborted = true;
                this.showStatus('Processing cancelled by user', 'error');
                if (this.imageProcessor.metrics) {
                    this.imageProcessor.metrics.recordError('Processing cancelled by user');
                    this.imageProcessor.metrics.endProcessing();
                }
            });
        }
    }

    /**
     * Show status message in UI
     * @param {string} message - Status message
     * @param {string} type - Status type (processing, error, success)
     * @param {string} details - Optional details
     */
    showStatus(message, type = 'processing', details = '') {
        const statusText = details ? `${message}\n${details}` : message;
        this.elements.status.textContent = statusText;
        this.elements.status.className = `status ${type}`;
        this.elements.status.style.display = 'block';
        console.log(`[${type}] ${statusText}`); // Add logging for debugging
    }

    /**
     * Update the preview image
     * @param {string} url - URL for preview image
     */
    updatePreview(url) {
        this.elements.preview.src = url;
        this.elements.preview.style.display = 'block';
    }

    /**
     * Show benchmark status in the UI
     */
    async showBenchmarkStatus() {
        if (!this.imageProcessor.benchmark) return;
        
        // Wait for benchmark to complete
        if (this.imageProcessor.benchmarkPromise) {
            try {
                const results = await this.imageProcessor.benchmarkPromise;
                this.showStatus(
                    `Performance benchmark completed: ${results.recommended.toUpperCase()} processing selected`,
                    'info'
                );
                
                // Wait a few seconds, then hide the message
                setTimeout(() => {
                    if (this.elements.status && this.elements.status.style.display !== 'none') {
                        this.elements.status.style.display = 'none';
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
     * Update image statistics in UI
     */
    updateImageStats() {
        window.updateImageStats({
            originalSize: `${(this.imageProcessor.originalSize / 1024).toFixed(2)} KB`,
            processedSize: `${(this.imageProcessor.processedSize / 1024).toFixed(2)} KB`,
            originalFormat: this.imageProcessor.originalFormat,
            finalFormat: this.imageProcessor.processedFormat
        });
    }

    /**
     * Get processing statistics as formatted string
     * @returns {string} Formatted stats
     */
    getProcessingStats() {
        const originalSize = typeof this.imageProcessor.originalSize === 'number' ? this.imageProcessor.originalSize : 0;
        const processedSize = typeof this.imageProcessor.processedSize === 'number' ? this.imageProcessor.processedSize : originalSize;
        
        const originalSizeKB = (originalSize / 1024).toFixed(2);
        const processedSizeKB = (processedSize / 1024).toFixed(2);

        let compressionRatio = 0;
        if (originalSize > 0 && processedSize > 0) {
            compressionRatio = ((1 - (processedSize / originalSize)) * 100).toFixed(1);
        }
        
        return `Successfully processed image:
                Original: ${originalSizeKB}KB (${this.imageProcessor.originalFormat})
                Final: ${processedSizeKB}KB (${this.imageProcessor.processedFormat})
                Compression: ${compressionRatio}% reduction`;
    }

    /**
     * Update progress bar with current progress
     * @param {number} percent - Progress percentage (0-100)
     */
    updateProgress(percent) {
        if (this.elements.progressBar) {
            this.elements.progressBar.style.width = `${percent}%`;
            this.elements.progressBar.setAttribute('aria-valuenow', percent);
        }
        
        if (this.elements.progressText) {
            this.elements.progressText.textContent = `${percent}%`;
        }
    }

    /**
     * Display the result URL
     * @param {string} encodedData - Encoded data string
     */
    async generateResult(encodedData) {
        if (!this.imageProcessor.verifyEncodedData(encodedData)) {
            return;
        }
        
        const baseUrl = window.location.href.split('?')[0].replace('index.html', '');
        
        // Don't use encodeURIComponent here since our SAFE_CHARS are already URL-safe
        const finalUrl = `${baseUrl}${encodedData}`;
        
        // Check max URL length
        if (finalUrl.length > this.imageProcessor.maxSize) {
            throw new Error(
                'Generated URL exceeds maximum length\n' +
                `URL length: ${finalUrl.length}\n` +
                `Maximum allowed: ${this.imageProcessor.maxSize}`
            );
        }

        this.elements.resultUrl.textContent = finalUrl;
        this.elements.resultContainer.style.display = 'block';

        // Add URL to browser history for easy sharing
        try {
            window.history.pushState({}, '', finalUrl);
        } catch (error) {
            console.warn('Failed to update browser history:', error);
            // Non-critical error, continue
        }
        
        // Show success status
        this.showStatus(this.getProcessingStats(), 'success');
    }
    
    /**
     * Show analysis information in the UI
     * @param {Object} analysisResults - Analysis data
     */
    showAnalysisInfo(analysisResults) {
        // Extract info for status display
        const imageType = analysisResults.analysis?.imageType || 'image';
        const width = analysisResults.dimensions?.width || 0;
        const height = analysisResults.dimensions?.height || 0;
        const hasTransparency = analysisResults.analysis?.hasTransparency ? 'transparent' : 'opaque';
        
        this.showStatus(
            `Analyzed ${imageType} (${(this.imageProcessor.originalSize / 1024).toFixed(2)}KB)`,
            'processing',
            `${width}×${height}, ${hasTransparency}`
        );
    }

    /**
     * Handle processing errors
     * @param {Error} error - The error to display
     */
    handleProcessingError(error) {
        console.error('Processing error:', error);
        
        if (this.imageProcessor.metrics) {
            this.imageProcessor.metrics.recordError(error.message, error);
            this.imageProcessor.metrics.endProcessing();
        }
        
        this.showStatus(
            'Processing error',
            'error',
            error.message
        );
    }
};