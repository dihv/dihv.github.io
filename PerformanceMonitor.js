/**
 * Performance Monitor for BitStream Image Share
 * 
 * Monitors and optimizes performance across all components
 * Provides real-time metrics and optimization suggestions
 */
window.PerformanceMonitor = class PerformanceMonitor {
    constructor() {
        this.metrics = {
            pageLoad: {},
            processing: {},
            encoding: {},
            memory: {},
            network: {},
            realTime: {
                fps: 0,
                frameTime: 0,
                lastFrame: performance.now()
            }
        };
        
        this.thresholds = {
            slowOperation: 1000,      // ms
            memoryWarning: 0.8,       // 80% of heap limit
            fpsTarget: 30,            // target FPS for animations
            networkSlow: 3000         // ms for slow network
        };
        
        this.observers = new Map();
        this.isMonitoring = false;
        this.performanceLog = [];
        
        // Initialize monitoring
        this.initialize();
        
        console.log('📊 Performance Monitor initialized');
    }
    
    /**
     * Initialize performance monitoring
     */
    initialize() {
        this.measurePageLoad();
        this.setupMemoryMonitoring();
        this.setupPerformanceObserver();
        this.setupRealTimeMonitoring();
        
        // Start monitoring after page load
        if (document.readyState === 'complete') {
            this.startMonitoring();
        } else {
            window.addEventListener('load', () => this.startMonitoring());
        }
    }
    
    /**
     * Measure page load performance
     */
    measurePageLoad() {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation) {
            this.metrics.pageLoad = {
                domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
                totalLoad: navigation.loadEventEnd - navigation.fetchStart,
                firstPaint: this.getFirstPaint(),
                firstContentfulPaint: this.getFirstContentfulPaint()
            };
            
            this.logMetric('page-load', this.metrics.pageLoad);
        }
    }
    
    /**
     * Get First Paint timing
     */
    getFirstPaint() {
        const fpEntry = performance.getEntriesByName('first-paint')[0];
        return fpEntry ? fpEntry.startTime : null;
    }
    
    /**
     * Get First Contentful Paint timing
     */
    getFirstContentfulPaint() {
        const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
        return fcpEntry ? fcpEntry.startTime : null;
    }
    
    /**
     * Setup memory monitoring
     */
    setupMemoryMonitoring() {
        if (!performance.memory) {
            console.warn('Memory API not available');
            return;
        }
        
        setInterval(() => {
            const memory = performance.memory;
            this.metrics.memory = {
                used: memory.usedJSHeapSize,
                total: memory.totalJSHeapSize,
                limit: memory.jsHeapSizeLimit,
                usage: memory.usedJSHeapSize / memory.jsHeapSizeLimit
            };
            
            // Check for memory pressure
            if (this.metrics.memory.usage > this.thresholds.memoryWarning) {
                this.handleMemoryPressure();
            }
            
            this.logMetric('memory', this.metrics.memory);
        }, 5000);
    }
    
    /**
     * Setup Performance Observer for detailed metrics
     */
    setupPerformanceObserver() {
        if (!window.PerformanceObserver) {
            console.warn('PerformanceObserver not available');
            return;
        }
        
        // Observe long tasks
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
        
        // Observe resource loading
        try {
            const resourceObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    this.handleResourceLoad(entry);
                });
            });
            resourceObserver.observe({ entryTypes: ['resource'] });
            this.observers.set('resource', resourceObserver);
        } catch (e) {
            console.warn('Resource observer not supported');
        }
        
        // Observe measures and marks
        try {
            const measureObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    this.handleMeasure(entry);
                });
            });
            measureObserver.observe({ entryTypes: ['measure', 'mark'] });
            this.observers.set('measure', measureObserver);
        } catch (e) {
            console.warn('Measure observer not supported');
        }
    }
    
    /**
     * Setup real-time performance monitoring
     */
    setupRealTimeMonitoring() {
        const updateRealTimeMetrics = () => {
            const now = performance.now();
            const deltaTime = now - this.metrics.realTime.lastFrame;
            
            this.metrics.realTime.frameTime = deltaTime;
            this.metrics.realTime.fps = 1000 / deltaTime;
            this.metrics.realTime.lastFrame = now;
            
            if (this.isMonitoring) {
                requestAnimationFrame(updateRealTimeMetrics);
            }
        };
        
        updateRealTimeMetrics();
    }
    
    /**
     * Start comprehensive monitoring
     */
    startMonitoring() {
        this.isMonitoring = true;
        console.log('📈 Performance monitoring started');
        
        // Monitor specific operations
        this.monitorImageProcessing();
        this.monitorEncodingOperations();
        this.monitorUIResponsiveness();
    }
    
    /**
     * Monitor image processing performance
     */
    monitorImageProcessing() {
        // Hook into image processor events
        document.addEventListener('metrics-update', (event) => {
            const { metrics } = event.detail;
            
            if (metrics.stages) {
                Object.entries(metrics.stages).forEach(([stage, data]) => {
                    if (data.duration) {
                        this.recordOperationTime('image-processing', stage, data.duration);
                    }
                });
            }
        });
        
        // Monitor compression attempts
        document.addEventListener('compression-attempt-recorded', (event) => {
            const { attempt } = event.detail;
            
            if (attempt.time) {
                this.recordOperationTime('compression', 'attempt', attempt.time);
            }
        });
    }
    
    /**
     * Monitor encoding operations
     */
    monitorEncodingOperations() {
        // Wrap encoding methods to measure performance
        if (window.DirectBaseEncoder) {
            const originalEncode = window.DirectBaseEncoder.prototype.encode;
            window.DirectBaseEncoder.prototype.encode = function(...args) {
                const start = performance.now();
                const result = originalEncode.apply(this, args);
                const duration = performance.now() - start;
                
                window.performanceMonitor?.recordOperationTime('encoding', 'direct-base', duration);
                return result;
            };
        }
    }
    
    /**
     * Monitor UI responsiveness
     */
    monitorUIResponsiveness() {
        let interactionStart = 0;
        
        // Monitor click responsiveness
        document.addEventListener('click', () => {
            interactionStart = performance.now();
        });
        
        // Monitor when DOM updates complete
        const observer = new MutationObserver(() => {
            if (interactionStart > 0) {
                const responseTime = performance.now() - interactionStart;
                this.recordOperationTime('ui', 'interaction-response', responseTime);
                interactionStart = 0;
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
        });
    }
    
    /**
     * Record operation timing
     */
    recordOperationTime(category, operation, duration) {
        if (!this.metrics[category]) {
            this.metrics[category] = {};
        }
        
        if (!this.metrics[category][operation]) {
            this.metrics[category][operation] = {
                count: 0,
                totalTime: 0,
                averageTime: 0,
                minTime: Infinity,
                maxTime: 0
            };
        }
        
        const metric = this.metrics[category][operation];
        metric.count++;
        metric.totalTime += duration;
        metric.averageTime = metric.totalTime / metric.count;
        metric.minTime = Math.min(metric.minTime, duration);
        metric.maxTime = Math.max(metric.maxTime, duration);
        
        // Check for slow operations
        if (duration > this.thresholds.slowOperation) {
            this.handleSlowOperation(category, operation, duration);
        }
        
        this.logMetric(`${category}-${operation}`, { duration, metric });
    }
    
    /**
     * Handle slow operations
     */
    handleSlowOperation(category, operation, duration) {
        console.warn(`⚠️ Slow operation detected: ${category}/${operation} took ${duration.toFixed(2)}ms`);
        
        // Suggest optimizations
        const suggestions = this.getOptimizationSuggestions(category, operation, duration);
        if (suggestions.length > 0) {
            console.log('💡 Optimization suggestions:', suggestions);
        }
        
        // Record slow operation
        this.recordSlowOperation(category, operation, duration);
    }
    
    /**
     * Get optimization suggestions
     */
    getOptimizationSuggestions(category, operation, duration) {
        const suggestions = [];
        
        switch (category) {
            case 'image-processing':
                if (duration > 5000) {
                    suggestions.push('Consider reducing image size before processing');
                    suggestions.push('Enable progressive compression for better UX');
                }
                break;
                
            case 'encoding':
                if (duration > 2000) {
                    suggestions.push('Use smaller character set for faster encoding');
                    suggestions.push('Consider chunked processing for large data');
                }
                break;
                
            case 'compression':
                if (duration > 3000) {
                    suggestions.push('Reduce quality steps in binary search');
                    suggestions.push('Use fewer compression attempts');
                }
                break;
                
            case 'ui':
                if (duration > 100) {
                    suggestions.push('Debounce UI updates');
                    suggestions.push('Use requestAnimationFrame for smooth animations');
                }
                break;
        }
        
        return suggestions;
    }
    
    /**
     * Handle memory pressure
     */
    handleMemoryPressure() {
        console.warn('⚠️ Memory pressure detected');
        
        // Trigger garbage collection if available
        if (window.gc) {
            window.gc();
        }
        
        // Suggest memory optimizations
        this.suggestMemoryOptimizations();
        
        // Notify error recovery system
        if (window.errorRecoverySystem) {
            window.errorRecoverySystem.handleError(
                new Error('Memory pressure detected'),
                { category: 'memory' }
            );
        }
    }
    
    /**
     * Suggest memory optimizations
     */
    suggestMemoryOptimizations() {
        const suggestions = [
            'Clear unused image previews',
            'Reduce compression attempts',
            'Use lower quality settings',
            'Process images in smaller chunks'
        ];
        
        console.log('💡 Memory optimization suggestions:', suggestions);
    }
    
    /**
     * Handle long tasks
     */
    handleLongTask(entry) {
        console.warn(`⚠️ Long task detected: ${entry.duration.toFixed(2)}ms`);
        
        this.recordSlowOperation('browser', 'long-task', entry.duration);
        
        // Suggest breaking up the task
        if (entry.duration > 100) {
            console.log('💡 Consider breaking up long-running operations');
        }
    }
    
    /**
     * Handle resource loading
     */
    handleResourceLoad(entry) {
        const loadTime = entry.responseEnd - entry.requestStart;
        
        this.recordOperationTime('network', 'resource-load', loadTime);
        
        if (loadTime > this.thresholds.networkSlow) {
            console.warn(`⚠️ Slow resource load: ${entry.name} took ${loadTime.toFixed(2)}ms`);
        }
    }
    
    /**
     * Handle performance measures
     */
    handleMeasure(entry) {
        if (entry.entryType === 'measure') {
            this.recordOperationTime('custom', entry.name, entry.duration);
        }
    }
    
    /**
     * Create custom performance marks
     */
    mark(name) {
        performance.mark(name);
    }
    
    /**
     * Create custom performance measures
     */
    measure(name, startMark, endMark) {
        performance.measure(name, startMark, endMark);
    }
    
    /**
     * Get performance summary
     */
    getPerformanceSummary() {
        return {
            pageLoad: this.metrics.pageLoad,
            memory: this.metrics.memory,
            processing: this.getProcessingSummary(),
            slowOperations: this.getSlowOperations(),
            suggestions: this.getAllSuggestions()
        };
    }
    
    /**
     * Get processing performance summary
     */
    getProcessingSummary() {
        const summary = {};
        
        Object.entries(this.metrics).forEach(([category, operations]) => {
            if (typeof operations === 'object' && operations.count !== undefined) {
                summary[category] = {
                    averageTime: operations.averageTime,
                    totalOperations: operations.count,
                    totalTime: operations.totalTime
                };
            }
        });
        
        return summary;
    }
    
    /**
     * Get slow operations log
     */
    getSlowOperations() {
        return this.performanceLog.filter(entry => entry.type === 'slow-operation');
    }
    
    /**
     * Get all optimization suggestions
     */
    getAllSuggestions() {
        const suggestions = [];
        
        // Analyze current metrics for suggestions
        if (this.metrics.memory?.usage > 0.7) {
            suggestions.push('High memory usage - consider reducing image size');
        }
        
        if (this.metrics.realTime?.fps < this.thresholds.fpsTarget) {
            suggestions.push('Low FPS detected - reduce animation complexity');
        }
        
        return suggestions;
    }
    
    /**
     * Record slow operation
     */
    recordSlowOperation(category, operation, duration) {
        this.performanceLog.push({
            type: 'slow-operation',
            category,
            operation,
            duration,
            timestamp: Date.now()
        });
        
        // Keep only last 100 entries
        if (this.performanceLog.length > 100) {
            this.performanceLog = this.performanceLog.slice(-100);
        }
    }
    
    /**
     * Log metric
     */
    logMetric(category, data) {
        this.performanceLog.push({
            type: 'metric',
            category,
            data,
            timestamp: Date.now()
        });
        
        // Keep only last 200 entries
        if (this.performanceLog.length > 200) {
            this.performanceLog = this.performanceLog.slice(-200);
        }
    }
    
    /**
     * Export performance data
     */
    exportData() {
        return {
            metrics: this.metrics,
            log: this.performanceLog,
            summary: this.getPerformanceSummary(),
            timestamp: Date.now()
        };
    }
    
    /**
     * Display performance dashboard
     */
    showDashboard() {
        const dashboard = this.createDashboardElement();
        document.body.appendChild(dashboard);
    }
    
    /**
     * Create performance dashboard element
     */
    createDashboardElement() {
        const dashboard = document.createElement('div');
        dashboard.id = 'performance-dashboard';
        dashboard.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 300px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 1rem;
            font-family: monospace;
            font-size: 12px;
            z-index: 10000;
            box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        `;
        
        const summary = this.getPerformanceSummary();
        
        dashboard.innerHTML = `
            <h3 style="margin: 0 0 1rem 0;">📊 Performance Monitor</h3>
            <div><strong>Memory:</strong> ${(summary.memory?.usage * 100 || 0).toFixed(1)}%</div>
            <div><strong>FPS:</strong> ${this.metrics.realTime.fps.toFixed(1)}</div>
            <div><strong>Frame Time:</strong> ${this.metrics.realTime.frameTime.toFixed(1)}ms</div>
            <div><strong>Slow Operations:</strong> ${this.getSlowOperations().length}</div>
            <button onclick="this.parentNode.remove()" style="margin-top: 1rem;">Close</button>
        `;
        
        return dashboard;
    }
    
    /**
     * Stop monitoring
     */
    stopMonitoring() {
        this.isMonitoring = false;
        
        // Disconnect observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
        
        console.log('📊 Performance monitoring stopped');
    }
};

// Initialize performance monitor
window.addEventListener('DOMContentLoaded', () => {
    if (!window.performanceMonitor) {
        window.performanceMonitor = new window.PerformanceMonitor();
    }
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.PerformanceMonitor;
}
