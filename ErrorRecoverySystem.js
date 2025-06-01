/**
 * Enhanced Error Recovery System for BitStream Image Share
 * 
 * Provides intelligent error handling, recovery strategies, and fallback mechanisms
 * Optimized for GitHub Pages deployment with detailed logging and user feedback
 */
window.ErrorRecoverySystem = class ErrorRecoverySystem {
    constructor() {
        this.errorHistory = [];
        this.recoveryAttempts = new Map();
        this.maxRecoveryAttempts = 3;
        this.isRecovering = false;
        
        // Error categories and recovery strategies
        this.errorStrategies = {
            'encoding': {
                fallbacks: ['cpu-encoding', 'simplified-encoding', 'emergency-compression'],
                userMessage: 'Having trouble encoding the image. Trying alternative methods...',
                recoverable: true
            },
            'webgl': {
                fallbacks: ['cpu-fallback', 'canvas-2d-fallback'],
                userMessage: 'Graphics acceleration unavailable. Switching to software processing...',
                recoverable: true
            },
            'memory': {
                fallbacks: ['reduce-quality', 'reduce-scale', 'chunk-processing'],
                userMessage: 'Memory constraints detected. Optimizing processing...',
                recoverable: true
            },
            'format': {
                fallbacks: ['format-conversion', 'fallback-jpeg', 'emergency-png'],
                userMessage: 'Format not supported. Converting to compatible format...',
                recoverable: true
            },
            'size': {
                fallbacks: ['aggressive-compression', 'extreme-scaling', 'thumbnail-mode'],
                userMessage: 'Image too large for URL. Applying aggressive compression...',
                recoverable: true
            },
            'network': {
                fallbacks: ['retry-request', 'offline-mode'],
                userMessage: 'Network issue detected. Working in offline mode...',
                recoverable: true
            },
            'critical': {
                fallbacks: ['emergency-reset', 'basic-mode'],
                userMessage: 'Critical error occurred. Switching to basic mode...',
                recoverable: false
            }
        };
        
        // Initialize error tracking
        this.setupErrorTracking();
        
        console.log('🛡️ Enhanced Error Recovery System initialized');
    }
    
    /**
     * Setup comprehensive error tracking
     */
    setupErrorTracking() {
        // Global error handler
        window.addEventListener('error', (event) => {
            this.handleGlobalError(event.error, event.filename, event.lineno);
        });
        
        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            this.handlePromiseRejection(event.reason);
            event.preventDefault(); // Prevent default browser error handling
        });
        
        // WebGL context loss handler
        document.addEventListener('webglcontextlost', (event) => {
            this.handleWebGLContextLoss(event);
        });
        
        // Memory pressure detection (if available)
        if ('memory' in performance) {
            this.monitorMemoryPressure();
        }
    }
    
    /**
     * Main error handling entry point
     */
    async handleError(error, context = {}) {
        const errorInfo = this.analyzeError(error, context);
        this.logError(errorInfo);
        
        // Check if this error type is recoverable
        if (!this.isRecoverable(errorInfo.category)) {
            return this.handleCriticalError(errorInfo);
        }
        
        // Attempt recovery if not already recovering
        if (!this.isRecovering) {
            return await this.attemptRecovery(errorInfo);
        }
        
        // If already recovering, escalate the error
        return this.escalateError(errorInfo);
    }
    
    /**
     * Analyze error to determine category and severity
     */
    analyzeError(error, context) {
        const errorInfo = {
            timestamp: Date.now(),
            message: error.message || error.toString(),
            stack: error.stack,
            context: context,
            category: 'unknown',
            severity: 'medium',
            recoverable: false
        };
        
        // Categorize error based on message and context
        if (this.isEncodingError(error, context)) {
            errorInfo.category = 'encoding';
            errorInfo.severity = 'medium';
        } else if (this.isWebGLError(error, context)) {
            errorInfo.category = 'webgl';
            errorInfo.severity = 'low';
        } else if (this.isMemoryError(error, context)) {
            errorInfo.category = 'memory';
            errorInfo.severity = 'high';
        } else if (this.isFormatError(error, context)) {
            errorInfo.category = 'format';
            errorInfo.severity = 'medium';
        } else if (this.isSizeError(error, context)) {
            errorInfo.category = 'size';
            errorInfo.severity = 'medium';
        } else if (this.isNetworkError(error, context)) {
            errorInfo.category = 'network';
            errorInfo.severity = 'low';
        } else {
            errorInfo.category = 'critical';
            errorInfo.severity = 'critical';
        }
        
        errorInfo.recoverable = this.errorStrategies[errorInfo.category]?.recoverable || false;
        
        return errorInfo;
    }
    
    /**
     * Error categorization methods
     */
    isEncodingError(error, context) {
        const encodingKeywords = ['encoding', 'directEncoder', 'encodeBits', 'radix', 'safe_chars'];
        return encodingKeywords.some(keyword => 
            error.message.toLowerCase().includes(keyword) || 
            context.operation?.includes(keyword)
        );
    }
    
    isWebGLError(error, context) {
        const webglKeywords = ['webgl', 'context', 'gpu', 'shader', 'texture'];
        return webglKeywords.some(keyword => 
            error.message.toLowerCase().includes(keyword) || 
            context.component?.includes('webgl')
        );
    }
    
    isMemoryError(error, context) {
        const memoryKeywords = ['memory', 'heap', 'allocation', 'out of memory'];
        return memoryKeywords.some(keyword => 
            error.message.toLowerCase().includes(keyword)
        ) || error.name === 'RangeError';
    }
    
    isFormatError(error, context) {
        const formatKeywords = ['format', 'unsupported', 'codec', 'mime'];
        return formatKeywords.some(keyword => 
            error.message.toLowerCase().includes(keyword) || 
            context.format
        );
    }
    
    isSizeError(error, context) {
        const sizeKeywords = ['too large', 'exceeds', 'maximum', 'url length'];
        return sizeKeywords.some(keyword => 
            error.message.toLowerCase().includes(keyword)
        );
    }
    
    isNetworkError(error, context) {
        const networkKeywords = ['network', 'fetch', 'load', 'script'];
        return networkKeywords.some(keyword => 
            error.message.toLowerCase().includes(keyword)
        ) || error.name === 'TypeError' && context.operation === 'script-loading';
    }
    
    /**
     * Attempt error recovery
     */
    async attemptRecovery(errorInfo) {
        this.isRecovering = true;
        
        try {
            const strategy = this.errorStrategies[errorInfo.category];
            if (!strategy) {
                throw new Error('No recovery strategy available');
            }
            
            // Show user-friendly message
            this.showRecoveryMessage(strategy.userMessage);
            
            // Try recovery methods in order
            for (const fallback of strategy.fallbacks) {
                try {
                    const result = await this.executeFallback(fallback, errorInfo);
                    if (result.success) {
                        this.logRecoverySuccess(errorInfo, fallback);
                        this.hideRecoveryMessage();
                        return result;
                    }
                } catch (fallbackError) {
                    console.warn(`Fallback ${fallback} failed:`, fallbackError);
                    continue;
                }
            }
            
            // All fallbacks failed
            throw new Error('All recovery methods exhausted');
            
        } catch (recoveryError) {
            return this.handleRecoveryFailure(errorInfo, recoveryError);
        } finally {
            this.isRecovering = false;
        }
    }
    
    /**
     * Execute specific fallback strategy
     */
    async executeFallback(fallbackType, errorInfo) {
        console.log(`🔧 Executing fallback: ${fallbackType}`);
        
        switch (fallbackType) {
            case 'cpu-encoding':
                return await this.fallbackToCPUEncoding(errorInfo);
                
            case 'simplified-encoding':
                return await this.fallbackToSimplifiedEncoding(errorInfo);
                
            case 'emergency-compression':
                return await this.fallbackToEmergencyCompression(errorInfo);
                
            case 'cpu-fallback':
                return await this.fallbackToCPUProcessing(errorInfo);
                
            case 'canvas-2d-fallback':
                return await this.fallbackToCanvas2D(errorInfo);
                
            case 'reduce-quality':
                return await this.fallbackToReducedQuality(errorInfo);
                
            case 'reduce-scale':
                return await this.fallbackToReducedScale(errorInfo);
                
            case 'format-conversion':
                return await this.fallbackToFormatConversion(errorInfo);
                
            case 'fallback-jpeg':
                return await this.fallbackToJPEG(errorInfo);
                
            case 'aggressive-compression':
                return await this.fallbackToAggressiveCompression(errorInfo);
                
            case 'extreme-scaling':
                return await this.fallbackToExtremeScaling(errorInfo);
                
            case 'thumbnail-mode':
                return await this.fallbackToThumbnailMode(errorInfo);
                
            case 'emergency-reset':
                return await this.fallbackToEmergencyReset(errorInfo);
                
            case 'basic-mode':
                return await this.fallbackToBasicMode(errorInfo);
                
            default:
                throw new Error(`Unknown fallback type: ${fallbackType}`);
        }
    }
    
    /**
     * Fallback implementations
     */
    async fallbackToCPUEncoding(errorInfo) {
        try {
            // Force CPU-only encoding
            if (window.imageProcessor?.encoder) {
                window.imageProcessor.encoder.gpuAccelerationEnabled = false;
            }
            
            return { success: true, method: 'cpu-encoding' };
        } catch (error) {
            return { success: false, error };
        }
    }
    
    async fallbackToSimplifiedEncoding(errorInfo) {
        try {
            // Use smaller character set or simpler encoding
            const simplifiedChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            
            if (window.imageProcessor?.encoder) {
                // Create simplified encoder
                const simplifiedEncoder = new window.DirectBaseEncoder(simplifiedChars);
                window.imageProcessor.encoder.directEncoder = simplifiedEncoder;
            }
            
            return { success: true, method: 'simplified-encoding' };
        } catch (error) {
            return { success: false, error };
        }
    }
    
    async fallbackToEmergencyCompression(errorInfo) {
        try {
            // Apply emergency compression settings
            if (window.imageProcessor?.compressionEngine) {
                const engine = window.imageProcessor.compressionEngine;
                engine.compressionParams.qualitySteps = [0.1, 0.05];
                engine.compressionParams.scaleSteps = [0.2, 0.1];
            }
            
            return { success: true, method: 'emergency-compression' };
        } catch (error) {
            return { success: false, error };
        }
    }
    
    async fallbackToReducedQuality(errorInfo) {
        try {
            // Reduce quality globally
            if (window.CONFIG) {
                window.CONFIG.COMPRESSION_QUALITY_MIN = 0.05;
                window.CONFIG.COMPRESSION_QUALITY_MAX = 0.3;
            }
            
            return { success: true, method: 'reduced-quality' };
        } catch (error) {
            return { success: false, error };
        }
    }
    
    async fallbackToReducedScale(errorInfo) {
        try {
            // Reduce scale limits
            if (window.CONFIG) {
                window.CONFIG.COMPRESSION_SCALE_MIN = 0.05;
                window.CONFIG.COMPRESSION_SCALE_MAX = 0.4;
            }
            
            return { success: true, method: 'reduced-scale' };
        } catch (error) {
            return { success: false, error };
        }
    }
    
    async fallbackToFormatConversion(errorInfo) {
        try {
            // Force specific format
            if (window.CONFIG) {
                window.CONFIG.SUPPORTED_INPUT_FORMATS = ['image/jpeg', 'image/png'];
            }
            
            return { success: true, method: 'format-conversion' };
        } catch (error) {
            return { success: false, error };
        }
    }
    
    async fallbackToJPEG(errorInfo) {
        try {
            // Force JPEG format only
            if (window.CONFIG) {
                window.CONFIG.SUPPORTED_INPUT_FORMATS = ['image/jpeg'];
            }
            
            return { success: true, method: 'jpeg-only' };
        } catch (error) {
            return { success: false, error };
        }
    }
    
    async fallbackToThumbnailMode(errorInfo) {
        try {
            // Create tiny thumbnail
            if (window.CONFIG) {
                window.CONFIG.COMPRESSION_SCALE_MAX = 0.15;
                window.CONFIG.COMPRESSION_QUALITY_MAX = 0.4;
            }
            
            return { success: true, method: 'thumbnail-mode' };
        } catch (error) {
            return { success: false, error };
        }
    }
    
    async fallbackToEmergencyReset(errorInfo) {
        try {
            // Reset all components
            if (window.imageProcessor) {
                window.imageProcessor.processingAborted = true;
                // Clear any processing state
                delete window.imageProcessorInstance;
                delete window.advancedUIInstance;
                delete window.realTimeMetricsInstance;
            }
            
            return { success: true, method: 'emergency-reset' };
        } catch (error) {
            return { success: false, error };
        }
    }
    
    async fallbackToBasicMode(errorInfo) {
        try {
            // Enable basic mode with minimal features
            window.BASIC_MODE = true;
            
            // Hide advanced UI components
            const advancedElements = document.querySelectorAll('.advanced-stats, .analysis-panel, .processing-log');
            advancedElements.forEach(el => el.style.display = 'none');
            
            return { success: true, method: 'basic-mode' };
        } catch (error) {
            return { success: false, error };
        }
    }
    
    /**
     * User interface methods
     */
    showRecoveryMessage(message) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = `🔧 ${message}`;
            statusElement.className = 'status warning';
            statusElement.style.display = 'block';
        }
    }
    
    hideRecoveryMessage() {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.style.display = 'none';
        }
    }
    
    showCriticalError(errorInfo) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.innerHTML = `
                <strong>❌ Critical Error</strong><br>
                ${errorInfo.message}<br>
                <small>Please refresh the page to try again.</small>
            `;
            statusElement.className = 'status error';
            statusElement.style.display = 'block';
        }
    }
    
    /**
     * Logging and monitoring
     */
    logError(errorInfo) {
        this.errorHistory.push(errorInfo);
        
        // Keep only last 50 errors
        if (this.errorHistory.length > 50) {
            this.errorHistory = this.errorHistory.slice(-50);
        }
        
        console.error(`🚨 Error [${errorInfo.category}/${errorInfo.severity}]:`, errorInfo);
    }
    
    logRecoverySuccess(errorInfo, fallbackMethod) {
        console.log(`✅ Recovery successful: ${fallbackMethod} for ${errorInfo.category} error`);
    }
    
    /**
     * Memory pressure monitoring
     */
    monitorMemoryPressure() {
        setInterval(() => {
            if (performance.memory) {
                const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = performance.memory;
                const memoryUsage = usedJSHeapSize / jsHeapSizeLimit;
                
                if (memoryUsage > 0.9) {
                    this.handleError(new Error('High memory usage detected'), {
                        category: 'memory',
                        memoryUsage: memoryUsage
                    });
                }
            }
        }, 10000); // Check every 10 seconds
    }
    
    /**
     * Global error handlers
     */
    handleGlobalError(error, filename, lineno) {
        this.handleError(error, {
            source: 'global',
            filename,
            lineno,
            operation: 'script-execution'
        });
    }
    
    handlePromiseRejection(reason) {
        this.handleError(reason, {
            source: 'promise',
            operation: 'async-operation'
        });
    }
    
    handleWebGLContextLoss(event) {
        this.handleError(new Error('WebGL context lost'), {
            category: 'webgl',
            event: event
        });
    }
    
    /**
     * Utility methods
     */
    isRecoverable(category) {
        return this.errorStrategies[category]?.recoverable || false;
    }
    
    handleCriticalError(errorInfo) {
        this.showCriticalError(errorInfo);
        return { success: false, critical: true, error: errorInfo };
    }
    
    escalateError(errorInfo) {
        errorInfo.escalated = true;
        return this.handleCriticalError(errorInfo);
    }
    
    handleRecoveryFailure(errorInfo, recoveryError) {
        console.error('🚨 Recovery failed:', recoveryError);
        return this.handleCriticalError(errorInfo);
    }
    
    /**
     * Get error statistics
     */
    getErrorStatistics() {
        const stats = {
            totalErrors: this.errorHistory.length,
            errorsByCategory: {},
            errorsBySeverity: {},
            recentErrors: this.errorHistory.slice(-10)
        };
        
        this.errorHistory.forEach(error => {
            stats.errorsByCategory[error.category] = (stats.errorsByCategory[error.category] || 0) + 1;
            stats.errorsBySeverity[error.severity] = (stats.errorsBySeverity[error.severity] || 0) + 1;
        });
        
        return stats;
    }
    
    /**
     * Reset error recovery system
     */
    reset() {
        this.errorHistory = [];
        this.recoveryAttempts.clear();
        this.isRecovering = false;
        console.log('🔄 Error Recovery System reset');
    }
};

// Initialize error recovery system globally
window.addEventListener('DOMContentLoaded', () => {
    if (!window.errorRecoverySystem) {
        window.errorRecoverySystem = new window.ErrorRecoverySystem();
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.ErrorRecoverySystem;
}
