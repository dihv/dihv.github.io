/**
 * ErrorHandler.js
 * 
 * Centralized error handling system that replaces scattered error patterns.
 * Provides standardized error types, recovery strategies, and user feedback.
 */
window.ErrorHandler = class ErrorHandler {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.errorHistory = [];
        this.recoveryStrategies = new Map();
        this.errorCategories = new Map();
        this.maxHistorySize = 100;
        
        // Initialize error categories and strategies
        this.initializeErrorCategories();
        this.initializeRecoveryStrategies();
        
        // Setup global error handlers
        this.setupGlobalHandlers();
        
        console.log('ErrorHandler initialized');
    }

    /**
     * Initialize error categories with metadata
     */
    initializeErrorCategories() {
        this.errorCategories.set('validation', {
            severity: 'medium',
            recoverable: true,
            userFriendly: true,
            logLevel: 'warn'
        });

        this.errorCategories.set('network', {
            severity: 'medium',
            recoverable: true,
            userFriendly: true,
            logLevel: 'warn'
        });

        this.errorCategories.set('memory', {
            severity: 'high',
            recoverable: true,
            userFriendly: true,
            logLevel: 'error'
        });

        this.errorCategories.set('webgl', {
            severity: 'medium',
            recoverable: true,
            userFriendly: true,
            logLevel: 'warn'
        });

        this.errorCategories.set('encoding', {
            severity: 'high',
            recoverable: true,
            userFriendly: true,
            logLevel: 'error'
        });

        this.errorCategories.set('system', {
            severity: 'critical',
            recoverable: false,
            userFriendly: true,
            logLevel: 'error'
        });

        this.errorCategories.set('user', {
            severity: 'low',
            recoverable: true,
            userFriendly: true,
            logLevel: 'info'
        });
    }

    /**
     * Initialize recovery strategies
     */
    initializeRecoveryStrategies() {
        this.recoveryStrategies.set('validation', [
            'validateInput',
            'provideDefaults',
            'requestCorrection'
        ]);

        this.recoveryStrategies.set('network', [
            'retry',
            'useCache',
            'offlineMode'
        ]);

        this.recoveryStrategies.set('memory', [
            'clearCache',
            'reduceQuality',
            'chunkProcessing'
        ]);

        this.recoveryStrategies.set('webgl', [
            'cpuFallback',
            'reduceComplexity',
            'basicMode'
        ]);

        this.recoveryStrategies.set('encoding', [
            'alternativeFormat',
            'reduceSize',
            'fallbackEncoder'
        ]);

        this.recoveryStrategies.set('system', [
            'emergencyReset',
            'basicMode',
            'refreshPrompt'
        ]);
    }

    /**
     * Setup global error handlers
     */
    setupGlobalHandlers() {
        // Unhandled errors
        window.addEventListener('error', (event) => {
            this.handleGlobalError({
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                type: 'javascript'
            });
        });

        // Unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleGlobalError({
                message: event.reason?.message || 'Unhandled promise rejection',
                error: event.reason,
                type: 'promise'
            });
            event.preventDefault();
        });

        // WebGL context loss
        document.addEventListener('webglcontextlost', (event) => {
            this.handleError('webgl', 'WebGL context lost', {
                preventReload: event.preventDefault
            });
        });
    }

    /**
     * Handle a categorized error
     * @param {string} category - Error category
     * @param {string|Error} error - Error message or Error object
     * @param {Object} context - Additional context
     * @returns {Promise<Object>} Recovery result
     */
    async handleError(category, error, context = {}) {
        const errorObj = this.normalizeError(category, error, context);
        
        // Record error
        this.recordError(errorObj);
        
        // Log error
        this.logError(errorObj);
        
        // Emit error event
        this.eventBus.emit('error', errorObj);
        
        // Attempt recovery if error is recoverable
        if (errorObj.recoverable) {
            return await this.attemptRecovery(errorObj);
        }
        
        // Show critical error
        this.showCriticalError(errorObj);
        return { recovered: false, strategy: null };
    }

    /**
     * Handle warnings (non-critical errors)
     * @param {string} category - Warning category
     * @param {string} message - Warning message
     * @param {Object} context - Additional context
     */
    async handleWarning(category, message, context = {}) {
        const warningObj = {
            ...this.normalizeError(category, message, context),
            type: 'warning',
            severity: 'low'
        };
        
        // Record warning
        this.recordError(warningObj);
        
        // Log warning
        console.warn(`[${category}] ${message}`, context);
        
        // Emit warning event
        this.eventBus.emit('warning', warningObj);
        
        // Show user-friendly warning if applicable
        if (warningObj.userFriendly) {
            this.showWarning(warningObj);
        }
    }

    /**
     * Handle system-level errors
     * @param {Error} error - System error
     * @param {Object} context - Error context
     */
    async handleSystemError(error, context = {}) {
        return this.handleError('system', error, {
            ...context,
            critical: true,
            timestamp: Date.now()
        });
    }

    /**
     * Handle global uncaught errors
     * @param {Object} errorInfo - Global error information
     */
    async handleGlobalError(errorInfo) {
        const category = this.categorizeGlobalError(errorInfo);
        
        return this.handleError(category, errorInfo.error || errorInfo.message, {
            filename: errorInfo.filename,
            lineno: errorInfo.lineno,
            colno: errorInfo.colno,
            type: errorInfo.type,
            global: true
        });
    }

    /**
     * Normalize error object structure
     * @private
     */
    normalizeError(category, error, context) {
        const categoryInfo = this.errorCategories.get(category) || this.errorCategories.get('system');
        
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : null;
        
        return {
            id: this.generateErrorId(),
            category,
            message,
            stack,
            context,
            timestamp: Date.now(),
            severity: categoryInfo.severity,
            recoverable: categoryInfo.recoverable,
            userFriendly: categoryInfo.userFriendly,
            logLevel: categoryInfo.logLevel,
            type: 'error'
        };
    }

    /**
     * Attempt error recovery
     * @private
     */
    async attemptRecovery(errorObj) {
        const strategies = this.recoveryStrategies.get(errorObj.category) || [];
        
        for (const strategy of strategies) {
            try {
                console.log(`Attempting recovery strategy: ${strategy}`);
                
                const result = await this.executeRecoveryStrategy(strategy, errorObj);
                
                if (result.success) {
                    console.log(`Recovery successful: ${strategy}`);
                    
                    // Emit recovery success event
                    this.eventBus.emit('error:recovered', {
                        error: errorObj,
                        strategy,
                        result
                    });
                    
                    return { recovered: true, strategy, result };
                }
            } catch (recoveryError) {
                console.warn(`Recovery strategy ${strategy} failed:`, recoveryError);
            }
        }
        
        // All recovery strategies failed
        this.eventBus.emit('error:recovery-failed', errorObj);
        this.showCriticalError(errorObj);
        
        return { recovered: false, strategy: null };
    }

    /**
     * Execute a specific recovery strategy
     * @private
     */
    async executeRecoveryStrategy(strategy, errorObj) {
        switch (strategy) {
            case 'validateInput':
                return this.recoverValidateInput(errorObj);
            
            case 'provideDefaults':
                return this.recoverProvideDefaults(errorObj);
            
            case 'retry':
                return this.recoverRetry(errorObj);
            
            case 'useCache':
                return this.recoverUseCache(errorObj);
            
            case 'clearCache':
                return this.recoverClearCache(errorObj);
            
            case 'reduceQuality':
                return this.recoverReduceQuality(errorObj);
            
            case 'cpuFallback':
                return this.recoverCPUFallback(errorObj);
            
            case 'alternativeFormat':
                return this.recoverAlternativeFormat(errorObj);
            
            case 'emergencyReset':
                return this.recoverEmergencyReset(errorObj);
            
            case 'basicMode':
                return this.recoverBasicMode(errorObj);
            
            default:
                throw new Error(`Unknown recovery strategy: ${strategy}`);
        }
    }

    /**
     * Recovery strategy implementations
     */
    async recoverValidateInput(errorObj) {
        // Emit request for input validation
        this.eventBus.emit('recovery:validate-input', errorObj);
        return { success: true, message: 'Input validation requested' };
    }

    async recoverProvideDefaults(errorObj) {
        // Emit request to use default values
        this.eventBus.emit('recovery:use-defaults', errorObj);
        return { success: true, message: 'Default values applied' };
    }

    async recoverRetry(errorObj) {
        // Emit retry request
        this.eventBus.emit('recovery:retry', errorObj);
        return { success: true, message: 'Operation retry initiated' };
    }

    async recoverUseCache(errorObj) {
        // Emit request to use cached data
        this.eventBus.emit('recovery:use-cache', errorObj);
        return { success: true, message: 'Cached data used' };
    }

    async recoverClearCache(errorObj) {
        // Emit cache clear request
        this.eventBus.emit('recovery:clear-cache', errorObj);
        
        // Force garbage collection if available
        if (window.gc) {
            try {
                window.gc();
            } catch (e) {
                // Ignore gc errors
            }
        }
        
        return { success: true, message: 'Cache cleared' };
    }

    async recoverReduceQuality(errorObj) {
        // Emit quality reduction request
        this.eventBus.emit('recovery:reduce-quality', errorObj);
        return { success: true, message: 'Quality reduced for memory optimization' };
    }

    async recoverCPUFallback(errorObj) {
        // Emit CPU fallback request
        this.eventBus.emit('recovery:cpu-fallback', errorObj);
        return { success: true, message: 'Switched to CPU processing' };
    }

    async recoverAlternativeFormat(errorObj) {
        // Emit alternative format request
        this.eventBus.emit('recovery:alternative-format', errorObj);
        return { success: true, message: 'Alternative format selected' };
    }

    async recoverEmergencyReset(errorObj) {
        // Emit emergency reset request
        this.eventBus.emit('recovery:emergency-reset', errorObj);
        return { success: true, message: 'Emergency reset initiated' };
    }

    async recoverBasicMode(errorObj) {
        // Enable basic mode
        window.BASIC_MODE = true;
        this.eventBus.emit('recovery:basic-mode', errorObj);
        
        // Hide advanced UI elements
        const advancedElements = document.querySelectorAll('.advanced-feature, .visualization, .charts');
        advancedElements.forEach(el => el.style.display = 'none');
        
        return { success: true, message: 'Basic mode enabled' };
    }

    /**
     * Categorize global errors
     * @private
     */
    categorizeGlobalError(errorInfo) {
        const message = errorInfo.message?.toLowerCase() || '';
        
        if (message.includes('webgl') || message.includes('context')) {
            return 'webgl';
        }
        
        if (message.includes('memory') || message.includes('heap')) {
            return 'memory';
        }
        
        if (message.includes('network') || message.includes('fetch')) {
            return 'network';
        }
        
        if (message.includes('encode') || message.includes('decode')) {
            return 'encoding';
        }
        
        return 'system';
    }

    /**
     * Record error in history
     * @private
     */
    recordError(errorObj) {
        this.errorHistory.push(errorObj);
        
        // Trim history
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.shift();
        }
        
        // Emit error recorded event
        this.eventBus.emit('error:recorded', errorObj);
    }

    /**
     * Log error with appropriate level
     * @private
     */
    logError(errorObj) {
        const logMessage = `[${errorObj.category}] ${errorObj.message}`;
        
        switch (errorObj.logLevel) {
            case 'error':
                console.error(logMessage, errorObj);
                break;
            case 'warn':
                console.warn(logMessage, errorObj);
                break;
            case 'info':
                console.info(logMessage, errorObj);
                break;
            default:
                console.log(logMessage, errorObj);
        }
    }

    /**
     * Show user-friendly error message
     * @private
     */
    showCriticalError(errorObj) {
        this.eventBus.emit('ui:show-error', {
            title: 'Error',
            message: this.getUserFriendlyMessage(errorObj),
            severity: errorObj.severity,
            recoverable: errorObj.recoverable
        });
    }

    /**
     * Show user-friendly warning message
     * @private
     */
    showWarning(warningObj) {
        this.eventBus.emit('ui:show-warning', {
            title: 'Warning',
            message: this.getUserFriendlyMessage(warningObj),
            severity: warningObj.severity
        });
    }

    /**
     * Generate user-friendly error message
     * @private
     */
    getUserFriendlyMessage(errorObj) {
        const friendlyMessages = {
            validation: 'Invalid input detected. Please check your data and try again.',
            network: 'Network connection issue. Please check your internet connection.',
            memory: 'Memory limit reached. Try using a smaller image or refresh the page.',
            webgl: 'Graphics acceleration unavailable. The system will use slower CPU processing.',
            encoding: 'Error processing image. Try a different format or smaller size.',
            system: 'A system error occurred. Please refresh the page and try again.',
            user: 'Invalid operation. Please follow the instructions and try again.'
        };
        
        return friendlyMessages[errorObj.category] || errorObj.message;
    }

    /**
     * Generate unique error ID
     * @private
     */
    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get error statistics
     */
    getErrorStatistics() {
        const stats = {
            total: this.errorHistory.length,
            byCategory: {},
            bySeverity: {},
            recent: this.errorHistory.slice(-10)
        };
        
        this.errorHistory.forEach(error => {
            stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
            stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
        });
        
        return stats;
    }

    /**
     * Clear error history
     */
    clearHistory() {
        this.errorHistory = [];
        this.eventBus.emit('error:history-cleared');
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.clearHistory();
        console.log('ErrorHandler cleaned up');
    }
};