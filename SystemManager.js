/**
 * SystemManager.js
 * * Central coordination system that manages all components and their interactions.
 * Eliminates circular dependencies and provides unified lifecycle management.
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
            config: null
        };

        // Component registry with dependency information
        this.componentRegistry = {
            // Core infrastructure (no dependencies)
            config: { class: 'ConfigValidator', deps: [], required: true },
            eventBus: { class: 'EventBus', deps: [], required: true },
            errorHandler: { class: 'ErrorHandler', deps: ['eventBus'], required: true },
            resourcePool: { class: 'ResourcePool', deps: ['eventBus'], required: true },
            
            // Utilities (minimal dependencies)
            utils: { class: 'SharedUtils', deps: [], required: true },
            webglManager: { class: 'WebGLManager', deps: ['resourcePool'], required: false },
            
            // Processing components
            encoder: { class: 'GPUBitStreamEncoder', deps: ['config', 'webglManager'], required: true },
            decoder: { class: 'GPUBitStreamDecoder', deps: ['config', 'webglManager'], required: false },
            compressionEngine: { class: 'CompressionEngine', deps: ['encoder', 'eventBus', 'config', 'utils'], required: true },
            analyzer: { class: 'ImageAnalyzer', deps: ['webglManager', 'utils'], required: false },
            
            // Monitoring and metrics
            unifiedPerformanceMonitor: { class: 'UnifiedPerformanceMonitor', deps: ['eventBus'], required: false },
            
            // UI components
            uiManager: { class: 'UIManager', deps: ['eventBus', 'utils'], required: true }
        };

        // Initialization promise for async coordination
        this.initPromise = null;
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
            console.log('🚀 SystemManager: Starting system initialization...');

            // Phase 1: Initialize core infrastructure
            await this._initializePhase('core', [
                'config', 'eventBus', 'errorHandler', 'resourcePool', 'utils'
            ]);

            // Phase 2: Initialize system components
            await this._initializePhase('system', [
                'webglManager', 'encoder', 'decoder'
            ]);

            // Phase 3: Initialize processing components
            await this._initializePhase('processing', [
                'compressionEngine', 'analyzer'
            ]);

            // Phase 4: Initialize monitoring and UI
            await this._initializePhase('monitoring', [
                'unifiedPerformanceMonitor',
                'uiManager'
            ]);

            // Setup inter-component communication
            this._setupComponentCommunication();

            this.state.initialized = true;
            console.log('✅ SystemManager: Initialization completed successfully');

            return this.getSystemStatus();

        } catch (error) {
            console.error('❌ SystemManager: Initialization failed:', error);
            await this._handleInitializationError(error);
            throw error;
        }
    }

    /**
     * Initialize a specific phase of components
     */
    async _initializePhase(phaseName, componentNames) {
        console.log(`📦 SystemManager: Initializing ${phaseName} phase...`);

        for (const componentName of componentNames) {
            const componentInfo = this.componentRegistry[componentName];
            if (!componentInfo) {
                console.warn(`Unknown component: ${componentName}`);
                continue;
            }

            try {
                await this._initializeComponent(componentName, componentInfo);
            } catch (error) {
                if (componentInfo.required) {
                    throw new Error(`Required component ${componentName} failed to initialize: ${error.message}`);
                } else {
                    console.warn(`Optional component ${componentName} failed to initialize:`, error);
                }
            }
        }

        console.log(`✅ SystemManager: ${phaseName} phase completed`);
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
        for (const depName of componentInfo.deps) {
            const dependency = this.state.components.get(depName);
            if (!dependency) {
                if (this.componentRegistry[depName]?.required) {
                    throw new Error(`Required dependency ${depName} not available for ${name}`);
                }
                deps.push(null); // Optional dependency not available
            } else {
                deps.push(dependency);
            }
        }

        // Create component instance
        let instance;
        if (deps.length === 0) {
            instance = new ComponentClass();
        } else if (deps.length === 1) {
            instance = new ComponentClass(deps[0]);
        } else {
            instance = new ComponentClass(...deps);
        }

        // Initialize if component has init method
        if (typeof instance.initialize === 'function') {
            await instance.initialize();
        }

        // Store component
        this.state.components.set(name, instance);
        
        // Store in global scope for backward compatibility
        this._registerGlobalComponent(name, instance);

        console.log(`✅ Component initialized: ${name}`);
    }

    /**
     * Register component in global scope for backward compatibility
     */
    _registerGlobalComponent(name, instance) {
        const globalMappings = {
            config: 'CONFIG',
            eventBus: 'eventBus',
            errorHandler: 'errorHandler',
            resourcePool: 'resourcePool',
            webglManager: 'webGLManager',
            encoder: 'bitStreamEncoder',
            decoder: 'bitStreamDecoder',
            uiManager: 'uiManager',
            metricsCollector: 'metricsCollector'
        };

        const globalName = globalMappings[name];
        if (globalName) {
            window[globalName] = instance;
        }
    }

    /**
     * Setup communication patterns between components
     */
    _setupComponentCommunication() {
        const eventBus = this.getComponent('eventBus');
        if (!eventBus) return;

        // Setup standard event flows
        this._setupProcessingEvents();
        this._setupErrorEvents();
        this._setupPerformanceEvents();
        this._setupUIEvents();
    }

    /**
     * Setup processing-related event flows
     */
    _setupProcessingEvents() {
        const eventBus = this.getComponent('eventBus');
        const metricsCollector = this.getComponent('metricsCollector');
        const performanceMonitor = this.getComponent('performanceMonitor');

        if (metricsCollector) {
            // Forward processing events to metrics
            eventBus.on('processing:started', (data) => metricsCollector.startProcessing(data));
            eventBus.on('processing:completed', (data) => metricsCollector.endProcessing(data));
            eventBus.on('processing:cancelled', (data) => metricsCollector.cancelProcessing(data.reason));
        }

        if (performanceMonitor) {
            // Monitor performance during processing
            eventBus.on('processing:started', () => performanceMonitor.startContinuousMonitoring());
            eventBus.on('processing:completed', () => performanceMonitor.stopMonitoring());
        }
    }

    /**
     * Setup error handling event flows
     */
    _setupErrorEvents() {
        const eventBus = this.getComponent('eventBus');
        const errorHandler = this.getComponent('errorHandler');

        if (errorHandler) {
            eventBus.on('error', (error) => errorHandler.handleError(error));
            eventBus.on('warning', (warning) => errorHandler.handleWarning(warning));
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
                resourcePool.optimizeMemory(data.level);
            });
        }
    }

    /**
     * Setup UI update event flows
     */
    _setupUIEvents() {
        const eventBus = this.getComponent('eventBus');
        const uiManager = this.getComponent('uiManager');

        if (uiManager) {
            // Forward all relevant events to UI manager
            eventBus.on('processing:*', (data, eventType) => {
                uiManager.handleProcessingEvent(eventType, data);
            });
            eventBus.on('error', (error) => uiManager.showError(error));
            eventBus.on('status', (status) => uiManager.updateStatus(status));
        }
    }

    /**
     * Handle initialization errors with fallback strategies
     */
    async _handleInitializationError(error) {
        console.error('SystemManager initialization error:', error);

        // Try minimal initialization with only required components
        try {
            console.log('Attempting minimal initialization...');
            
            // Clear failed state
            this.state.components.clear();
            
            // Initialize only absolute minimum
            await this._initializePhase('minimal', ['config', 'eventBus', 'errorHandler', 'utils']);
            
            // Emit error to error handler
            const errorHandler = this.getComponent('errorHandler');
            if (errorHandler) {
                errorHandler.handleSystemError(error);
            }
            
        } catch (fallbackError) {
            console.error('Even minimal initialization failed:', fallbackError);
            
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
                <small>Please refresh the page and try again.</small>
            `;
            errorElement.style.display = 'block';
        }
    }

    /**
     * Get a component instance
     */
    getComponent(name) {
        return this.state.components.get(name);
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
     * Get system status
     */
    getSystemStatus() {
        return {
            initialized: this.state.initialized,
            components: this.getAvailableComponents(),
            requiredComponents: Object.keys(this.componentRegistry).filter(
                name => this.componentRegistry[name].required
            ),
            optionalComponents: Object.keys(this.componentRegistry).filter(
                name => !this.componentRegistry[name].required
            ),
            health: this._calculateSystemHealth()
        };
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
     * Gracefully shutdown all components
     */
    async shutdown() {
        console.log('🔄 SystemManager: Starting system shutdown...');

        // Shutdown in reverse dependency order
        const shutdownOrder = [
            'visualizer', 'uiManager', 'metricsCollector', 'performanceMonitor',
            'analyzer', 'compressionEngine', 'decoder', 'encoder',
            'webglManager', 'resourcePool', 'errorHandler', 'eventBus'
        ];

        for (const componentName of shutdownOrder) {
            const component = this.state.components.get(componentName);
            if (component && typeof component.cleanup === 'function') {
                try {
                    await component.cleanup();
                    console.log(`✅ Component shut down: ${componentName}`);
                } catch (error) {
                    console.error(`Error shutting down ${componentName}:`, error);
                }
            }
        }

        // Clear all state
        this.state.components.clear();
        this.state.initialized = false;
        this.initPromise = null;

        // Clear global instance
        window.systemManagerInstance = null;

        console.log('✅ SystemManager: Shutdown completed');
    }

    /**
     * Restart the system
     */
    async restart(options = {}) {
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

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
    const systemManager = SystemManager.getInstance();
    try {
        await systemManager.initialize();
        console.log('🎯 SystemManager: Ready for user interaction');
    } catch (error) {
        console.error('🚨 SystemManager: Failed to initialize on DOM ready:', error);
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.systemManagerInstance) {
        window.systemManagerInstance.shutdown();
    }
});
