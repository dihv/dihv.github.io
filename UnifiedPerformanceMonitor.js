/**
 * UnifiedPerformanceMonitor.js
 * 
 * Consolidates all performance monitoring into a single system.
 * Replaces fragmented monitoring across MetricsCollector, PerformanceMonitor, etc.
 */
window.UnifiedPerformanceMonitor = class UnifiedPerformanceMonitor {
    constructor(eventBus) {
        this.eventBus = eventBus;
        
        // Monitoring state
        this.isMonitoring = false;
        this.startTime = 0;
        this.endTime = 0;
        
        // Data collection
        this.metrics = {
            // Session info
            sessionId: this.generateSessionId(),
            startTime: 0,
            endTime: 0,
            duration: 0,
            
            // Performance data
            memory: {
                samples: [],
                peak: 0,
                average: 0,
                current: null
            },
            
            // Processing stages
            stages: new Map(),
            currentStage: null,
            
            // System performance
            browser: {
                capabilities: null,
                limitations: {},
                performance: 'unknown'
            },
            
            // Operations tracking
            operations: [],
            errors: [],
            warnings: []
        };
        
        // Monitoring configuration
        this.config = {
            sampleInterval: 1000,        // Memory sampling interval
            maxSamples: 100,             // Max samples to keep
            performanceThresholds: {
                memory: { warning: 0.7, critical: 0.85 },
                timing: { slow: 1000, verySlow: 5000 },
                operations: { maxConcurrent: 3 }
            }
        };
        
        // Monitoring intervals
        this.intervals = {
            memory: null,
            performance: null,
            cleanup: null
        };
        
        // Performance observers
        this.observers = new Map();
        
        this.initialize();
        console.log('UnifiedPerformanceMonitor initialized');
    }

    /**
     * Initialize performance monitoring
     */
    async initialize() {
        await this.detectSystemCapabilities();
        this.setupPerformanceObservers();
        this.setupEventListeners();
    }

    /**
     * Start monitoring session
     */
    async startMonitoring() {
        if (this.isMonitoring) {
            console.warn('Performance monitoring already active');
            return;
        }
        
        this.isMonitoring = true;
        this.startTime = performance.now();
        this.metrics.sessionId = this.generateSessionId();
        this.metrics.startTime = this.startTime;
        
        // Start continuous monitoring
        this.startMemoryMonitoring();
        this.startPerformanceMonitoring();
        this.startCleanupMonitoring();
        
        // Emit monitoring started event
        this.eventBus.emit('performance:monitoring-started', {
            sessionId: this.metrics.sessionId,
            startTime: this.startTime
        });
        
        console.log('Performance monitoring started');
    }

    /**
     * Stop monitoring session
     */
    async stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        
        this.isMonitoring = false;
        this.endTime = performance.now();
        this.metrics.endTime = this.endTime;
        this.metrics.duration = this.endTime - this.startTime;
        
        // Stop all monitoring intervals
        this.stopAllMonitoring();
        
        // Calculate final statistics
        this.calculateFinalStatistics();
        
        // Emit monitoring stopped event
        this.eventBus.emit('performance:monitoring-stopped', {
            sessionId: this.metrics.sessionId,
            duration: this.metrics.duration,
            summary: this.getSummary()
        });
        
        console.log(`Performance monitoring stopped. Duration: ${(this.metrics.duration / 1000).toFixed(2)}s`);
    }

    /**
     * Start a processing stage
     */
    async startStage(stageName, description = '') {
        // End current stage if running
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
            operations: [],
            memoryBefore: this.getCurrentMemoryUsage(),
            memoryAfter: null
        };
        
        this.metrics.stages.set(stageName, stage);
        this.metrics.currentStage = stageName;
        
        // Emit stage started event
        this.eventBus.emit('performance:stage-started', {
            stageName,
            stage: { ...stage }
        });
        
        console.log(`Performance stage started: ${stageName}`);
    }

    /**
     * End a processing stage
     */
    async endStage(stageName) {
        const stage = this.metrics.stages.get(stageName);
        if (!stage) {
            console.warn(`Attempted to end unknown stage: ${stageName}`);
            return;
        }
        
        stage.endTime = performance.now();
        stage.duration = stage.endTime - stage.startTime;
        stage.status = 'completed';
        stage.memoryAfter = this.getCurrentMemoryUsage();
        
        // Clear current stage if this was it
        if (this.metrics.currentStage === stageName) {
            this.metrics.currentStage = null;
        }
        
        // Emit stage completed event
        this.eventBus.emit('performance:stage-completed', {
            stageName,
            stage: { ...stage }
        });
        
        console.log(`Performance stage completed: ${stageName} (${(stage.duration / 1000).toFixed(2)}s)`);
    }

    /**
     * Record an operation
     */
    recordOperation(operation) {
        const enhancedOperation = {
            id: this.generateOperationId(),
            timestamp: performance.now(),
            stage: this.metrics.currentStage,
            memoryUsage: this.getCurrentMemoryUsage(),
            ...operation
        };
        
        this.metrics.operations.push(enhancedOperation);
        
        // Add to current stage if active
        if (this.metrics.currentStage) {
            const stage = this.metrics.stages.get(this.metrics.currentStage);
            if (stage) {
                stage.operations.push(enhancedOperation);
            }
        }
        
        // Check for performance issues
        this.checkOperationPerformance(enhancedOperation);
        
        // Emit operation recorded event
        this.eventBus.emit('performance:operation-recorded', enhancedOperation);
    }

    /**
     * Record an error
     */
    recordError(error, context = {}) {
        const errorRecord = {
            id: this.generateErrorId(),
            timestamp: performance.now(),
            stage: this.metrics.currentStage,
            message: error.message || error.toString(),
            stack: error.stack,
            context,
            memoryUsage: this.getCurrentMemoryUsage()
        };
        
        this.metrics.errors.push(errorRecord);
        
        // Emit error event
        this.eventBus.emit('performance:error-recorded', errorRecord);
    }

    /**
     * Record a warning
     */
    recordWarning(message, context = {}) {
        const warningRecord = {
            id: this.generateWarningId(),
            timestamp: performance.now(),
            stage: this.metrics.currentStage,
            message,
            context,
            memoryUsage: this.getCurrentMemoryUsage()
        };
        
        this.metrics.warnings.push(warningRecord);
        
        // Emit warning event
        this.eventBus.emit('performance:warning-recorded', warningRecord);
    }

    /**
     * Detect system capabilities
     */
    async detectSystemCapabilities() {
        const capabilities = {
            // Memory info
            deviceMemory: navigator.deviceMemory || 'unknown',
            hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
            
            // Performance APIs
            performanceAPI: !!performance,
            performanceMemory: !!performance.memory,
            performanceObserver: !!window.PerformanceObserver,
            
            // Graphics
            webgl: this.checkWebGLSupport(),
            webgl2: this.checkWebGL2Support(),
            canvas: !!window.HTMLCanvasElement,
            
            // Platform
            platform: navigator.platform,
            userAgent: navigator.userAgent,
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            
            // Network
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            } : null
        };
        
        // Calculate performance tier
        capabilities.performanceTier = this.calculatePerformanceTier(capabilities);
        
        this.metrics.browser.capabilities = capabilities;
        
        console.log('System capabilities detected:', capabilities);
    }

    /**
     * Setup performance observers
     */
    setupPerformanceObservers() {
        if (!window.PerformanceObserver) {
            console.warn('PerformanceObserver not available');
            return;
        }
        
        // Long task observer
        try {
            const longTaskObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    this.handleLongTask(entry);
                });
            });
            longTaskObserver.observe({ entryTypes: ['longtask'] });
            this.observers.set('longtask', longTaskObserver);
        } catch (e) {
            console.warn('Long task observer not supported');
        }
        
        // Measure observer for custom measurements
        try {
            const measureObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    this.handleMeasurement(entry);
                });
            });
            measureObserver.observe({ entryTypes: ['measure'] });
            this.observers.set('measure', measureObserver);
        } catch (e) {
            console.warn('Measure observer not supported');
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for system events that affect performance
        this.eventBus.on('processing:*', (data, eventType) => {
            this.handleProcessingEvent(eventType, data);
        });
        
        this.eventBus.on('memory:pressure', (data) => {
            this.handleMemoryPressure(data.level);
        });
        
        this.eventBus.on('error', (error) => {
            this.recordError(error);
        });
        
        this.eventBus.on('warning', (warning) => {
            this.recordWarning(warning.message, warning.context);
        });
    }

    /**
     * Start memory monitoring
     */
    startMemoryMonitoring() {
        if (!performance.memory) {
            console.warn('Memory API not available');
            return;
        }
        
        this.intervals.memory = setInterval(() => {
            const memoryUsage = this.getCurrentMemoryUsage();
            this.metrics.memory.samples.push({
                timestamp: performance.now(),
                ...memoryUsage
            });
            
            // Update current and peak
            this.metrics.memory.current = memoryUsage;
            if (memoryUsage.used > this.metrics.memory.peak) {
                this.metrics.memory.peak = memoryUsage.used;
            }
            
            // Trim samples if too many
            if (this.metrics.memory.samples.length > this.config.maxSamples) {
                this.metrics.memory.samples.shift();
            }
            
            // Check for memory pressure
            this.checkMemoryPressure(memoryUsage);
            
        }, this.config.sampleInterval);
    }

    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        this.intervals.performance = setInterval(() => {
            // Calculate averages
            this.calculateAverages();
            
            // Check overall system health
            this.checkSystemHealth();
            
        }, this.config.sampleInterval * 2); // Less frequent than memory
    }

    /**
     * Start cleanup monitoring
     */
    startCleanupMonitoring() {
        this.intervals.cleanup = setInterval(() => {
            // Clean up old samples and operations
            this.cleanupOldData();
            
        }, this.config.sampleInterval * 10); // Much less frequent
    }

    /**
     * Stop all monitoring intervals
     */
    stopAllMonitoring() {
        Object.values(this.intervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });
        
        this.intervals = { memory: null, performance: null, cleanup: null };
        
        // Disconnect observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
    }

    /**
     * Get current memory usage
     */
    getCurrentMemoryUsage() {
        if (!performance.memory) {
            return { used: 0, total: 0, limit: 0, usage: 0 };
        }
        
        const memory = performance.memory;
        return {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit,
            usage: memory.usedJSHeapSize / memory.jsHeapSizeLimit
        };
    }

    /**
     * Check memory pressure
     */
    checkMemoryPressure(memoryUsage) {
        const thresholds = this.config.performanceThresholds.memory;
        
        if (memoryUsage.usage > thresholds.critical) {
            this.eventBus.emit('performance:memory-critical', {
                usage: memoryUsage,
                level: 'critical'
            });
        } else if (memoryUsage.usage > thresholds.warning) {
            this.eventBus.emit('performance:memory-warning', {
                usage: memoryUsage,
                level: 'warning'
            });
        }
    }

    /**
     * Check operation performance
     */
    checkOperationPerformance(operation) {
        const thresholds = this.config.performanceThresholds.timing;
        
        if (operation.duration > thresholds.verySlow) {
            this.recordWarning(`Very slow operation: ${operation.type} (${operation.duration}ms)`);
        } else if (operation.duration > thresholds.slow) {
            this.recordWarning(`Slow operation: ${operation.type} (${operation.duration}ms)`);
        }
    }

    /**
     * Handle long task detection
     */
    handleLongTask(entry) {
        const operation = {
            type: 'long-task',
            duration: entry.duration,
            startTime: entry.startTime,
            attribution: entry.attribution || []
        };
        
        this.recordOperation(operation);
        
        if (entry.duration > this.config.performanceThresholds.timing.verySlow) {
            this.recordWarning(`Very long task detected: ${entry.duration.toFixed(2)}ms`);
        }
    }

    /**
     * Handle custom measurements
     */
    handleMeasurement(entry) {
        const operation = {
            type: 'measurement',
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime
        };
        
        this.recordOperation(operation);
    }

    /**
     * Handle processing events
     */
    handleProcessingEvent(eventType, data) {
        switch (eventType) {
            case 'processing:started':
                this.startMonitoring();
                break;
                
            case 'processing:completed':
            case 'processing:cancelled':
                this.stopMonitoring();
                break;
                
            case 'processing:stage-started':
                if (data.stageName) {
                    this.startStage(data.stageName, data.description);
                }
                break;
                
            case 'processing:stage-completed':
                if (data.stageName) {
                    this.endStage(data.stageName);
                }
                break;
        }
    }

    /**
     * Handle memory pressure events
     */
    handleMemoryPressure(level) {
        console.warn(`Memory pressure detected: ${level}`);
        
        if (level === 'critical') {
            // Trigger aggressive cleanup
            this.eventBus.emit('resource-pool:optimize-memory', { level: 'emergency' });
            
            // Force garbage collection if available
            if (window.gc) {
                try {
                    window.gc();
                    console.log('Forced garbage collection');
                } catch (e) {
                    console.warn('Failed to force garbage collection:', e);
                }
            }
        }
    }

    /**
     * Calculate performance averages
     */
    calculateAverages() {
        if (this.metrics.memory.samples.length > 0) {
            const totalUsed = this.metrics.memory.samples.reduce((sum, sample) => sum + sample.used, 0);
            this.metrics.memory.average = totalUsed / this.metrics.memory.samples.length;
        }
    }

    /**
     * Check overall system health
     */
    checkSystemHealth() {
        const health = {
            memory: this.getMemoryHealth(),
            operations: this.getOperationsHealth(),
            overall: 'good'
        };
        
        // Determine overall health
        const healthLevels = ['good', 'fair', 'poor', 'critical'];
        const worstHealth = Math.max(
            healthLevels.indexOf(health.memory),
            healthLevels.indexOf(health.operations)
        );
        
        health.overall = healthLevels[worstHealth];
        
        // Emit health status
        this.eventBus.emit('performance:health-status', health);
    }

    /**
     * Get memory health assessment
     */
    getMemoryHealth() {
        const current = this.metrics.memory.current;
        if (!current) return 'good';
        
        const thresholds = this.config.performanceThresholds.memory;
        
        if (current.usage > thresholds.critical) return 'critical';
        if (current.usage > thresholds.warning) return 'poor';
        return 'good';
    }

    /**
     * Get operations health assessment
     */
    getOperationsHealth() {
        const recentOps = this.metrics.operations.filter(
            op => (performance.now() - op.timestamp) < 10000 // Last 10 seconds
        );
        
        const slowOps = recentOps.filter(
            op => op.duration > this.config.performanceThresholds.timing.slow
        ).length;
        
        if (slowOps > 5) return 'critical';
        if (slowOps > 2) return 'poor';
        return 'good';
    }

    /**
     * Calculate final statistics
     */
    calculateFinalStatistics() {
        // Stage statistics
        const stageStats = {};
        for (const [name, stage] of this.metrics.stages) {
            stageStats[name] = {
                duration: stage.duration,
                operations: stage.operations.length,
                memoryDelta: stage.memoryAfter ? 
                    stage.memoryAfter.used - stage.memoryBefore.used : 0
            };
        }
        
        this.metrics.stageStatistics = stageStats;
        this.metrics.finalStatistics = {
            totalDuration: this.metrics.duration,
            totalOperations: this.metrics.operations.length,
            totalErrors: this.metrics.errors.length,
            totalWarnings: this.metrics.warnings.length,
            peakMemory: this.metrics.memory.peak,
            averageMemory: this.metrics.memory.average
        };
    }

    /**
     * Clean up old data
     */
    cleanupOldData() {
        const now = performance.now();
        const maxAge = 300000; // 5 minutes
        
        // Clean old operations
        this.metrics.operations = this.metrics.operations.filter(
            op => (now - op.timestamp) < maxAge
        );
        
        // Clean old errors and warnings
        this.metrics.errors = this.metrics.errors.filter(
            err => (now - err.timestamp) < maxAge
        );
        
        this.metrics.warnings = this.metrics.warnings.filter(
            warn => (now - warn.timestamp) < maxAge
        );
    }

    /**
     * Calculate performance tier
     */
    calculatePerformanceTier(capabilities) {
        let score = 0;
        
        // CPU cores
        if (capabilities.hardwareConcurrency >= 8) score += 30;
        else if (capabilities.hardwareConcurrency >= 4) score += 20;
        else if (capabilities.hardwareConcurrency >= 2) score += 10;
        
        // Memory
        if (capabilities.deviceMemory >= 8) score += 30;
        else if (capabilities.deviceMemory >= 4) score += 20;
        else if (capabilities.deviceMemory >= 2) score += 10;
        
        // Graphics
        if (capabilities.webgl2) score += 20;
        else if (capabilities.webgl) score += 10;
        
        // Platform
        if (!capabilities.isMobile) score += 10;
        
        if (score >= 70) return 'high';
        if (score >= 40) return 'medium';
        return 'low';
    }

    /**
     * Check WebGL support
     */
    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            return !!canvas.getContext('webgl');
        } catch (e) {
            return false;
        }
    }

    /**
     * Check WebGL2 support
     */
    checkWebGL2Support() {
        try {
            const canvas = document.createElement('canvas');
            return !!canvas.getContext('webgl2');
        } catch (e) {
            return false;
        }
    }

    /**
     * Generate unique IDs
     */
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateOperationId() {
        return `op_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    generateWarningId() {
        return `warn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    /**
     * Get performance summary
     */
    getSummary() {
        return {
            sessionId: this.metrics.sessionId,
            duration: this.metrics.duration,
            stages: this.metrics.stages.size,
            operations: this.metrics.operations.length,
            errors: this.metrics.errors.length,
            warnings: this.metrics.warnings.length,
            peakMemory: this.metrics.memory.peak,
            averageMemory: this.metrics.memory.average,
            performanceTier: this.metrics.browser.capabilities?.performanceTier
        };
    }

    /**
     * Get full metrics data
     */
    getMetrics() {
        return {
            ...this.metrics,
            stages: Object.fromEntries(this.metrics.stages)
        };
    }

    /**
     * Export metrics for analysis
     */
    exportMetrics() {
        return {
            metadata: {
                exportedAt: Date.now(),
                version: '1.0.0'
            },
            metrics: this.getMetrics()
        };
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.stopAllMonitoring();
        this.metrics.operations = [];
        this.metrics.errors = [];
        this.metrics.warnings = [];
        
        console.log('UnifiedPerformanceMonitor cleaned up');
    }
};