/**
 * PerformanceMonitor.js
 * 
 * Focused system performance monitoring for BitStream Image Share.
 * Monitors browser performance, memory usage, and provides optimization recommendations.
 * Works alongside MetricsCollector but focuses specifically on system performance.
 */
window.PerformanceMonitor = class PerformanceMonitor {
    constructor(metricsCollector = null) {
        // Prevent duplicate instances
        if (window.performanceMonitorInstance) {
            return window.performanceMonitorInstance;
        }
        window.performanceMonitorInstance = this;

        this.metricsCollector = metricsCollector;
        
        // Performance thresholds for optimization decisions
        this.thresholds = {
            memory: {
                warning: 0.7,      // 70% of heap limit
                critical: 0.85,    // 85% of heap limit
                cleanup: 0.9       // 90% triggers aggressive cleanup
            },
            timing: {
                slowOperation: 1000,    // 1s is considered slow
                verySlowOperation: 5000, // 5s is very slow
                frameRate: 30           // Target FPS
            },
            network: {
                slowRequest: 3000       // 3s for slow network requests
            }
        };

        // Performance data collection
        this.performanceData = {
            memory: {
                current: {},
                history: [],
                maxHistory: 50
            },
            timing: {
                operations: new Map(),
                slowOperations: []
            },
            browser: {
                capabilities: {},
                limitations: {}
            },
            recommendations: new Set()
        };

        // Monitoring state
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.observers = new Map();

        // Performance optimization flags
        this.optimizationState = {
            memoryOptimizationActive: false,
            aggressiveMode: false,
            reducedQuality: false
        };

        this.initialize();
        console.log('PerformanceMonitor initialized');
    }

    /**
     * Initialize performance monitoring
     */
    async initialize() {
        await this.detectBrowserCapabilities();
        this.setupPerformanceObservers();
        this.startContinuousMonitoring();
    }

    /**
     * Detect browser capabilities and limitations
     */
    async detectBrowserCapabilities() {
        const capabilities = {
            // Memory information
            memoryAPI: !!performance.memory,
            deviceMemory: navigator.deviceMemory || 'unknown',
            hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
            
            // Graphics capabilities
            webgl2: this.checkWebGL2Support(),
            webglExtensions: this.getWebGLExtensions(),
            maxTextureSize: this.getMaxTextureSize(),
            
            // Browser features
            performanceObserver: !!window.PerformanceObserver,
            intersectionObserver: !!window.IntersectionObserver,
            requestIdleCallback: !!window.requestIdleCallback,
            
            // Network information
            connection: this.getConnectionInfo(),
            
            // Platform information
            platform: this.detectPlatform(),
            isMobile: this.isMobileDevice()
        };

        this.performanceData.browser.capabilities = capabilities;
        
        // Determine performance tier
        this.performanceData.browser.tier = this.calculatePerformanceTier(capabilities);
        
        console.log('Browser capabilities detected:', capabilities);
        
        // Send to metrics collector if available
        if (this.metricsCollector) {
            await this.metricsCollector.recordPerformanceMetric('browser', 'capabilities', capabilities);
        }
    }

    /**
     * Setup Performance Observer for detailed metrics
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

        // Resource observer
        try {
            const resourceObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    this.handleResourceTiming(entry);
                });
            });
            resourceObserver.observe({ entryTypes: ['resource'] });
            this.observers.set('resource', resourceObserver);
        } catch (e) {
            console.warn('Resource observer not supported');
        }

        // Navigation observer
        try {
            const navigationObserver = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    this.handleNavigationTiming(entry);
                });
            });
            navigationObserver.observe({ entryTypes: ['navigation'] });
            this.observers.set('navigation', navigationObserver);
        } catch (e) {
            console.warn('Navigation observer not supported');
        }
    }

    /**
     * Start continuous performance monitoring
     */
    startContinuousMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        
        // Monitor every 2 seconds
        this.monitoringInterval = setInterval(async () => {
            await this.collectMemoryMetrics();
            await this.checkPerformanceHealth();
            await this.updateRecommendations();
        }, 2000);
        
        console.log('Continuous performance monitoring started');
    }

    /**
     * Stop performance monitoring
     */
    stopMonitoring() {
        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        // Disconnect observers
        for (const observer of this.observers.values()) {
            observer.disconnect();
        }
        this.observers.clear();

        console.log('Performance monitoring stopped');
    }

    /**
     * Collect memory usage metrics
     */
    async collectMemoryMetrics() {
        if (!performance.memory) return;

        const memoryInfo = {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit,
            timestamp: performance.now()
        };

        // Calculate derived metrics
        memoryInfo.usage = memoryInfo.used / memoryInfo.limit;
        memoryInfo.efficiency = memoryInfo.used / memoryInfo.total;

        // Store current and add to history
        this.performanceData.memory.current = memoryInfo;
        this.performanceData.memory.history.push(memoryInfo);

        // Trim history to prevent memory bloat
        if (this.performanceData.memory.history.length > this.performanceData.memory.maxHistory) {
            this.performanceData.memory.history.shift();
        }

        // Check for memory pressure
        if (memoryInfo.usage > this.thresholds.memory.critical) {
            await this.handleMemoryPressure('critical');
        } else if (memoryInfo.usage > this.thresholds.memory.warning) {
            await this.handleMemoryPressure('warning');
        }

        // Send to metrics collector
        if (this.metricsCollector) {
            await this.metricsCollector.recordPerformanceMetric('memory', 'usage', memoryInfo.usage);
            await this.metricsCollector.recordPerformanceMetric('memory', 'used', memoryInfo.used);
        }
    }

    /**
     * Check overall performance health
     */
    async checkPerformanceHealth() {
        const health = {
            memory: this.assessMemoryHealth(),
            timing: this.assessTimingHealth(),
            overall: 'good'
        };

        // Determine overall health
        const healthLevels = ['good', 'fair', 'poor', 'critical'];
        const worstHealth = Math.max(
            healthLevels.indexOf(health.memory),
            healthLevels.indexOf(health.timing)
        );
        health.overall = healthLevels[worstHealth];

        // Take action based on health
        if (health.overall === 'critical') {
            await this.activateEmergencyOptimizations();
        } else if (health.overall === 'poor') {
            await this.activateAggressiveOptimizations();
        }

        // Send to metrics collector
        if (this.metricsCollector) {
            await this.metricsCollector.recordPerformanceMetric('health', 'overall', health.overall);
        }
    }

    /**
     * Assess memory health based on usage patterns
     * @returns {string} Health level
     */
    assessMemoryHealth() {
        const current = this.performanceData.memory.current;
        if (!current.usage) return 'good';

        if (current.usage > this.thresholds.memory.cleanup) return 'critical';
        if (current.usage > this.thresholds.memory.critical) return 'poor';
        if (current.usage > this.thresholds.memory.warning) return 'fair';
        
        return 'good';
    }

    /**
     * Assess timing health based on operation performance
     * @returns {string} Health level
     */
    assessTimingHealth() {
        const slowOps = this.performanceData.timing.slowOperations.length;
        const recentSlowOps = this.performanceData.timing.slowOperations.filter(
            op => (performance.now() - op.timestamp) < 10000 // Last 10 seconds
        ).length;

        if (recentSlowOps > 5) return 'critical';
        if (recentSlowOps > 2) return 'poor';
        if (slowOps > 10) return 'fair';
        
        return 'good';
    }

    /**
     * Handle memory pressure situations
     * @param {string} level - Pressure level (warning, critical)
     */
    async handleMemoryPressure(level) {
        console.warn(`Memory pressure detected: ${level}`);

        if (level === 'critical' && !this.optimizationState.aggressiveMode) {
            await this.activateAggressiveOptimizations();
        }

        // Trigger garbage collection if available
        if (window.gc) {
            try {
                window.gc();
                console.log('Manual garbage collection triggered');
            } catch (e) {
                console.warn('Manual garbage collection failed:', e);
            }
        }

        // Recommend memory cleanup to other systems
        this.addRecommendation('memory-cleanup', 'High memory usage detected - consider clearing caches');

        // Send warning to metrics collector
        if (this.metricsCollector) {
            await this.metricsCollector.recordWarning(`Memory pressure: ${level}`, {
                memoryUsage: this.performanceData.memory.current.usage,
                level
            });
        }
    }

    /**
     * Handle long task detection
     * @param {PerformanceEntry} entry - Long task entry
     */
    async handleLongTask(entry) {
        const operation = {
            type: 'long-task',
            duration: entry.duration,
            timestamp: performance.now(),
            attribution: entry.attribution || []
        };

        this.performanceData.timing.slowOperations.push(operation);

        // Trim slow operations history
        if (this.performanceData.timing.slowOperations.length > 50) {
            this.performanceData.timing.slowOperations = 
                this.performanceData.timing.slowOperations.slice(-50);
        }

        // Add recommendation for long tasks
        if (entry.duration > this.thresholds.timing.verySlowOperation) {
            this.addRecommendation('break-up-tasks', 
                `Very long task detected (${entry.duration.toFixed(2)}ms) - consider breaking up operations`);
        }

        // Send to metrics collector
        if (this.metricsCollector) {
            await this.metricsCollector.recordPerformanceMetric('timing', 'longTask', entry.duration);
        }

        console.warn(`Long task detected: ${entry.duration.toFixed(2)}ms`);
    }

    /**
     * Handle resource timing information
     * @param {PerformanceEntry} entry - Resource timing entry
     */
    async handleResourceTiming(entry) {
        const loadTime = entry.responseEnd - entry.requestStart;
        
        if (loadTime > this.thresholds.network.slowRequest) {
            this.addRecommendation('slow-network', 
                `Slow resource load detected: ${entry.name} (${loadTime.toFixed(2)}ms)`);
            
            // Send to metrics collector
            if (this.metricsCollector) {
                await this.metricsCollector.recordPerformanceMetric('network', 'slowResource', loadTime);
            }
        }
    }

    /**
     * Handle navigation timing information
     * @param {PerformanceEntry} entry - Navigation timing entry
     */
    async handleNavigationTiming(entry) {
        const metrics = {
            domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
            loadComplete: entry.loadEventEnd - entry.loadEventStart,
            totalLoad: entry.loadEventEnd - entry.fetchStart
        };

        // Send to metrics collector
        if (this.metricsCollector) {
            for (const [metric, value] of Object.entries(metrics)) {
                await this.metricsCollector.recordPerformanceMetric('navigation', metric, value);
            }
        }

        console.log('Navigation timing:', metrics);
    }

    /**
     * Activate aggressive optimizations during performance issues
     */
    async activateAggressiveOptimizations() {
        if (this.optimizationState.aggressiveMode) return;
        
        this.optimizationState.aggressiveMode = true;
        console.log('Activating aggressive performance optimizations');

        // Reduce processing quality
        this.optimizationState.reducedQuality = true;
        this.addRecommendation('reduce-quality', 'Performance issues detected - reducing processing quality');

        // Notify other systems about performance constraints
        document.dispatchEvent(new CustomEvent('performance-constraint', {
            detail: { level: 'aggressive', optimizations: this.optimizationState },
            bubbles: true
        }));

        // Send to metrics collector
        if (this.metricsCollector) {
            await this.metricsCollector.recordWarning('Aggressive optimizations activated', {
                memoryUsage: this.performanceData.memory.current.usage,
                reason: 'performance-issues'
            });
        }
    }

    /**
     * Activate emergency optimizations during critical performance issues
     */
    async activateEmergencyOptimizations() {
        console.error('Activating emergency performance optimizations');

        await this.activateAggressiveOptimizations();
        
        // Additional emergency measures
        this.optimizationState.memoryOptimizationActive = true;

        // Suggest immediate cleanup to other systems
        this.addRecommendation('emergency-cleanup', 'Critical performance issues - immediate cleanup required');

        // Notify systems to reduce functionality
        document.dispatchEvent(new CustomEvent('performance-emergency', {
            detail: { level: 'critical', optimizations: this.optimizationState },
            bubbles: true
        }));

        // Send error to metrics collector
        if (this.metricsCollector) {
            await this.metricsCollector.recordError('Emergency performance optimizations activated', {
                memoryUsage: this.performanceData.memory.current.usage,
                level: 'critical'
            });
        }
    }

    /**
     * Update performance recommendations
     */
    async updateRecommendations() {
        // Clear old recommendations (older than 30 seconds)
        const now = performance.now();
        for (const rec of this.performanceData.recommendations) {
            if (now - rec.timestamp > 30000) {
                this.performanceData.recommendations.delete(rec);
            }
        }

        // Add new recommendations based on current state
        await this.generateContextualRecommendations();
    }

    /**
     * Generate contextual performance recommendations
     */
    async generateContextualRecommendations() {
        const capabilities = this.performanceData.browser.capabilities;
        const memoryHealth = this.assessMemoryHealth();
        const timingHealth = this.assessTimingHealth();

        // Low memory device recommendations
        if (capabilities.deviceMemory !== 'unknown' && capabilities.deviceMemory < 4) {
            this.addRecommendation('low-memory-device', 'Low memory device detected - consider reducing image quality');
        }

        // Mobile device recommendations
        if (capabilities.isMobile) {
            this.addRecommendation('mobile-optimization', 'Mobile device detected - optimizing for battery and performance');
        }

        // WebGL recommendations
        if (!capabilities.webgl2) {
            this.addRecommendation('no-webgl', 'WebGL2 not available - using CPU processing');
        }

        // Memory recommendations
        if (memoryHealth === 'poor' || memoryHealth === 'critical') {
            this.addRecommendation('memory-pressure', 'High memory usage - consider processing smaller images');
        }

        // Network recommendations
        const connection = capabilities.connection;
        if (connection && connection.effectiveType && ['slow-2g', '2g'].includes(connection.effectiveType)) {
            this.addRecommendation('slow-network', 'Slow network detected - consider reducing image quality');
        }
    }

    /**
     * Add a performance recommendation
     * @param {string} id - Recommendation ID
     * @param {string} message - Recommendation message
     * @param {string} priority - Priority level (low, medium, high, critical)
     */
    addRecommendation(id, message, priority = 'medium') {
        const recommendation = {
            id,
            message,
            priority,
            timestamp: performance.now()
        };

        // Remove existing recommendation with same ID
        for (const existing of this.performanceData.recommendations) {
            if (existing.id === id) {
                this.performanceData.recommendations.delete(existing);
                break;
            }
        }

        this.performanceData.recommendations.add(recommendation);

        // Log high priority recommendations
        if (['high', 'critical'].includes(priority)) {
            console.warn(`Performance recommendation [${priority}]: ${message}`);
        }
    }

    /**
     * Get current performance recommendations
     * @returns {Array} Array of current recommendations
     */
    getRecommendations() {
        return Array.from(this.performanceData.recommendations)
            .sort((a, b) => {
                const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            });
    }

    /**
     * Check WebGL2 support
     * @returns {boolean} Whether WebGL2 is supported
     */
    checkWebGL2Support() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2');
            return !!gl && !gl.isContextLost();
        } catch (e) {
            return false;
        }
    }

    /**
     * Get available WebGL extensions
     * @returns {Array} Available extensions
     */
    getWebGLExtensions() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
            return gl ? gl.getSupportedExtensions() || [] : [];
        } catch (e) {
            return [];
        }
    }

    /**
     * Get maximum texture size
     * @returns {number} Maximum texture size
     */
    getMaxTextureSize() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
            return gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 0;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Get connection information
     * @returns {Object} Connection information
     */
    getConnectionInfo() {
        if (navigator.connection) {
            return {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt,
                saveData: navigator.connection.saveData
            };
        }
        return { effectiveType: 'unknown' };
    }

    /**
     * Detect platform
     * @returns {string} Platform identifier
     */
    detectPlatform() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (userAgent.includes('win')) return 'windows';
        if (userAgent.includes('mac')) return 'macos';
        if (userAgent.includes('linux')) return 'linux';
        if (userAgent.includes('android')) return 'android';
        if (userAgent.includes('ios')) return 'ios';
        
        return 'unknown';
    }

    /**
     * Check if device is mobile
     * @returns {boolean} Whether device is mobile
     */
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    /**
     * Calculate performance tier based on capabilities
     * @param {Object} capabilities - Browser capabilities
     * @returns {string} Performance tier (high, medium, low)
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
        if (capabilities.maxTextureSize >= 8192) score += 10;

        // Platform
        if (!capabilities.isMobile) score += 10;

        if (score >= 70) return 'high';
        if (score >= 40) return 'medium';
        return 'low';
    }

    /**
     * Get current performance data
     * @returns {Object} Current performance data
     */
    getPerformanceData() {
        return {
            ...this.performanceData,
            optimizationState: { ...this.optimizationState },
            thresholds: { ...this.thresholds },
            recommendations: this.getRecommendations()
        };
    }

    /**
     * Export performance data for analysis
     * @returns {Object} Exportable performance data
     */
    exportPerformanceData() {
        return {
            metadata: {
                exportedAt: Date.now(),
                monitoringDuration: this.isMonitoring ? performance.now() : 0
            },
            data: this.getPerformanceData()
        };
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.stopMonitoring();
        this.performanceData.recommendations.clear();
        
        // Clear instance reference
        if (window.performanceMonitorInstance === this) {
            window.performanceMonitorInstance = null;
        }

        console.log('PerformanceMonitor cleaned up');
    }
};