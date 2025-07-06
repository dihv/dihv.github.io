/**
 * SystemManager.js (Enhanced with Debug Integration)
 * 
 * Central coordination system with comprehensive debugging and error reporting.
 * This enhanced version includes the DebugManager for troubleshooting UI issues.
 */
window.SystemManager = class SystemManager {
    constructor() {
        if (window.systemManagerInstance) {
            return window.systemManagerInstance;
        }
        window.systemManagerInstance = this;

        // Core system state
        this.state = {
            initialized: false,
            components: new Map(),
            dependencies: new Map(),
            eventBus: null,
            config: null,
            debugManager: null
        };

        // Component registry with dependency information (updated with DebugManager)
        this.componentRegistry = {
            // Core infrastructure (no dependencies)
            config: { class: 'ConfigValidator', deps: [], required: true },
            eventBus: { class: 'EventBus', deps: [], required: true },
            
            // Debug manager (depends only on eventBus)
            debugManager: { class: 'DebugManager', deps: ['eventBus'], required: false },
            
            // Core components with debug support
            errorHandler: { class: 'ErrorHandler', deps: ['eventBus'], required: true },
            resourcePool: { class: 'ResourcePool', deps: ['eventBus'], required: true },
            
            // Utilities (minimal dependencies)
            utils: { class: 'SharedUtils', deps: [], required: true },
            webglManager: { class: 'WebGLManager', deps: ['resourcePool'], required: false },
            
            // Processing components
            encoder: { class: 'GPUBitStreamEncoder', deps: ['config', 'webglManager'], required: true },
            decoder: { class: 'GPUBitStreamDecoder', deps: ['config', 'webglManager'], required: false },
            compressionEngine: { class: 'CompressionEngine', deps: ['encoder', 'eventBus', 'config', 'utils'], required: true },
            analyzer: { class: 'ImageAnalyzer', deps: ['resourcePool', 'utils'], required: false },
            imageProcessor: { class: 'ImageProcessor', deps: ['eventBus', 'config', 'compressionEngine', 'analyzer', 'resourcePool'], required: true },
            
            // Monitoring and metrics (RESTORED)
            unifiedPerformanceMonitor: { class: 'UnifiedPerformanceMonitor', deps: ['eventBus'], required: false },
            metricsCollector: { class: 'MetricsCollector', deps: ['eventBus'], required: false },
            
            // UI components (with debug support - debugManager is optional)
            uiManager: { class: 'UIManager', deps: ['eventBus', 'utils', 'debugManager'], required: true }
        };

        // Initialization promise for async coordination
        this.initPromise = null;
        
        // Setup debug helper IMMEDIATELY (before any other operations)
        this.setupDebugHelper();
    }

    /**
     * Setup debug helper that works even if DebugManager fails to load
     */
    setupDebugHelper() {
        this.debug = (message, data = {}) => {
            try {
                const debugManager = this.getComponent('debugManager');
                if (debugManager && typeof debugManager.logEvent === 'function') {
                    debugManager.logEvent('system:manager', { message, ...data }, 'SystemManager');
                } else {
                    // Fallback to console if DebugManager not available
                    console.log(`🔧 SystemManager: ${message}`, data);
                }
            } catch (error) {
                // Ultimate fallback - even if getComponent fails
                console.log(`🔧 SystemManager (fallback): ${message}`, data);
                console.warn('Debug helper error:', error.message);
            }
        };
        
        // Also setup early debug helper as alias
        this.earlyDebug = this.debug;
    }

    /**
     * Initialize the entire system with dependency resolution
     */
    async initialize(options = {}) {
        if (this.state.initialized) {
            return this.getSystemStatus();
        }

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._performInitialization(options);
        return this.initPromise;
    }

    /**
     * Perform the actual initialization with proper dependency ordering
     */
    async _performInitialization(options) {
        try {
            this.debug('Starting system initialization');

            // Phase 1: Initialize core infrastructure and debug system
            await this._initializePhase('core', [
                'config', 'eventBus', 'debugManager'
            ]);

            this.debug('Debug system initialized, continuing with full initialization');

            // Phase 2: Initialize remaining core components
            await this._initializePhase('core-extended', [
                'errorHandler', 'resourcePool', 'utils'
            ]);

            // Phase 3: Initialize system components
            await this._initializePhase('system', [
                'webglManager', 'encoder', 'decoder'
            ]);

            // Phase 4: Initialize processing components
            await this._initializePhase('processing', [
                'compressionEngine', 'analyzer', 'imageProcessor'
            ]);

            // Phase 5: Initialize monitoring and UI
            await this._initializePhase('monitoring', [
                'unifiedPerformanceMonitor',
                'metricsCollector',  // RESTORED
                'uiManager'
            ]);

            // Setup inter-component communication
            this._setupComponentCommunication();

            // Initialize debug UI if available
            this._initializeDebugUI();

            this.state.initialized = true;
            this.debug('System initialization completed successfully');

            return this.getSystemStatus();

        } catch (error) {
            this.debug('System initialization failed', { error: error.message, stack: error.stack });
            await this._handleInitializationError(error);
            throw error;
        }
    }

    /**
     * Initialize debug UI and register global shortcuts
     */
    _initializeDebugUI() {
        const debugManager = this.getComponent('debugManager');
        if (debugManager) {
            // Register global debug manager for console access
            window.debugManager = debugManager;
            
            // Log helpful debug commands
            console.log(`
🐛 Debug Manager Available!

Keyboard Shortcuts:
• Ctrl+Shift+D: Toggle debug UI
• Ctrl+Shift+C: Clear debug data  
• Ctrl+Shift+E: Export debug data

Console Commands:
• window.debugManager.getDebugReport() - Get full debug report
• window.debugManager.exportDebugData() - Export debug data
• window.debugManager.toggleDebugUI() - Toggle debug overlay
• window.systemManager.getSystemStatus() - Get system status
            `);
            
            this.debug('Debug UI initialized with global access');
        }
    }

    /**
     * Initialize a specific phase of components
     */
    async _initializePhase(phaseName, componentNames) {
        this.debug(`Initializing ${phaseName} phase`, { components: componentNames });

        const phaseResults = {
            successful: [],
            failed: [],
            skipped: []
        };

        for (const componentName of componentNames) {
            const componentInfo = this.componentRegistry[componentName];
            if (!componentInfo) {
                this.debug(`Unknown component: ${componentName}`, { phase: phaseName });
                phaseResults.skipped.push(componentName);
                continue;
            }

            try {
                this.debug(`Initializing component: ${componentName}`, { 
                    dependencies: componentInfo.deps,
                    required: componentInfo.required 
                });
                
                await this._initializeComponent(componentName, componentInfo);
                phaseResults.successful.push(componentName);
                
                this.debug(`Component initialized successfully: ${componentName}`);
                
            } catch (error) {
                phaseResults.failed.push({ name: componentName, error: error.message });
                
                if (componentInfo.required) {
                    this.debug(`Required component ${componentName} failed`, { 
                        error: error.message, 
                        stack: error.stack 
                    });
                    throw new Error(`Required component ${componentName} failed to initialize: ${error.message}`);
                } else {
                    this.debug(`Optional component ${componentName} failed`, { 
                        error: error.message 
                    });
                }
            }
        }

        this.debug(`Phase ${phaseName} completed`, phaseResults);
        return phaseResults;
    }

    /**
     * Initialize a single component with dependency injection
     */
    async _initializeComponent(name, componentInfo) {
        // Check if component class exists
        const ComponentClass = window[componentInfo.class];
        if (!ComponentClass) {
            throw new Error(`Component class ${componentInfo.class} not found`);
        }

        // Resolve dependencies
        const deps = [];
        const missingDeps = [];
        
        for (const depName of componentInfo.deps) {
            const dependency = this.state.components.get(depName);
            if (!dependency) {
                const depInfo = this.componentRegistry[depName];
                if (depInfo?.required) {
                    missingDeps.push(depName);
                } else {
                    deps.push(null); // Optional dependency not available
                }
            } else {
                deps.push(dependency);
            }
        }

        if (missingDeps.length > 0) {
            throw new Error(`Required dependencies not available: ${missingDeps.join(', ')}`);
        }

        // Create component instance with error handling
        let instance;
        try {
            if (deps.length === 0) {
                instance = new ComponentClass();
            } else if (deps.length === 1) {
                instance = new ComponentClass(deps[0]);
            } else {
                instance = new ComponentClass(...deps);
            }
        } catch (error) {
            this.debug(`Component constructor failed: ${name}`, { 
                error: error.message, 
                stack: error.stack,
                dependencies: componentInfo.deps 
            });
            throw new Error(`Failed to create ${name}: ${error.message}`);
        }

        // Initialize if component has init method
        if (typeof instance.initialize === 'function') {
            try {
                await instance.initialize();
                this.debug(`Component initialize() method completed: ${name}`);
            } catch (error) {
                this.debug(`Component initialize() method failed: ${name}`, { 
                    error: error.message, 
                    stack: error.stack 
                });
                throw new Error(`Failed to initialize ${name}: ${error.message}`);
            }
        }

        // Store component
        this.state.components.set(name, instance);
        
        // Store in global scope for backward compatibility
        this._registerGlobalComponent(name, instance);

        this.debug(`Component registration completed: ${name}`);
    }

    /**
     * Register component in global scope for backward compatibility
     */
    _registerGlobalComponent(name, instance) {
        const globalMappings = {
            config: 'CONFIG',
            eventBus: 'eventBus',
            debugManager: 'debugManager',
            errorHandler: 'errorHandler',
            resourcePool: 'resourcePool',
            webglManager: 'webGLManager',
            encoder: 'bitStreamEncoder',
            decoder: 'bitStreamDecoder',
            imageProcessor: 'imageProcessor',
            uiManager: 'uiManager',
            metricsCollector: 'metricsCollector'  // RESTORED
        };

        const globalName = globalMappings[name];
        if (globalName) {
            window[globalName] = instance;
            this.debug(`Registered global component: ${globalName}`, { componentName: name });
        }
    }

    /**
     * Setup communication patterns between components
     */
    _setupComponentCommunication() {
        const eventBus = this.getComponent('eventBus');
        const debugManager = this.getComponent('debugManager');
        
        if (!eventBus) return;

        this.debug('Setting up component communication');

        // Setup debug event forwarding
        if (debugManager) {
            // Forward all system events to debug manager
            eventBus.on('system:*', (data, eventType) => {
                debugManager.logEvent(eventType, data, 'system');
            });
            
            // Forward processing events for debugging
            eventBus.on('processing:*', (data, eventType) => {
                debugManager.logProcessingEvent(eventType, data);
            });
            
            // Forward file events for debugging
            eventBus.on('file:*', (data, eventType) => {
                debugManager.logFileEvent(eventType, data);
            });
        }

        // Setup standard event flows
        this._setupProcessingEvents();
        this._setupErrorEvents();
        this._setupPerformanceEvents();
        this._setupUIEvents();
        this._setupDebugEvents();

        this.debug('Component communication setup completed');
    }

    /**
     * Setup debug-related event flows
     */
    _setupDebugEvents() {
        const eventBus = this.getComponent('eventBus');
        const debugManager = this.getComponent('debugManager');
        
        if (debugManager) {
            // Listen for system health events
            eventBus.on('system:health-check', (data) => {
                debugManager.logEvent('system:health-check', data, 'system');
            });
            
            // Listen for component lifecycle events
            eventBus.on('component:*', (data, eventType) => {
                debugManager.logEvent(eventType, data, 'component');
            });
        }
    }

    /**
     * Setup processing-related event flows with debug integration
     */
    _setupProcessingEvents() {
        const eventBus = this.getComponent('eventBus');
        const metricsCollector = this.getComponent('metricsCollector');  // RESTORED
        const performanceMonitor = this.getComponent('unifiedPerformanceMonitor');

        // RESTORED: Forward processing events to metrics
        if (metricsCollector) {
            eventBus.on('processing:started', (data) => {
                this.debug('Forwarding processing:started to metrics', data);
                metricsCollector.startProcessing(data);
            });
            eventBus.on('processing:completed', (data) => {
                this.debug('Forwarding processing:completed to metrics', data);
                metricsCollector.endProcessing(data);
            });
            eventBus.on('processing:cancelled', (data) => {
                this.debug('Forwarding processing:cancelled to metrics', data);
                metricsCollector.cancelProcessing(data.reason);
            });
        }

        if (performanceMonitor) {
            // Monitor performance during processing
            eventBus.on('processing:started', () => {
                this.debug('Processing started - beginning performance monitoring');
                performanceMonitor.startMonitoring();
            });
            
            eventBus.on('processing:completed', () => {
                this.debug('Processing completed - stopping performance monitoring');
                performanceMonitor.stopMonitoring();
            });
        }
    }

    /**
     * Setup error handling event flows with debug integration
     */
    _setupErrorEvents() {
        const eventBus = this.getComponent('eventBus');
        const errorHandler = this.getComponent('errorHandler');
        const debugManager = this.getComponent('debugManager');

        if (errorHandler) {
            eventBus.on('error', (error) => {
                this.debug('Error event received', { error: error.message });
                errorHandler.handleError(error);
            });
            
            eventBus.on('warning', (warning) => {
                this.debug('Warning event received', { warning: warning.message });
                errorHandler.handleWarning(warning);
            });
        }

        if (debugManager) {
            // Forward errors to debug manager
            eventBus.on('error', (error) => {
                debugManager.logError('system-error', error);
            });
        }
    }

    /**
     * Setup performance monitoring event flows
     */
    _setupPerformanceEvents() {
        const eventBus = this.getComponent('eventBus');
        const resourcePool = this.getComponent('resourcePool');

        if (resourcePool) {
            eventBus.on('performance:memory-pressure', (data) => {
                this.debug('Memory pressure detected', { level: data.level });
                resourcePool.optimizeMemory(data.level);
            });
        }
    }

    /**
     * Setup UI update event flows with debug integration
     */
    _setupUIEvents() {
        const eventBus = this.getComponent('eventBus');
        const uiManager = this.getComponent('uiManager');

        if (uiManager) {
            // Forward all relevant events to UI manager (RESTORED)
            eventBus.on('processing:*', (data, eventType) => {
                this.debug(`Forwarding processing event to UI: ${eventType}`, data);
                uiManager.handleProcessingEvent(eventType, data);
            });
            
            eventBus.on('error', (error) => {
                this.debug('Forwarding error to UI', { error: error.message });
                uiManager.showError(error);
            });
            
            eventBus.on('status', (status) => {
                this.debug('Forwarding status to UI', status);
                uiManager.updateStatus(status);
            });
            
            this.debug('UI event forwarding setup completed');
        }
    }

    /**
     * Handle initialization errors with enhanced debugging
     */
    async _handleInitializationError(error) {
        this.debug('Handling initialization error', { 
            error: error.message, 
            stack: error.stack 
        });

        // Try minimal initialization with only required components
        try {
            this.debug('Attempting minimal initialization');
            
            // Clear failed state
            this.state.components.clear();
            
            // Initialize only absolute minimum with debug support
            await this._initializePhase('minimal', ['config', 'eventBus', 'debugManager', 'errorHandler', 'utils']);
            
            // Log the error with available components
            const errorHandler = this.getComponent('errorHandler');
            const debugManager = this.getComponent('debugManager');
            
            if (errorHandler) {
                errorHandler.handleSystemError(error);
            }
            
            if (debugManager) {
                debugManager.logError('system-initialization-failed', {
                    originalError: error.message,
                    stack: error.stack,
                    availableComponents: Array.from(this.state.components.keys())
                });
            }
            
            this.debug('Minimal initialization successful');
            
        } catch (fallbackError) {
            this.debug('Minimal initialization also failed', { 
                fallbackError: fallbackError.message 
            });
            
            // Last resort - setup basic error display
            this._showCriticalError(error, fallbackError);
        }
    }

    /**
     * Show critical error in UI when system fails to initialize
     */
    _showCriticalError(originalError, fallbackError) {
        const errorElement = document.getElementById('scriptError') || document.getElementById('status');
        if (errorElement) {
            errorElement.innerHTML = `
                <strong>❌ Critical System Error</strong><br>
                System initialization failed: ${originalError.message}<br>
                <small>Fallback also failed: ${fallbackError.message}</small><br>
                <br>
                <details style="margin-top: 10px;">
                    <summary style="cursor: pointer; color: #666;">🔍 Debug Information</summary>
                    <div style="margin-top: 10px; font-family: monospace; font-size: 12px; background: #f5f5f5; padding: 10px; border-radius: 4px;">
                        <strong>Original Error:</strong><br>
                        ${originalError.stack || originalError.message}<br><br>
                        <strong>Fallback Error:</strong><br>
                        ${fallbackError.stack || fallbackError.message}<br><br>
                        <strong>Browser:</strong> ${navigator.userAgent}<br>
                        <strong>URL:</strong> ${window.location.href}<br>
                        <strong>Time:</strong> ${new Date().toISOString()}
                    </div>
                </details>
                <br>
                <small>Please refresh the page and try again. If the problem persists, check the browser console for more details.</small>
            `;
            errorElement.style.display = 'block';
            errorElement.style.padding = '15px';
            errorElement.style.backgroundColor = '#ffebee';
            errorElement.style.border = '1px solid #ffcdd2';
            errorElement.style.borderRadius = '4px';
            errorElement.style.margin = '10px';
        }
    }

    /**
     * Get a component instance
     */
    getComponent(name) {
        const component = this.state.components.get(name);
        return component;
    }

    /**
     * Check if a component is available
     */
    hasComponent(name) {
        return this.state.components.has(name);
    }

    /**
     * Get all available components
     */
    getAvailableComponents() {
        return Array.from(this.state.components.keys());
    }

    /**
     * Get system status with enhanced debug information
     */
    getSystemStatus() {
        const status = {
            initialized: this.state.initialized,
            components: this.getAvailableComponents(),
            requiredComponents: Object.keys(this.componentRegistry).filter(
                name => this.componentRegistry[name].required
            ),
            optionalComponents: Object.keys(this.componentRegistry).filter(
                name => !this.componentRegistry[name].required
            ),
            health: this._calculateSystemHealth(),
            debugManager: this.hasComponent('debugManager'),
            timestamp: Date.now()
        };

        // Add debug information if available
        const debugManager = this.getComponent('debugManager');
        if (debugManager) {
            status.debugInfo = {
                eventsLogged: debugManager.debugData.events.length,
                errorsLogged: debugManager.debugData.errors.length,
                fileInteractions: debugManager.debugData.fileSelections.length
            };
        }

        return status;
    }

    /**
     * Calculate overall system health
     */
    _calculateSystemHealth() {
        if (!this.state.initialized) return 'initializing';

        const requiredComponents = Object.keys(this.componentRegistry)
            .filter(name => this.componentRegistry[name].required);
        
        const availableRequired = requiredComponents.filter(name => 
            this.state.components.has(name)
        );

        if (availableRequired.length === requiredComponents.length) {
            return 'healthy';
        } else if (availableRequired.length >= requiredComponents.length * 0.8) {
            return 'degraded';
        } else {
            return 'critical';
        }
    }

    /**
     * Get debug report for troubleshooting
     */
    getDebugReport() {
        const debugManager = this.getComponent('debugManager');
        const systemStatus = this.getSystemStatus();
        
        const report = {
            systemStatus,
            timestamp: new Date().toISOString(),
            browser: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                online: navigator.onLine
            },
            page: {
                url: window.location.href,
                referrer: document.referrer,
                readyState: document.readyState
            },
            performance: {
                memory: performance.memory ? {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit
                } : null,
                timing: performance.timing ? {
                    domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
                    load: performance.timing.loadEventEnd - performance.timing.navigationStart
                } : null
            }
        };

        if (debugManager) {
            report.debugData = debugManager.getDebugReport();
        }

        return report;
    }

    /**
     * Gracefully shutdown all components
     */
    async shutdown() {
        this.debug('Starting system shutdown');

        // Shutdown in reverse dependency order
        const shutdownOrder = [
            'uiManager', 'unifiedPerformanceMonitor', 'metricsCollector',  // RESTORED
            'imageProcessor', 'analyzer', 'compressionEngine', 'decoder', 'encoder',
            'webglManager', 'resourcePool', 'errorHandler', 'debugManager', 'eventBus'
        ];

        for (const componentName of shutdownOrder) {
            const component = this.state.components.get(componentName);
            if (component && typeof component.cleanup === 'function') {
                try {
                    await component.cleanup();
                    this.debug(`Component shut down: ${componentName}`);
                } catch (error) {
                    this.debug(`Error shutting down ${componentName}`, { error: error.message });
                }
            }
        }

        // Clear all state
        this.state.components.clear();
        this.state.initialized = false;
        this.initPromise = null;

        // Clear global instance
        window.systemManagerInstance = null;
        
        // Clear global debug manager
        if (window.debugManager) {
            delete window.debugManager;
        }

        this.debug('System shutdown completed');
    }

    /**
     * Restart the system
     */
    async restart(options = {}) {
        this.debug('Restarting system');
        await this.shutdown();
        return this.initialize(options);
    }

    /**
     * Static method to get or create system manager
     */
    static getInstance() {
        if (!window.systemManagerInstance) {
            window.systemManagerInstance = new SystemManager();
        }
        return window.systemManagerInstance;
    }
};

// Register global system manager for console access
window.systemManager = window.SystemManager.getInstance();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.systemManagerInstance) {
        window.systemManagerInstance.shutdown();
    }
});