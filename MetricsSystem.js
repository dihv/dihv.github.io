/**
 * MetricsSystem.js
 * 
 * Unified metrics system coordinator for BitStream Image Share.
 * Orchestrates all metrics collection, visualization, and UI updates.
 * Replaces the fragmented metrics systems with a cohesive architecture.
 */
window.MetricsSystem = class MetricsSystem {
    constructor() {
        // Prevent duplicate instances
        if (window.metricsSystemInstance) {
            console.warn('MetricsSystem already initialized, returning existing instance');
            return window.metricsSystemInstance;
        }
        window.metricsSystemInstance = this;

        // Component instances
        this.collector = null;
        this.visualizer = null;
        this.ui = null;
        this.performanceMonitor = null;

        // System state
        this.isInitialized = false;
        this.isProcessing = false;
        this.initializationPromise = null;

        // Configuration
        this.config = {
            enableVisualization: true,
            enablePerformanceMonitoring: true,
            enableUI: true,
            autoStart: true
        };

        console.log('MetricsSystem created, initializing components...');
    }

    /**
     * Initialize the complete metrics system
     * @param {Object} options - Configuration options
     * @returns {Promise<boolean>} Success status
     */
    async initialize(options = {}) {
        // Prevent multiple initialization
        if (this.isInitialized) {
            console.log('MetricsSystem already initialized');
            return true;
        }

        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this.performInitialization(options);
        return this.initializationPromise;
    }

    /**
     * Perform the actual initialization
     * @param {Object} options - Configuration options
     * @returns {Promise<boolean>} Success status
     */
    async performInitialization(options) {
        try {
            // Merge configuration
            this.config = { ...this.config, ...options };

            console.log('Initializing MetricsSystem with config:', this.config);

            // Initialize core data collector first
            await this.initializeCollector();

            // Initialize UI components
            if (this.config.enableUI) {
                await this.initializeUI();
            }

            // Initialize visualization
            if (this.config.enableVisualization) {
                await this.initializeVisualization();
            }

            // Initialize performance monitoring
            if (this.config.enablePerformanceMonitoring) {
                await this.initializePerformanceMonitoring();
            }

            // Setup cross-component communication
            this.setupComponentCommunication();

            // Setup global event listeners
            this.setupGlobalEventListeners();

            this.isInitialized = true;
            console.log('✅ MetricsSystem initialization completed successfully');

            // Emit initialization complete event
            this.emitSystemEvent('metrics-system-initialized', {
                components: this.getActiveComponents(),
                config: this.config
            });

            return true;

        } catch (error) {
            console.error('❌ MetricsSystem initialization failed:', error);
            await this.handleInitializationError(error);
            return false;
        }
    }

    /**
     * Initialize the metrics collector component
     */
    async initializeCollector() {
        if (!window.MetricsCollector) {
            throw new Error('MetricsCollector class not available');
        }

        this.collector = new window.MetricsCollector();
        console.log('✅ MetricsCollector initialized');
    }

    /**
     * Initialize the UI component
     */
    async initializeUI() {
        if (!window.MetricsUI) {
            console.warn('MetricsUI class not available, UI updates will be limited');
            return;
        }

        this.ui = new window.MetricsUI(this.collector);
        console.log('✅ MetricsUI initialized');
    }

    /**
     * Initialize the visualization component
     */
    async initializeVisualization() {
        if (!window.MetricsVisualizer) {
            console.warn('MetricsVisualizer class not available, visualizations will not be shown');
            return;
        }

        this.visualizer = new window.MetricsVisualizer(this.collector);
        console.log('✅ MetricsVisualizer initialized');
    }

    /**
     * Initialize the performance monitoring component
     */
    async initializePerformanceMonitoring() {
        if (!window.PerformanceMonitor) {
            console.warn('PerformanceMonitor class not available, performance monitoring will be limited');
            return;
        }

        this.performanceMonitor = new window.PerformanceMonitor(this.collector);
        console.log('✅ PerformanceMonitor initialized');
    }

    /**
     * Setup communication between components
     */
    setupComponentCommunication() {
        // Performance monitor recommendations should influence UI
        if (this.performanceMonitor && this.ui) {
            this.performanceMonitor.addEventListener?.('performance-constraint', (event) => {
                this.handlePerformanceConstraint(event.detail);
            });
        }

        // Visualization should respond to performance issues
        if (this.performanceMonitor && this.visualizer) {
            this.performanceMonitor.addEventListener?.('performance-emergency', (event) => {
                this.handlePerformanceEmergency(event.detail);
            });
        }
    }

    /**
     * Setup global event listeners for system coordination
     */
    setupGlobalEventListeners() {
        // Listen for page unload to cleanup
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Listen for visibility changes to pause/resume monitoring
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseMonitoring();
            } else {
                this.resumeMonitoring();
            }
        });

        // Listen for resize to update visualizations
        window.addEventListener('resize', this.throttle(() => {
            if (this.visualizer) {
                this.visualizer.handleResize?.();
            }
        }, 250));
    }

    /**
     * Start processing session across all components
     * @param {Object} options - Processing options
     */
    async startProcessing(options = {}) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (this.isProcessing) {
            console.warn('Processing already in progress');
            return;
        }

        this.isProcessing = true;

        try {
            // Start data collection
            if (this.collector) {
                await this.collector.startProcessing();
            }

            // Notify all components
            this.emitSystemEvent('processing-started', { options });

            console.log('📊 MetricsSystem: Processing started');

        } catch (error) {
            console.error('Failed to start processing:', error);
            this.isProcessing = false;
            throw error;
        }
    }

    /**
     * End processing session across all components
     */
    async endProcessing() {
        if (!this.isProcessing) {
            console.warn('No processing session to end');
            return null;
        }

        this.isProcessing = false;

        try {
            // End data collection and get final statistics
            let finalStats = null;
            if (this.collector) {
                finalStats = await this.collector.endProcessing();
            }

            // Notify all components
            this.emitSystemEvent('processing-ended', { stats: finalStats });

            console.log('📊 MetricsSystem: Processing ended');
            return finalStats;

        } catch (error) {
            console.error('Error ending processing:', error);
            throw error;
        }
    }

    /**
     * Cancel processing session across all components
     * @param {string} reason - Cancellation reason
     */
    async cancelProcessing(reason = 'User cancelled') {
        if (!this.isProcessing) {
            console.warn('No processing session to cancel');
            return;
        }

        try {
            // Cancel data collection
            if (this.collector) {
                await this.collector.cancelProcessing(reason);
            }

            this.isProcessing = false;

            // Notify all components
            this.emitSystemEvent('processing-cancelled', { reason });

            console.log('📊 MetricsSystem: Processing cancelled -', reason);

        } catch (error) {
            console.error('Error cancelling processing:', error);
            throw error;
        }
    }

    /**
     * Start a processing stage
     * @param {string} stageName - Stage name
     * @param {string} description - Stage description
     */
    async startStage(stageName, description = '') {
        if (this.collector && this.isProcessing) {
            await this.collector.startStage(stageName, description);
        }
    }

    /**
     * End a processing stage
     * @param {string} stageName - Stage name
     */
    async endStage(stageName) {
        if (this.collector && this.isProcessing) {
            await this.collector.endStage(stageName);
        }
    }

    /**
     * Update stage status
     * @param {string} stageName - Stage name
     * @param {string} status - Status message
     * @param {Object} metadata - Additional metadata
     */
    async updateStageStatus(stageName, status, metadata = {}) {
        if (this.collector && this.isProcessing) {
            await this.collector.updateStageStatus(stageName, status, metadata);
        }
    }

    /**
     * Record original image data
     * @param {Object} imageData - Image data
     */
    async setOriginalImage(imageData) {
        if (this.collector) {
            await this.collector.setOriginalImage(imageData);
        }
    }

    /**
     * Record processed image data
     * @param {Object} imageData - Processed image data
     */
    async setProcessedImage(imageData) {
        if (this.collector) {
            await this.collector.setProcessedImage(imageData);
        }
    }

    /**
     * Record image analysis results
     * @param {Object} analysisData - Analysis results
     */
    async setAnalysis(analysisData) {
        if (this.collector) {
            await this.collector.setAnalysis(analysisData);
        }
    }

    /**
     * Record a compression attempt
     * @param {Object} attempt - Compression attempt data
     */
    async recordCompressionAttempt(attempt) {
        if (this.collector) {
            await this.collector.recordCompressionAttempt(attempt);
        }
    }

    /**
     * Record binary search iteration
     * @param {Object} iteration - Binary search iteration data
     */
    async recordBinarySearchIteration(iteration) {
        if (this.collector) {
            await this.collector.recordBinarySearchIteration(iteration);
        }
    }

    /**
     * Record an error
     * @param {string} message - Error message
     * @param {Object} context - Error context
     */
    async recordError(message, context = {}) {
        if (this.collector) {
            await this.collector.recordError(message, context);
        }
    }

    /**
     * Record a warning
     * @param {string} message - Warning message
     * @param {Object} context - Warning context
     */
    async recordWarning(message, context = {}) {
        if (this.collector) {
            await this.collector.recordWarning(message, context);
        }
    }

    /**
     * Handle performance constraint events
     * @param {Object} constraint - Performance constraint details
     */
    async handlePerformanceConstraint(constraint) {
        console.log('MetricsSystem: Handling performance constraint:', constraint);

        // Adjust visualization settings
        if (this.visualizer && constraint.level === 'aggressive') {
            // Reduce update frequency for charts
            this.visualizer.config.updateInterval = 1000; // Slow down updates
            this.visualizer.config.animationDuration = 0; // Disable animations
        }

        // Emit constraint event for other systems
        this.emitSystemEvent('performance-constraint-handled', constraint);
    }

    /**
     * Handle performance emergency events
     * @param {Object} emergency - Performance emergency details
     */
    async handlePerformanceEmergency(emergency) {
        console.error('MetricsSystem: Handling performance emergency:', emergency);

        // Disable visualizations temporarily
        if (this.visualizer && emergency.level === 'critical') {
            this.visualizer.hideVisualizer();
        }

        // Reduce UI update frequency
        if (this.ui) {
            this.ui.updateThrottle = 500; // Slow down UI updates
        }

        // Emit emergency event for other systems
        this.emitSystemEvent('performance-emergency-handled', emergency);
    }

    /**
     * Handle initialization errors
     * @param {Error} error - Initialization error
     */
    async handleInitializationError(error) {
        console.error('MetricsSystem initialization error:', error);

        // Try to initialize with fallback configuration
        const fallbackConfig = {
            enableVisualization: false,
            enablePerformanceMonitoring: false,
            enableUI: true
        };

        try {
            console.log('Attempting fallback initialization...');
            await this.performInitialization(fallbackConfig);
        } catch (fallbackError) {
            console.error('Fallback initialization also failed:', fallbackError);
            
            // Emit error event
            this.emitSystemEvent('metrics-system-error', { 
                originalError: error, 
                fallbackError 
            });
        }
    }

    /**
     * Pause monitoring to save resources
     */
    pauseMonitoring() {
        if (this.performanceMonitor) {
            this.performanceMonitor.stopMonitoring?.();
        }
        console.log('📊 MetricsSystem: Monitoring paused');
    }

    /**
     * Resume monitoring
     */
    resumeMonitoring() {
        if (this.performanceMonitor && this.isInitialized) {
            this.performanceMonitor.startContinuousMonitoring?.();
        }
        console.log('📊 MetricsSystem: Monitoring resumed');
    }

    /**
     * Get comprehensive system status
     * @returns {Object} System status
     */
    getSystemStatus() {
        return {
            isInitialized: this.isInitialized,
            isProcessing: this.isProcessing,
            activeComponents: this.getActiveComponents(),
            config: this.config,
            metrics: this.collector?.getMetrics() || null,
            performance: this.performanceMonitor?.getPerformanceData() || null,
            recommendations: this.performanceMonitor?.getRecommendations() || []
        };
    }

    /**
     * Get list of active components
     * @returns {Array<string>} Active component names
     */
    getActiveComponents() {
        const components = [];
        if (this.collector) components.push('collector');
        if (this.ui) components.push('ui');
        if (this.visualizer) components.push('visualizer');
        if (this.performanceMonitor) components.push('performanceMonitor');
        return components;
    }

    /**
     * Export comprehensive metrics data
     * @returns {Object} Exportable metrics data
     */
    exportMetrics() {
        return {
            metadata: {
                exportedAt: Date.now(),
                systemStatus: this.getSystemStatus(),
                version: '1.0.0'
            },
            collector: this.collector?.exportMetrics() || null,
            performance: this.performanceMonitor?.exportPerformanceData() || null,
            ui: this.ui?.getUIState() || null
        };
    }

    /**
     * Emit system-wide event
     * @param {string} eventType - Event type
     * @param {Object} data - Event data
     */
    emitSystemEvent(eventType, data) {
        const event = new CustomEvent(`metrics-system-${eventType}`, {
            detail: { ...data, timestamp: performance.now() },
            bubbles: true
        });
        
        document.dispatchEvent(event);
        console.log(`📊 MetricsSystem event: ${eventType}`, data);
    }

    /**
     * Throttle function calls
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in ms
     * @returns {Function} Throttled function
     */
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Clean up all system resources
     */
    async cleanup() {
        console.log('📊 MetricsSystem: Starting cleanup...');

        try {
            // End any active processing
            if (this.isProcessing) {
                await this.endProcessing();
            }

            // Cleanup components in reverse order
            if (this.performanceMonitor) {
                this.performanceMonitor.cleanup?.();
                this.performanceMonitor = null;
            }

            if (this.visualizer) {
                this.visualizer.cleanup?.();
                this.visualizer = null;
            }

            if (this.ui) {
                this.ui.cleanup?.();
                this.ui = null;
            }

            if (this.collector) {
                this.collector.cleanup?.();
                this.collector = null;
            }

            // Reset state
            this.isInitialized = false;
            this.isProcessing = false;
            this.initializationPromise = null;

            // Clear instance reference
            if (window.metricsSystemInstance === this) {
                window.metricsSystemInstance = null;
            }

            console.log('✅ MetricsSystem cleanup completed');

        } catch (error) {
            console.error('Error during MetricsSystem cleanup:', error);
        }
    }

    // Static methods for easy access

    /**
     * Get or create the global metrics system instance
     * @param {Object} options - Configuration options
     * @returns {Promise<MetricsSystem>} MetricsSystem instance
     */
    static async getInstance(options = {}) {
        if (!window.metricsSystemInstance) {
            window.metricsSystemInstance = new window.MetricsSystem();
        }
        
        await window.metricsSystemInstance.initialize(options);
        return window.metricsSystemInstance;
    }

    /**
     * Quick start method for immediate use
     * @param {Object} options - Configuration options
     * @returns {Promise<MetricsSystem>} Initialized MetricsSystem instance
     */
    static async quickStart(options = {}) {
        const instance = await window.MetricsSystem.getInstance(options);
        
        // Auto-start processing if configured
        if (instance.config.autoStart && !instance.isProcessing) {
            // Wait for user interaction before starting
            console.log('📊 MetricsSystem ready for processing');
        }
        
        return instance;
    }
};