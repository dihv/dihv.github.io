/**
 * MetricsCollector.js
 * 
 * Unified metrics collection system for BitStream Image Share.
 * Handles all data collection, calculation, and storage for processing metrics.
 * Pure data layer - no UI concerns.
 */
window.MetricsCollector = class MetricsCollector {
    constructor() {
        // Prevent duplicate instances
        if (window.metricsCollectorInstance) {
            return window.metricsCollectorInstance;
        }
        window.metricsCollectorInstance = this;

        // Core metrics data structure
        this.metrics = {
            // Session tracking
            sessionId: this.generateSessionId(),
            startTime: 0,
            endTime: 0,
            totalDuration: 0,
            
            // Processing stages with consistent structure
            stages: new Map(),
            currentStage: null,
            
            // Image data
            originalImage: {
                size: 0,
                format: '',
                width: 0,
                height: 0,
                recordedAt: 0
            },
            processedImage: {
                size: 0,
                format: '',
                width: 0,
                height: 0,
                recordedAt: 0
            },
            
            // Compression tracking
            compressionAttempts: [],
            binarySearchHistory: [],
            
            // Analysis results
            analysis: {},
            
            // Error tracking
            errors: [],
            warnings: [],
            
            // Performance data
            performance: {
                memory: {},
                timing: {},
                gpu: {},
                network: {}
            },
            
            // State flags
            isProcessing: false,
            isCompleted: false,
            isCancelled: false
        };

        // Event emitter for real-time updates
        this.eventTarget = new EventTarget();
        
        // Timer management
        this.stageTimers = new Map();
        this.performanceTimer = null;
        
        console.log('MetricsCollector initialized with session:', this.metrics.sessionId);
    }

    /**
     * Generate unique session identifier
     * @returns {string} Session ID
     */
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Start processing session and begin data collection
     */
    async startProcessing() {
        this.metrics.startTime = performance.now();
        this.metrics.isProcessing = true;
        this.metrics.isCompleted = false;
        this.metrics.isCancelled = false;
        
        // Reset collections for new session
        this.metrics.stages.clear();
        this.metrics.compressionAttempts = [];
        this.metrics.binarySearchHistory = [];
        this.metrics.errors = [];
        this.metrics.warnings = [];
        
        // Start performance monitoring
        this.startPerformanceMonitoring();
        
        // Emit start event
        this.emitEvent('processing-started', {
            sessionId: this.metrics.sessionId,
            startTime: this.metrics.startTime
        });
        
        console.log('Processing started for session:', this.metrics.sessionId);
    }

    /**
     * End processing session and finalize metrics
     */
    async endProcessing() {
        if (!this.metrics.isProcessing) {
            console.warn('Attempted to end processing that was not started');
            return;
        }

        this.metrics.endTime = performance.now();
        this.metrics.totalDuration = this.metrics.endTime - this.metrics.startTime;
        this.metrics.isProcessing = false;
        this.metrics.isCompleted = true;
        
        // End any active stage
        if (this.metrics.currentStage) {
            await this.endStage(this.metrics.currentStage);
        }
        
        // Stop performance monitoring
        this.stopPerformanceMonitoring();
        
        // Calculate final statistics
        const finalStats = this.calculateFinalStatistics();
        
        // Emit completion event
        this.emitEvent('processing-completed', {
            sessionId: this.metrics.sessionId,
            duration: this.metrics.totalDuration,
            stats: finalStats
        });
        
        console.log(`Processing completed in ${(this.metrics.totalDuration / 1000).toFixed(2)}s`);
        return finalStats;
    }

    /**
     * Cancel processing session
     * @param {string} reason - Cancellation reason
     */
    async cancelProcessing(reason = 'User cancelled') {
        this.metrics.isCancelled = true;
        this.metrics.isProcessing = false;
        
        await this.recordError(reason, { type: 'cancellation' });
        await this.endProcessing();
        
        this.emitEvent('processing-cancelled', { reason });
    }

    /**
     * Start timing a processing stage
     * @param {string} stageName - Stage identifier
     * @param {string} description - Human-readable stage description
     */
    async startStage(stageName, description = '') {
        // End previous stage if running
        if (this.metrics.currentStage) {
            await this.endStage(this.metrics.currentStage);
        }

        const stage = {
            name: stageName,
            description: description || stageName,
            startTime: performance.now(),
            endTime: null,
            duration: 0,
            status: 'running',
            updates: [],
            subMetrics: {}
        };

        this.metrics.stages.set(stageName, stage);
        this.metrics.currentStage = stageName;

        // Start stage-specific timer
        this.stageTimers.set(stageName, setInterval(() => {
            stage.duration = performance.now() - stage.startTime;
            this.emitEvent('stage-progress', { stageName, stage: { ...stage } });
        }, 100));

        this.emitEvent('stage-started', { stageName, stage: { ...stage } });
        console.log(`Stage started: ${stageName} - ${description}`);
    }

    /**
     * End timing for a processing stage
     * @param {string} stageName - Stage identifier
     */
    async endStage(stageName) {
        const stage = this.metrics.stages.get(stageName);
        if (!stage) {
            console.warn(`Attempted to end non-existent stage: ${stageName}`);
            return;
        }

        stage.endTime = performance.now();
        stage.duration = stage.endTime - stage.startTime;
        stage.status = 'completed';

        // Clear timer
        const timer = this.stageTimers.get(stageName);
        if (timer) {
            clearInterval(timer);
            this.stageTimers.delete(stageName);
        }

        // Clear current stage if this was it
        if (this.metrics.currentStage === stageName) {
            this.metrics.currentStage = null;
        }

        this.emitEvent('stage-completed', { stageName, stage: { ...stage } });
        console.log(`Stage completed: ${stageName} (${(stage.duration / 1000).toFixed(2)}s)`);
    }

    /**
     * Update stage status without ending it
     * @param {string} stageName - Stage identifier
     * @param {string} status - Status update
     * @param {Object} metadata - Additional metadata
     */
    async updateStageStatus(stageName, status, metadata = {}) {
        const stage = this.metrics.stages.get(stageName);
        if (!stage) {
            console.warn(`Attempted to update non-existent stage: ${stageName}`);
            return;
        }

        const update = {
            timestamp: performance.now(),
            status,
            metadata
        };

        stage.updates.push(update);
        
        // Keep only last 10 updates per stage to prevent memory bloat
        if (stage.updates.length > 10) {
            stage.updates = stage.updates.slice(-10);
        }

        this.emitEvent('stage-updated', { stageName, update, stage: { ...stage } });
    }

    /**
     * Record original image metadata
     * @param {Object} imageData - Image metadata
     */
    async setOriginalImage(imageData) {
        this.metrics.originalImage = {
            size: imageData.size || 0,
            format: imageData.format || '',
            width: imageData.width || 0,
            height: imageData.height || 0,
            recordedAt: performance.now(),
            ...imageData
        };

        this.emitEvent('original-image-set', { image: { ...this.metrics.originalImage } });
    }

    /**
     * Record processed image metadata
     * @param {Object} imageData - Processed image metadata
     */
    async setProcessedImage(imageData) {
        this.metrics.processedImage = {
            size: imageData.size || 0,
            format: imageData.format || '',
            width: imageData.width || 0,
            height: imageData.height || 0,
            recordedAt: performance.now(),
            ...imageData
        };

        this.emitEvent('processed-image-set', { image: { ...this.metrics.processedImage } });
    }

    /**
     * Record image analysis results
     * @param {Object} analysisData - Analysis results
     */
    async setAnalysis(analysisData) {
        this.metrics.analysis = {
            ...analysisData,
            recordedAt: performance.now()
        };

        this.emitEvent('analysis-set', { analysis: { ...this.metrics.analysis } });
    }

    /**
     * Record a compression attempt with detailed metrics
     * @param {Object} attempt - Compression attempt data
     */
    async recordCompressionAttempt(attempt) {
        const enhancedAttempt = {
            id: `attempt_${this.metrics.compressionAttempts.length + 1}`,
            timestamp: performance.now(),
            success: false,
            ...attempt
        };

        // Validate and enhance attempt data
        if (enhancedAttempt.encodedLength && enhancedAttempt.encodedLength <= this.getTargetLength()) {
            enhancedAttempt.success = true;
        }

        this.metrics.compressionAttempts.push(enhancedAttempt);

        this.emitEvent('compression-attempt-recorded', { 
            attempt: { ...enhancedAttempt },
            totalAttempts: this.metrics.compressionAttempts.length
        });

        console.log(`Compression attempt ${enhancedAttempt.id}: ${enhancedAttempt.success ? 'SUCCESS' : 'FAILED'}`);
    }

    /**
     * Record binary search iteration
     * @param {Object} iteration - Binary search data
     */
    async recordBinarySearchIteration(iteration) {
        const enhancedIteration = {
            id: `iteration_${this.metrics.binarySearchHistory.length + 1}`,
            timestamp: performance.now(),
            ...iteration
        };

        this.metrics.binarySearchHistory.push(enhancedIteration);

        this.emitEvent('binary-search-iteration', {
            iteration: { ...enhancedIteration },
            totalIterations: this.metrics.binarySearchHistory.length
        });
    }

    /**
     * Record an error with context
     * @param {string} message - Error message
     * @param {Object} context - Error context
     */
    async recordError(message, context = {}) {
        const error = {
            id: `error_${this.metrics.errors.length + 1}`,
            message,
            context,
            timestamp: performance.now(),
            stage: this.metrics.currentStage,
            sessionId: this.metrics.sessionId
        };

        this.metrics.errors.push(error);

        this.emitEvent('error-recorded', { error: { ...error } });
        console.error(`Error recorded: ${message}`, context);
    }

    /**
     * Record a warning with context
     * @param {string} message - Warning message
     * @param {Object} context - Warning context
     */
    async recordWarning(message, context = {}) {
        const warning = {
            id: `warning_${this.metrics.warnings.length + 1}`,
            message,
            context,
            timestamp: performance.now(),
            stage: this.metrics.currentStage
        };

        this.metrics.warnings.push(warning);

        this.emitEvent('warning-recorded', { warning: { ...warning } });
        console.warn(`Warning recorded: ${message}`, context);
    }

    /**
     * Record performance metrics
     * @param {string} category - Performance category
     * @param {string} metric - Metric name
     * @param {number} value - Metric value
     * @param {Object} metadata - Additional metadata
     */
    async recordPerformanceMetric(category, metric, value, metadata = {}) {
        if (!this.metrics.performance[category]) {
            this.metrics.performance[category] = {};
        }

        this.metrics.performance[category][metric] = {
            value,
            timestamp: performance.now(),
            metadata
        };

        this.emitEvent('performance-metric-recorded', { category, metric, value, metadata });
    }

    /**
     * Start continuous performance monitoring
     */
    startPerformanceMonitoring() {
        this.performanceTimer = setInterval(async () => {
            // Memory monitoring
            if (performance.memory) {
                await this.recordPerformanceMetric('memory', 'heapUsed', performance.memory.usedJSHeapSize);
                await this.recordPerformanceMetric('memory', 'heapTotal', performance.memory.totalJSHeapSize);
                await this.recordPerformanceMetric('memory', 'heapLimit', performance.memory.jsHeapSizeLimit);
            }

            // Frame rate estimation
            const now = performance.now();
            if (this.lastFrameTime) {
                const frameTime = now - this.lastFrameTime;
                const fps = 1000 / frameTime;
                await this.recordPerformanceMetric('timing', 'fps', fps);
            }
            this.lastFrameTime = now;

        }, 1000); // Monitor every second
    }

    /**
     * Stop performance monitoring
     */
    stopPerformanceMonitoring() {
        if (this.performanceTimer) {
            clearInterval(this.performanceTimer);
            this.performanceTimer = null;
        }
    }

    /**
     * Calculate comprehensive final statistics
     * @returns {Object} Final statistics
     */
    calculateFinalStatistics() {
        const stats = {
            session: {
                id: this.metrics.sessionId,
                duration: this.metrics.totalDuration,
                completed: this.metrics.isCompleted,
                cancelled: this.metrics.isCancelled
            },
            
            compression: this.calculateCompressionStatistics(),
            stages: this.calculateStageStatistics(),
            performance: this.calculatePerformanceStatistics(),
            quality: this.calculateQualityMetrics(),
            
            counts: {
                attempts: this.metrics.compressionAttempts.length,
                binarySearchIterations: this.metrics.binarySearchHistory.length,
                errors: this.metrics.errors.length,
                warnings: this.metrics.warnings.length
            }
        };

        return stats;
    }

    /**
     * Calculate compression-specific statistics
     * @returns {Object} Compression statistics
     */
    calculateCompressionStatistics() {
        const { originalImage, processedImage, compressionAttempts } = this.metrics;
        
        const stats = {
            originalSize: originalImage.size,
            processedSize: processedImage.size,
            compressionRatio: 0,
            bytesReduced: 0,
            efficiency: 0
        };

        if (originalImage.size > 0 && processedImage.size > 0) {
            stats.compressionRatio = (1 - (processedImage.size / originalImage.size)) * 100;
            stats.bytesReduced = originalImage.size - processedImage.size;
            stats.efficiency = processedImage.size / originalImage.size;
        }

        // Attempt analysis
        if (compressionAttempts.length > 0) {
            const successful = compressionAttempts.filter(a => a.success);
            stats.successRate = (successful.length / compressionAttempts.length) * 100;
            stats.averageAttemptTime = compressionAttempts.reduce((sum, a) => sum + (a.duration || 0), 0) / compressionAttempts.length;
        }

        return stats;
    }

    /**
     * Calculate stage timing statistics
     * @returns {Object} Stage statistics
     */
    calculateStageStatistics() {
        const stages = {};
        
        for (const [name, stage] of this.metrics.stages) {
            stages[name] = {
                duration: stage.duration,
                status: stage.status,
                updatesCount: stage.updates.length,
                percentOfTotal: this.metrics.totalDuration > 0 ? (stage.duration / this.metrics.totalDuration) * 100 : 0
            };
        }

        return stages;
    }

    /**
     * Calculate performance statistics
     * @returns {Object} Performance statistics
     */
    calculatePerformanceStatistics() {
        const stats = {
            memory: {},
            timing: {},
            averages: {}
        };

        // Memory stats
        if (this.metrics.performance.memory.heapUsed) {
            const memoryValues = Object.values(this.metrics.performance.memory).map(m => m.value);
            stats.memory.peak = Math.max(...memoryValues);
            stats.memory.average = memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length;
        }

        return stats;
    }

    /**
     * Calculate quality metrics
     * @returns {Object} Quality metrics
     */
    calculateQualityMetrics() {
        const { errors, warnings, totalDuration, compressionAttempts } = this.metrics;
        
        return {
            errorRate: (errors.length / Math.max(1, compressionAttempts.length)) * 100,
            warningRate: (warnings.length / Math.max(1, compressionAttempts.length)) * 100,
            processingSpeed: compressionAttempts.length > 0 ? totalDuration / compressionAttempts.length : 0,
            stability: errors.length === 0 && warnings.length < 3 ? 'stable' : 'unstable'
        };
    }

    /**
     * Get current progress as percentage
     * @returns {number} Progress percentage (0-100)
     */
    calculateProgress() {
        if (!this.metrics.isProcessing) {
            return this.metrics.isCompleted ? 100 : 0;
        }

        // Define expected stage weights
        const stageWeights = {
            initialization: 5,
            analysis: 10,
            formatSelection: 5,
            compression: 60,
            encoding: 15,
            finalization: 5
        };

        let totalProgress = 0;
        let totalWeight = 0;

        for (const [stageName, stage] of this.metrics.stages) {
            const weight = stageWeights[stageName] || 10;
            totalWeight += weight;

            if (stage.status === 'completed') {
                totalProgress += weight;
            } else if (stage.status === 'running') {
                // Estimate progress based on duration
                const estimatedDuration = stageName === 'compression' ? 5000 : 1000; // ms
                const progress = Math.min(1, stage.duration / estimatedDuration);
                totalProgress += weight * progress;
            }
        }

        return totalWeight > 0 ? Math.min(100, (totalProgress / totalWeight) * 100) : 0;
    }

    /**
     * Get target URL length for compression success calculation
     * @returns {number} Target length
     */
    getTargetLength() {
        return window.CONFIG?.MAX_URL_LENGTH || 800;
    }

    /**
     * Emit event to listeners
     * @param {string} eventType - Event type
     * @param {Object} data - Event data
     */
    emitEvent(eventType, data) {
        const event = new CustomEvent(eventType, {
            detail: { ...data, timestamp: performance.now() },
            bubbles: true
        });
        
        this.eventTarget.dispatchEvent(event);
        document.dispatchEvent(event); // Also emit to document for backward compatibility
    }

    /**
     * Add event listener
     * @param {string} eventType - Event type to listen for
     * @param {Function} callback - Event callback
     */
    addEventListener(eventType, callback) {
        this.eventTarget.addEventListener(eventType, callback);
    }

    /**
     * Remove event listener
     * @param {string} eventType - Event type
     * @param {Function} callback - Event callback
     */
    removeEventListener(eventType, callback) {
        this.eventTarget.removeEventListener(eventType, callback);
    }

    /**
     * Get current metrics snapshot
     * @returns {Object} Current metrics data
     */
    getMetrics() {
        return {
            ...this.metrics,
            stages: Object.fromEntries(this.metrics.stages),
            progress: this.calculateProgress(),
            statistics: this.metrics.isCompleted ? this.calculateFinalStatistics() : null
        };
    }

    /**
     * Export metrics data for analysis
     * @returns {Object} Exportable metrics data
     */
    exportMetrics() {
        return {
            metadata: {
                exportedAt: Date.now(),
                version: '1.0.0',
                sessionId: this.metrics.sessionId
            },
            metrics: this.getMetrics()
        };
    }

    /**
     * Clean up resources
     */
    cleanup() {
        // Stop all timers
        this.stopPerformanceMonitoring();
        for (const timer of this.stageTimers.values()) {
            clearInterval(timer);
        }
        this.stageTimers.clear();

        // Clear instance reference
        if (window.metricsCollectorInstance === this) {
            window.metricsCollectorInstance = null;
        }

        console.log('MetricsCollector cleaned up');
    }
};