/**
 * ProcessingMetrics.js
 * 
 * Tracks and displays detailed metrics about the image processing workflow
 * Provides real-time updates on processing stages and performance
 */
window.ProcessingMetrics = class ProcessingMetrics {
    constructor(domElements) {
        this.elements = domElements || {};
        this.metrics = {
            startTime: 0,
            stages: {},
            currentStage: null,
            originalImage: {},
            processedImage: {},
            compressionAttempts: [],
            analysis: {},
            errors: [],
            currentEncodedString: ''
        };
        
        this.stageTimers = {};
        this.overallTimer = null;
        this.setupEventListeners();
    }

    /**
     * Set the current encoded string
     * @param {string} encodedString - The current encoded string
     */
    setCurrentEncodedString(encodedString) {
        if (typeof encodedString === 'string') {
            this.metrics.currentEncodedString = encodedString;
            this.updateUI();
        }
    }

    /**
     * Sets up custom event listeners for metrics updates
     */
    setupEventListeners() {
        // Create custom event for real-time updates
        this.updateEvent = new CustomEvent('metrics-update', { 
            detail: { metrics: this.metrics },
            bubbles: true
        });
        
        // Listen for any abort/cancel events
        if (this.elements.cancelButton) {
            this.elements.cancelButton.addEventListener('click', () => {
                this.recordError('Processing cancelled by user');
                this.endProcessing();
            });
        }
    }
    
    /**
     * Start tracking overall processing time
     */
    startProcessing() {
        this.metrics.startTime = performance.now();
        this.overallTimer = setInterval(() => {
            this.updateElapsedTime();
        }, 100);
        
        this.metrics.stages = {};
        this.metrics.errors = [];
        this.metrics.compressionAttempts = [];
        
        this.updateUI();
    }
    
    /**
     * End overall processing and finalize metrics
     */
    endProcessing() {
        if (this.overallTimer) {
            clearInterval(this.overallTimer);
            this.overallTimer = null;
        }
        
        // End any running stage
        if (this.metrics.currentStage) {
            this.endStage(this.metrics.currentStage);
        }
        
        // Calculate final metrics
        this.metrics.totalTime = performance.now() - this.metrics.startTime;
        this.metrics.completed = true;
        
        this.updateUI();
    }
    
    /**
     * Start timing a specific processing stage
     * @param {string} stageName - The name of the processing stage
     * @param {string} [description] - Optional description of the stage
     */
    startStage(stageName, description = '') {
        // End previous stage if one is running
        if (this.metrics.currentStage) {
            this.endStage(this.metrics.currentStage);
        }
        
        this.metrics.currentStage = stageName;
        this.metrics.stages[stageName] = {
            name: stageName,
            description: description,
            startTime: performance.now(),
            endTime: null,
            duration: 0,
            completed: false,
            inProgress: true
        };
        
        // Start stage timer
        this.stageTimers[stageName] = setInterval(() => {
            if (this.metrics.stages[stageName]) {
                this.metrics.stages[stageName].duration = 
                    performance.now() - this.metrics.stages[stageName].startTime;
                this.updateUI();
            }
        }, 100);
        
        this.updateUI();
    }
    
    /**
     * End timing for a specific processing stage
     * @param {string} stageName - The name of the processing stage
     */
    endStage(stageName) {
        if (this.metrics.stages[stageName]) {
            const stage = this.metrics.stages[stageName];
            stage.endTime = performance.now();
            stage.duration = stage.endTime - stage.startTime;
            stage.completed = true;
            stage.inProgress = false;
            
            // Clear stage timer
            if (this.stageTimers[stageName]) {
                clearInterval(this.stageTimers[stageName]);
                delete this.stageTimers[stageName];
            }
            
            if (this.metrics.currentStage === stageName) {
                this.metrics.currentStage = null;
            }
            
            this.updateUI();
        }
    }
    
    /**
     * Update stage status without ending it
     * @param {string} stageName - The name of the processing stage 
     * @param {string} status - Status update
     */
    updateStageStatus(stageName, status) {
        if (this.metrics.stages[stageName]) {
            this.metrics.stages[stageName].latestStatus = status;
            this.updateUI();
        }
    }
    
    /**
     * Record a compression attempt with result metrics
     * @param {Object} attempt - Compression attempt data
     */
    recordCompressionAttempt(attempt) {
        // Save current encoded string if available
        if (attempt.encoded && typeof attempt.encoded === 'string') {
            this.currentEncodedString = attempt.encoded;
        }
        
        this.metrics.compressionAttempts.push({
            ...attempt,
            timestamp: performance.now()
        });
        this.updateUI();
    }
        
    /**
     * Set original image metadata
     * @param {Object} imageData - Original image data
     */
    setOriginalImage(imageData) {
        this.metrics.originalImage = {
            ...imageData,
            recordedAt: performance.now()
        };
        this.updateUI();
    }
    
    /**
     * Set processed image metadata
     * @param {Object} imageData - Processed image data
     */
    setProcessedImage(imageData) {
        this.metrics.processedImage = {
            ...imageData,
            recordedAt: performance.now()
        };
        this.updateUI();
    }
    
    /**
     * Set image analysis results
     * @param {Object} analysis - Analysis results
     */
    setAnalysis(analysis) {
        this.metrics.analysis = {
            ...analysis,
            recordedAt: performance.now()
        };
        this.updateUI();
    }
    
    /**
     * Record an error that occurred during processing
     * @param {string} message - Error message
     * @param {Error} [error] - Optional error object
     */
    recordError(message, error = null) {
        this.metrics.errors.push({
            message,
            error: error ? error.toString() : null,
            timestamp: performance.now()
        });
        this.updateUI();
    }
    
    /**
     * Update the elapsed time for the current operation
     */
    updateElapsedTime() {
        if (this.metrics.startTime) {
            this.metrics.elapsedTime = performance.now() - this.metrics.startTime;
            this.updateUI();
        }
    }
    
    /**
     * Calculate compression ratio between original and processed images
     * @returns {Object} Compression metrics
     */
    getCompressionMetrics() {
        const original = this.metrics.originalImage;
        const processed = this.metrics.processedImage;
        
        if (original.size && processed.size) {
            const ratio = (1 - (processed.size / original.size)) * 100;
            const bytesReduced = original.size - processed.size;
            
            return {
                ratio: ratio.toFixed(2),
                bytesReduced,
                bytesReducedFormatted: this.formatBytes(bytesReduced)
            };
        }
        
        return { ratio: 0, bytesReduced: 0, bytesReducedFormatted: '0 B' };
    }
    
    /**
     * Format bytes to human-readable string
     * @param {number} bytes - Bytes to format
     * @returns {string} Formatted size string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024));
        
        return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * Calculate overall progress percentage
     * @returns {number} Progress percentage (0-100)
     */
    calculateProgress() {
        // Define stage weights (should sum to 100)
        const stageWeights = {
            'initialization': 5,
            'analysis': 10,
            'formatSelection': 5,
            'compression': 60,
            'encoding': 15,
            'finalization': 5
        };
        
        let totalProgress = 0;
        let weightSum = 0;
        
        // Calculate weighted progress
        Object.keys(this.metrics.stages).forEach(stageName => {
            const stage = this.metrics.stages[stageName];
            const weight = stageWeights[stageName] || 10; // Default weight
            
            if (stage.completed) {
                totalProgress += weight;
            } else if (stage.inProgress && stage.duration > 0) {
                // Estimate stage progress based on typical duration
                const typicalDuration = stageName === 'compression' ? 2000 : 500; // ms
                const estimatedProgress = Math.min(1, stage.duration / typicalDuration);
                totalProgress += weight * estimatedProgress;
            }
            
            weightSum += weight;
        });
        
        // Normalize to 100%
        return Math.min(100, Math.round((totalProgress / weightSum) * 100));
    }
    
    /**
     * Update UI elements with current metrics
     */
    updateUI() {
        // Calculate derived metrics
        const progress = this.calculateProgress();
        const compressionMetrics = this.getCompressionMetrics();
        
        // Update progress bar if it exists
        if (this.elements.progressBar) {
            this.elements.progressBar.style.width = `${progress}%`;
            this.elements.progressBar.setAttribute('aria-valuenow', progress);
        }
        
        // Update status display
        if (this.elements.statusDisplay) {
            let statusText = '';
            
            // Show current stage
            if (this.metrics.currentStage) {
                const stage = this.metrics.stages[this.metrics.currentStage];
                statusText += `${stage.description || stage.name}... `;
                
                // Add latest status update if available
                if (stage.latestStatus) {
                    statusText += stage.latestStatus;
                }
            } else if (this.metrics.completed) {
                statusText = 'Processing complete';
                
                if (compressionMetrics.ratio > 0) {
                    statusText += ` - Reduced by ${compressionMetrics.ratio}%`;
                }
            } else if (this.metrics.errors.length > 0) {
                statusText = `Error: ${this.metrics.errors[this.metrics.errors.length - 1].message}`;
            }
            
            this.elements.statusDisplay.textContent = statusText;
        }
        
        // Update metrics display if it exists
        if (this.elements.metricsDisplay) {
            // Prepare metrics for display
            const displayMetrics = {
                originalSize: this.formatBytes(this.metrics.originalImage.size || 0),
                processedSize: this.formatBytes(this.metrics.processedImage.size || 0),
                originalFormat: this.metrics.originalImage.format || 'unknown',
                finalFormat: this.metrics.processedImage.format || 'unknown',
                compressionRatio: `${compressionMetrics.ratio}%`,
                elapsedTime: `${((this.metrics.elapsedTime || 0) / 1000).toFixed(1)}s`,
                attempts: this.metrics.compressionAttempts.length
            };
            
            // If we have a custom update function, use it
            if (typeof window.updateImageStats === 'function') {
                window.updateImageStats({
                    originalSize: displayMetrics.originalSize,
                    processedSize: displayMetrics.processedSize,
                    originalFormat: displayMetrics.originalFormat,
                    finalFormat: displayMetrics.finalFormat,
                    compressionRatio: displayMetrics.compressionRatio,
                    elapsedTime: displayMetrics.elapsedTime,
                    attempts: displayMetrics.attempts
                });
            }
            
            // Otherwise update the element directly
            if (this.elements.metricsFields) {
                Object.keys(this.elements.metricsFields).forEach(field => {
                    if (displayMetrics[field] && this.elements.metricsFields[field]) {
                        this.elements.metricsFields[field].textContent = displayMetrics[field];
                    }
                });
            }
        }
        
        // Dispatch custom event for chart/visualization updates
        document.dispatchEvent(new CustomEvent('metrics-update', { 
            detail: { 
                metrics: {
                    ...this.metrics,
                    // Include the current encoded string if available
                    currentEncodedString: this.currentEncodedString
                },
                progress,
                compressionMetrics
            },
            bubbles: true
        }));
    }
    
    /**
     * Get all metrics data
     * @returns {Object} Complete metrics data
     */
    getAllMetrics() {
        return {
            ...this.metrics,
            compression: this.getCompressionMetrics(),
            progress: this.calculateProgress()
        };
    }
};
