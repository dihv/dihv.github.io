/**
 * MetricsUI.js
 * 
 * Handles UI display and updates for BitStream Image Share metrics.
 * Manages text-based metric displays, progress bars, and status updates.
 * Pure UI layer - no data collection or chart rendering concerns.
 */
window.MetricsUI = class MetricsUI {
    constructor(metricsCollector) {
        // Prevent duplicate instances
        if (window.metricsUIInstance) {
            return window.metricsUIInstance;
        }
        window.metricsUIInstance = this;

        this.metricsCollector = metricsCollector;
        
        // DOM element references
        this.elements = {
            // Status and progress elements
            status: null,
            progressBar: null,
            progressText: null,
            progressContainer: null,
            
            // Statistics elements
            originalSize: null,
            processedSize: null,
            originalFormat: null,
            finalFormat: null,
            compressionRatio: null,
            elapsedTime: null,
            attempts: null,
            
            // Container elements
            imageStats: null,
            resultContainer: null
        };

        // UI state
        this.isProcessing = false;
        this.lastUpdate = 0;
        this.updateThrottle = 100; // ms between UI updates
        this.finalValues = null; // Store final values to prevent blanking

        // Formatting utilities
        this.formatters = {
            bytes: this.formatBytes.bind(this),
            time: this.formatTime.bind(this),
            percentage: this.formatPercentage.bind(this),
            ratio: this.formatRatio.bind(this)
        };

        this.initialize();
        console.log('MetricsUI initialized');
    }

    /**
     * Initialize UI components and event listeners
     */
    async initialize() {
        this.findDOMElements();
        this.setupEventListeners();
        this.setupProgressBar();
        this.initializeDisplay();
    }

    /**
     * Find and cache DOM element references
     */
    findDOMElements() {
        // Status and progress elements
        this.elements.status = document.getElementById('status');
        this.elements.progressBar = document.getElementById('progressBar');
        this.elements.progressText = document.getElementById('progressText');
        this.elements.progressContainer = document.getElementById('progressContainer') || 
                                         document.querySelector('.progress-container');

        // Statistics elements
        this.elements.originalSize = document.getElementById('originalSize');
        this.elements.processedSize = document.getElementById('processedSize');
        this.elements.originalFormat = document.getElementById('originalFormat');
        this.elements.finalFormat = document.getElementById('finalFormat');
        this.elements.compressionRatio = document.getElementById('compressionRatio');
        this.elements.elapsedTime = document.getElementById('elapsedTime');
        this.elements.attempts = document.getElementById('attempts');

        // Container elements
        this.elements.imageStats = document.getElementById('imageStats');
        this.elements.resultContainer = document.getElementById('resultContainer');

        // Log missing critical elements
        const criticalElements = ['status', 'progressBar', 'imageStats'];
        const missing = criticalElements.filter(name => !this.elements[name]);
        if (missing.length > 0) {
            console.warn('MetricsUI: Missing critical elements:', missing);
        }
    }

    /**
     * Setup event listeners for metrics updates
     */
    setupEventListeners() {
        if (!this.metricsCollector) {
            console.error('MetricsUI: No metrics collector provided');
            return;
        }

        // Listen to all relevant metrics events
        this.metricsCollector.addEventListener('processing-started', 
            this.handleProcessingStarted.bind(this));
        this.metricsCollector.addEventListener('processing-completed', 
            this.handleProcessingCompleted.bind(this));
        this.metricsCollector.addEventListener('processing-cancelled', 
            this.handleProcessingCancelled.bind(this));
        
        this.metricsCollector.addEventListener('stage-started', 
            this.handleStageStarted.bind(this));
        this.metricsCollector.addEventListener('stage-completed', 
            this.handleStageCompleted.bind(this));
        this.metricsCollector.addEventListener('stage-updated', 
            this.handleStageUpdated.bind(this));
        this.metricsCollector.addEventListener('stage-progress', 
            this.handleStageProgress.bind(this));

        this.metricsCollector.addEventListener('original-image-set', 
            this.handleOriginalImageSet.bind(this));
        this.metricsCollector.addEventListener('processed-image-set', 
            this.handleProcessedImageSet.bind(this));
        this.metricsCollector.addEventListener('analysis-set', 
            this.handleAnalysisSet.bind(this));

        this.metricsCollector.addEventListener('compression-attempt-recorded', 
            this.handleCompressionAttempt.bind(this));
        this.metricsCollector.addEventListener('error-recorded', 
            this.handleErrorRecorded.bind(this));
        this.metricsCollector.addEventListener('warning-recorded', 
            this.handleWarningRecorded.bind(this));
    }

    /**
     * Setup progress bar functionality
     */
    setupProgressBar() {
        if (!this.elements.progressContainer) return;

        // Create cancel button if it doesn't exist
        let cancelButton = this.elements.progressContainer.querySelector('#cancelProcessing');
        if (!cancelButton) {
            cancelButton = document.createElement('button');
            cancelButton.id = 'cancelProcessing';
            cancelButton.textContent = '❌ Cancel';
            cancelButton.style.cssText = `
                background-color: #f44336;
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.9rem;
                transition: background-color 0.3s ease;
            `;
            
            // Find a place to insert the cancel button
            const progressText = this.elements.progressText;
            if (progressText && progressText.parentNode) {
                const buttonContainer = document.createElement('div');
                buttonContainer.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
                
                progressText.parentNode.insertBefore(buttonContainer, progressText);
                buttonContainer.appendChild(progressText);
                buttonContainer.appendChild(cancelButton);
            }
        }

        // Setup cancel button functionality
        cancelButton.addEventListener('click', async () => {
            if (this.metricsCollector && this.isProcessing) {
                await this.metricsCollector.cancelProcessing('User cancelled processing');
            }
        });

        cancelButton.addEventListener('mouseenter', () => {
            cancelButton.style.backgroundColor = '#d32f2f';
        });

        cancelButton.addEventListener('mouseleave', () => {
            cancelButton.style.backgroundColor = '#f44336';
        });
    }

    /**
     * Initialize display state
     */
    initializeDisplay() {
        this.resetDisplay();
        this.hideProcessingElements();
    }

    /**
     * Handle processing started event
     * @param {Event} event - Processing started event
     */
    async handleProcessingStarted(event) {
        this.isProcessing = true;
        this.finalValues = null; // Reset final values
        
        this.showProcessingElements();
        await this.updateStatus('Starting image processing...', 'processing');
        this.updateProgress(0);
        
        console.log('MetricsUI: Processing started');
    }

    /**
     * Handle processing completed event
     * @param {Event} event - Processing completed event
     */
    async handleProcessingCompleted(event) {
        this.isProcessing = false;
        const { stats } = event.detail;
        
        // Store final values to prevent UI blanking
        await this.storeFinalValues();
        
        // Update final display
        await this.updateAllStatistics();
        this.updateProgress(100);
        
        // Show completion status
        const finalStats = this.buildCompletionMessage(stats);
        await this.updateStatus(finalStats, 'success');
        
        console.log('MetricsUI: Processing completed');
    }

    /**
     * Handle processing cancelled event
     * @param {Event} event - Processing cancelled event
     */
    async handleProcessingCancelled(event) {
        this.isProcessing = false;
        const { reason } = event.detail;
        
        await this.updateStatus(`Processing cancelled: ${reason}`, 'error');
        this.updateProgress(0);
        
        console.log('MetricsUI: Processing cancelled');
    }

    /**
     * Handle stage started event
     * @param {Event} event - Stage started event
     */
    async handleStageStarted(event) {
        const { stageName, stage } = event.detail;
        await this.updateStatus(`${stage.description || stageName}...`, 'processing');
    }

    /**
     * Handle stage completed event
     * @param {Event} event - Stage completed event
     */
    async handleStageCompleted(event) {
        const { stageName, stage } = event.detail;
        
        // Update elapsed time if this was a significant stage
        await this.updateElapsedTime();
        
        console.log(`MetricsUI: Stage completed - ${stageName} (${this.formatters.time(stage.duration)})`);
    }

    /**
     * Handle stage updated event
     * @param {Event} event - Stage updated event
     */
    async handleStageUpdated(event) {
        const { stageName, update } = event.detail;
        
        // Throttle status updates to prevent UI spam
        await this.throttledStatusUpdate(`${update.status}`, 'processing');
    }

    /**
     * Handle stage progress event
     * @param {Event} event - Stage progress event
     */
    async handleStageProgress(event) {
        // Update progress bar based on overall metrics
        const progress = this.metricsCollector.calculateProgress();
        this.updateProgress(progress);
        
        // Update elapsed time
        await this.updateElapsedTime();
    }

    /**
     * Handle original image set event
     * @param {Event} event - Original image event
     */
    async handleOriginalImageSet(event) {
        const { image } = event.detail;
        await this.updateOriginalImageDisplay(image);
        this.showImageStats();
    }

    /**
     * Handle processed image set event
     * @param {Event} event - Processed image event
     */
    async handleProcessedImageSet(event) {
        const { image } = event.detail;
        await this.updateProcessedImageDisplay(image);
        await this.updateCompressionRatio();
    }

    /**
     * Handle analysis set event
     * @param {Event} event - Analysis event
     */
    async handleAnalysisSet(event) {
        const { analysis } = event.detail;
        
        // Show analysis info in status
        const imageType = analysis.analysis?.classification || analysis.analysis?.imageType || 'image';
        const dimensions = analysis.dimensions;
        const hasTransparency = analysis.analysis?.hasTransparency;
        
        let statusText = `Analyzed ${imageType}`;
        if (dimensions) {
            statusText += ` (${dimensions.width}×${dimensions.height})`;
        }
        if (hasTransparency !== undefined) {
            statusText += `, ${hasTransparency ? 'transparent' : 'opaque'}`;
        }
        
        await this.updateStatus(statusText, 'processing');
    }

    /**
     * Handle compression attempt event
     * @param {Event} event - Compression attempt event
     */
    async handleCompressionAttempt(event) {
        const { attempt, totalAttempts } = event.detail;
        
        // Update attempts counter
        if (this.elements.attempts) {
            this.elements.attempts.textContent = totalAttempts.toString();
        }

        // Show attempt info in status
        let statusText = `Compression attempt ${totalAttempts}`;
        if (attempt.format) {
            statusText += ` (${attempt.format.split('/')[1].toUpperCase()})`;
        }
        if (attempt.success) {
            statusText += ` - Success!`;
        }
        
        await this.throttledStatusUpdate(statusText, 'processing');
    }

    /**
     * Handle error recorded event
     * @param {Event} event - Error event
     */
    async handleErrorRecorded(event) {
        const { error } = event.detail;
        
        // Store current values as final values on error
        await this.storeFinalValues();
        
        await this.updateStatus(`Error: ${error.message}`, 'error');
        this.isProcessing = false;
    }

    /**
     * Handle warning recorded event
     * @param {Event} event - Warning event
     */
    async handleWarningRecorded(event) {
        const { warning } = event.detail;
        console.warn('MetricsUI: Warning -', warning.message);
    }

    /**
     * Update status display with throttling
     * @param {string} message - Status message
     * @param {string} type - Status type (processing, success, error, warning)
     */
    async updateStatus(message, type = 'processing') {
        if (!this.elements.status) return;

        this.elements.status.textContent = message;
        this.elements.status.className = `status ${type}`;
        this.elements.status.style.display = 'block';
        
        // Auto-hide processing messages after delay
        if (type === 'processing') {
            clearTimeout(this.statusTimeout);
            this.statusTimeout = setTimeout(() => {
                if (this.elements.status.className.includes('processing')) {
                    this.elements.status.style.display = 'none';
                }
            }, 5000);
        }
    }

    /**
     * Throttled status update to prevent UI spam
     * @param {string} message - Status message
     * @param {string} type - Status type
     */
    async throttledStatusUpdate(message, type = 'processing') {
        const now = performance.now();
        if (now - this.lastUpdate < this.updateThrottle) {
            return;
        }
        this.lastUpdate = now;
        
        await this.updateStatus(message, type);
    }

    /**
     * Update progress bar
     * @param {number} percentage - Progress percentage (0-100)
     */
    updateProgress(percentage) {
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        
        if (this.elements.progressBar) {
            this.elements.progressBar.style.width = `${clampedPercentage}%`;
            this.elements.progressBar.setAttribute('aria-valuenow', clampedPercentage);
        }

        if (this.elements.progressText) {
            this.elements.progressText.textContent = `${Math.round(clampedPercentage)}%`;
        }
    }

    /**
     * Update original image display
     * @param {Object} image - Original image data
     */
    async updateOriginalImageDisplay(image) {
        if (this.elements.originalSize) {
            this.elements.originalSize.textContent = this.formatters.bytes(image.size || 0);
        }

        if (this.elements.originalFormat) {
            this.elements.originalFormat.textContent = this.formatFormat(image.format || 'unknown');
        }
    }

    /**
     * Update processed image display
     * @param {Object} image - Processed image data
     */
    async updateProcessedImageDisplay(image) {
        if (this.elements.processedSize) {
            this.elements.processedSize.textContent = this.formatters.bytes(image.size || 0);
        }

        if (this.elements.finalFormat) {
            this.elements.finalFormat.textContent = this.formatFormat(image.format || 'unknown');
        }
    }

    /**
     * Update compression ratio display
     */
    async updateCompressionRatio() {
        if (!this.elements.compressionRatio) return;

        const metrics = this.metricsCollector.getMetrics();
        const { originalImage, processedImage } = metrics;

        if (originalImage.size > 0 && processedImage.size > 0) {
            const ratio = ((1 - (processedImage.size / originalImage.size)) * 100);
            this.elements.compressionRatio.textContent = this.formatters.percentage(ratio);
        } else {
            this.elements.compressionRatio.textContent = '-';
        }
    }

    /**
     * Update elapsed time display
     */
    async updateElapsedTime() {
        if (!this.elements.elapsedTime) return;

        const metrics = this.metricsCollector.getMetrics();
        const elapsedTime = metrics.isProcessing ? 
            (performance.now() - metrics.startTime) : 
            metrics.totalDuration;

        this.elements.elapsedTime.textContent = this.formatters.time(elapsedTime || 0);
    }

    /**
     * Update all statistics displays
     */
    async updateAllStatistics() {
        const metrics = this.metricsCollector.getMetrics();
        
        // Use final values if available, otherwise current metrics
        const displayData = this.finalValues || metrics;

        if (displayData.originalImage) {
            await this.updateOriginalImageDisplay(displayData.originalImage);
        }

        if (displayData.processedImage) {
            await this.updateProcessedImageDisplay(displayData.processedImage);
        }

        await this.updateCompressionRatio();
        await this.updateElapsedTime();

        if (this.elements.attempts) {
            this.elements.attempts.textContent = (displayData.compressionAttempts?.length || 0).toString();
        }
    }

    /**
     * Store final values to prevent UI blanking
     */
    async storeFinalValues() {
        const metrics = this.metricsCollector.getMetrics();
        
        this.finalValues = {
            originalImage: { ...metrics.originalImage },
            processedImage: { ...metrics.processedImage },
            compressionAttempts: [...(metrics.compressionAttempts || [])],
            totalDuration: metrics.totalDuration || (performance.now() - metrics.startTime),
            errors: [...(metrics.errors || [])]
        };
    }

    /**
     * Build completion message with statistics
     * @param {Object} stats - Final statistics
     * @returns {string} Completion message
     */
    buildCompletionMessage(stats) {
        let message = 'Processing completed successfully';

        if (stats?.compression) {
            const { originalSize, processedSize, compressionRatio } = stats.compression;
            if (originalSize > 0 && processedSize > 0) {
                message += `\nReduced from ${this.formatters.bytes(originalSize)} to ${this.formatters.bytes(processedSize)}`;
                message += ` (${this.formatters.percentage(compressionRatio)} reduction)`;
            }
        }

        if (stats?.session?.duration) {
            message += `\nCompleted in ${this.formatters.time(stats.session.duration)}`;
        }

        return message;
    }

    /**
     * Show processing-related UI elements
     */
    showProcessingElements() {
        if (this.elements.progressContainer) {
            this.elements.progressContainer.style.display = 'block';
        }
    }

    /**
     * Hide processing-related UI elements
     */
    hideProcessingElements() {
        if (this.elements.progressContainer) {
            this.elements.progressContainer.style.display = 'none';
        }
    }

    /**
     * Show image statistics container
     */
    showImageStats() {
        if (this.elements.imageStats) {
            this.elements.imageStats.style.display = 'block';
        }
    }

    /**
     * Reset display to initial state
     */
    resetDisplay() {
        // Reset progress
        this.updateProgress(0);

        // Reset statistics
        const resetFields = [
            'originalSize', 'processedSize', 'originalFormat', 
            'finalFormat', 'compressionRatio', 'elapsedTime', 'attempts'
        ];

        resetFields.forEach(field => {
            const element = this.elements[field];
            if (element) {
                element.textContent = '-';
            }
        });

        // Clear status
        if (this.elements.status) {
            this.elements.status.style.display = 'none';
        }
    }

    /**
     * Format bytes to human-readable string
     * @param {number} bytes - Bytes to format
     * @returns {string} Formatted bytes string
     */
    formatBytes(bytes) {
        if (bytes === 0 || bytes === null || bytes === undefined) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
        
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    /**
     * Format time duration to human-readable string
     * @param {number} milliseconds - Time in milliseconds
     * @returns {string} Formatted time string
     */
    formatTime(milliseconds) {
        if (milliseconds === 0 || milliseconds === null || milliseconds === undefined) return '0.0s';
        
        const seconds = milliseconds / 1000;
        
        if (seconds < 60) {
            return `${seconds.toFixed(1)}s`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        }
    }

    /**
     * Format percentage to human-readable string
     * @param {number} percentage - Percentage value
     * @returns {string} Formatted percentage string
     */
    formatPercentage(percentage) {
        if (percentage === null || percentage === undefined || isNaN(percentage)) return '0%';
        return `${percentage.toFixed(1)}%`;
    }

    /**
     * Format ratio to human-readable string
     * @param {number} ratio - Ratio value
     * @returns {string} Formatted ratio string
     */
    formatRatio(ratio) {
        if (ratio === null || ratio === undefined || isNaN(ratio)) return '1:1';
        return `${ratio.toFixed(2)}:1`;
    }

    /**
     * Format image format for display
     * @param {string} format - MIME type format
     * @returns {string} Formatted format string
     */
    formatFormat(format) {
        if (!format || format === 'unknown') return 'Unknown';
        
        // Extract format from MIME type
        const parts = format.split('/');
        if (parts.length === 2) {
            return parts[1].toUpperCase();
        }
        
        return format.toUpperCase();
    }

    /**
     * Get current UI state
     * @returns {Object} Current UI state
     */
    getUIState() {
        return {
            isProcessing: this.isProcessing,
            hasFinalValues: !!this.finalValues,
            elementsFound: Object.keys(this.elements).filter(key => this.elements[key] !== null)
        };
    }

    /**
     * Clean up resources
     */
    cleanup() {
        // Clear timeouts
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
        }

        // Reset display
        this.resetDisplay();
        this.hideProcessingElements();

        // Clear final values
        this.finalValues = null;

        // Clear instance reference
        if (window.metricsUIInstance === this) {
            window.metricsUIInstance = null;
        }

        console.log('MetricsUI cleaned up');
    }
};