/**
 * DebugManager.js
 * 
 * Comprehensive debugging and event reporting system for troubleshooting UI issues.
 * Tracks all events, component states, user interactions, and system health.
 */
window.DebugManager = class DebugManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.isEnabled = true; // Set to false in production
        
        // Debug data collection
        this.debugData = {
            events: [],
            interactions: [],
            errors: [],
            componentStates: new Map(),
            systemHealth: [],
            fileSelections: [],
            processingAttempts: []
        };
        
        // Configuration
        this.config = {
            maxEventHistory: 500,
            maxInteractionHistory: 100,
            maxErrorHistory: 50,
            logToConsole: true,
            logToUI: true,
            trackMouseMovement: false, // Can be CPU intensive
            trackKeystrokes: true,
            trackClicks: true,
            trackFileOperations: true
        };
        
        // UI elements for debug display
        this.debugUI = null;
        this.isUIVisible = false;
        
        // Initialize debugging
        this.initialize();
        
        console.log('🐛 DebugManager initialized - Press Ctrl+Shift+D to toggle debug UI');
    }

    /**
     * Initialize debugging system
     */
    initialize() {
        this.setupEventTracking();
        this.setupInteractionTracking();
        this.setupErrorTracking();
        this.setupComponentTracking();
        this.setupKeyboardShortcuts();
        this.createDebugUI();
        
        // Track system initialization
        this.logEvent('debug:manager-initialized', {
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            location: window.location.href
        });
    }

    /**
     * Setup comprehensive event tracking
     */
    setupEventTracking() {
        // Track all events passing through the event bus
        const originalEmit = this.eventBus.emit.bind(this.eventBus);
        this.eventBus.emit = async (eventType, data, options) => {
            this.logEvent(eventType, data, 'eventbus');
            return originalEmit(eventType, data, options);
        };

        // Track specific file-related events with extra detail
        this.eventBus.on('file:*', (data, eventType) => {
            this.logFileEvent(eventType, data);
        });

        // Track processing events
        this.eventBus.on('processing:*', (data, eventType) => {
            this.logProcessingEvent(eventType, data);
        });

        // Track UI events
        this.eventBus.on('ui:*', (data, eventType) => {
            this.logUIEvent(eventType, data);
        });

        // Track system events
        this.eventBus.on('system:*', (data, eventType) => {
            this.logSystemEvent(eventType, data);
        });
    }

    /**
     * Setup user interaction tracking
     */
    setupInteractionTracking() {
        // Track file input interactions
        this.trackFileInputs();
        
        // Track button clicks
        this.trackButtonClicks();
        
        // Track drop zone interactions
        this.trackDropZone();
        
        // Track general DOM interactions
        if (this.config.trackClicks) {
            document.addEventListener('click', (e) => {
                this.logInteraction('click', {
                    target: this.getElementInfo(e.target),
                    coordinates: { x: e.clientX, y: e.clientY },
                    timestamp: Date.now()
                });
            });
        }

        if (this.config.trackKeystrokes) {
            document.addEventListener('keydown', (e) => {
                this.logInteraction('keydown', {
                    key: e.key,
                    code: e.code,
                    ctrlKey: e.ctrlKey,
                    shiftKey: e.shiftKey,
                    altKey: e.altKey,
                    timestamp: Date.now()
                });
            });
        }
    }

    /**
     * Track file input elements specifically
     */
    trackFileInputs() {
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            // Track all file input events
            ['change', 'input', 'click', 'focus', 'blur'].forEach(eventType => {
                fileInput.addEventListener(eventType, (e) => {
                    this.logFileInteraction(eventType, {
                        files: e.target.files ? Array.from(e.target.files).map(f => ({
                            name: f.name,
                            size: f.size,
                            type: f.type,
                            lastModified: f.lastModified
                        })) : [],
                        value: e.target.value,
                        timestamp: Date.now()
                    });
                });
            });

            // Add custom tracking
            const originalClick = fileInput.click.bind(fileInput);
            fileInput.click = () => {
                this.logFileInteraction('programmatic-click', {
                    stackTrace: new Error().stack,
                    timestamp: Date.now()
                });
                return originalClick();
            };
        } else {
            this.logError('file-input-not-found', 'File input element not found in DOM');
        }
    }

    /**
     * Track button interactions
     */
    trackButtonClicks() {
        const selectButton = document.getElementById('selectButton');
        const cancelButton = document.getElementById('cancelButton');
        const copyButton = document.getElementById('copyButton');
        const openButton = document.getElementById('openButton');

        [selectButton, cancelButton, copyButton, openButton].forEach((button, index) => {
            const buttonNames = ['selectButton', 'cancelButton', 'copyButton', 'openButton'];
            if (button) {
                button.addEventListener('click', (e) => {
                    this.logInteraction('button-click', {
                        buttonName: buttonNames[index],
                        buttonText: button.textContent,
                        disabled: button.disabled,
                        timestamp: Date.now(),
                        stackTrace: new Error().stack
                    });
                });
            }
        });
    }

    /**
     * Track drop zone interactions
     */
    trackDropZone() {
        const dropZone = document.getElementById('dropZone');
        if (dropZone) {
            ['click', 'dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventType => {
                dropZone.addEventListener(eventType, (e) => {
                    this.logInteraction('dropzone-' + eventType, {
                        files: e.dataTransfer ? Array.from(e.dataTransfer.files || []).map(f => ({
                            name: f.name,
                            size: f.size,
                            type: f.type
                        })) : [],
                        target: this.getElementInfo(e.target),
                        timestamp: Date.now()
                    });
                });
            });
        }
    }

    /**
     * Setup error tracking
     */
    setupErrorTracking() {
        // Global error handler
        const originalErrorHandler = window.addEventListener('error', (event) => {
            this.logError('global-error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error ? {
                    name: event.error.name,
                    message: event.error.message,
                    stack: event.error.stack
                } : null,
                timestamp: Date.now()
            });
        });

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('unhandled-promise-rejection', {
                reason: event.reason,
                promise: event.promise,
                timestamp: Date.now()
            });
        });

        // Console error interception
        const originalConsoleError = console.error;
        console.error = (...args) => {
            this.logError('console-error', {
                arguments: args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ),
                stackTrace: new Error().stack,
                timestamp: Date.now()
            });
            return originalConsoleError.apply(console, args);
        };
    }

    /**
     * Setup component state tracking
     */
    setupComponentTracking() {
        // Monitor SystemManager
        this.trackComponent('SystemManager', window.SystemManager?.getInstance());
        
        // Set up periodic component health checks
        setInterval(() => {
            this.checkComponentHealth();
        }, 5000); // Every 5 seconds
    }

    /**
     * Setup keyboard shortcuts for debugging
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+D to toggle debug UI
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                this.toggleDebugUI();
            }
            
            // Ctrl+Shift+C to clear debug data
            if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                e.preventDefault();
                this.clearDebugData();
            }
            
            // Ctrl+Shift+E to export debug data
            if (e.ctrlKey && e.shiftKey && e.key === 'E') {
                e.preventDefault();
                this.exportDebugData();
            }
        });
    }

    /**
     * Log an event with detailed information
     */
    logEvent(eventType, data, source = 'unknown') {
        const eventEntry = {
            id: this.generateId(),
            eventType,
            data: this.sanitizeData(data),
            source,
            timestamp: Date.now(),
            stackTrace: new Error().stack
        };

        this.debugData.events.push(eventEntry);
        this.trimArray(this.debugData.events, this.config.maxEventHistory);

        if (this.config.logToConsole) {
            console.log(`🎯 Event: ${eventType}`, eventEntry);
        }

        this.updateDebugUI();
    }

    /**
     * Log file-related events with extra detail
     */
    logFileEvent(eventType, data) {
        const fileEntry = {
            id: this.generateId(),
            eventType,
            data: this.sanitizeData(data),
            fileInfo: data?.file ? {
                name: data.file.name,
                size: data.file.size,
                type: data.file.type,
                lastModified: data.file.lastModified
            } : null,
            timestamp: Date.now(),
            stackTrace: new Error().stack
        };

        this.debugData.fileSelections.push(fileEntry);
        
        if (this.config.logToConsole) {
            console.log(`📁 File Event: ${eventType}`, fileEntry);
        }

        this.updateDebugUI();
    }

    /**
     * Log processing events
     */
    logProcessingEvent(eventType, data) {
        const processingEntry = {
            id: this.generateId(),
            eventType,
            data: this.sanitizeData(data),
            timestamp: Date.now(),
            memoryUsage: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            } : null
        };

        this.debugData.processingAttempts.push(processingEntry);
        
        if (this.config.logToConsole) {
            console.log(`⚙️ Processing: ${eventType}`, processingEntry);
        }

        this.updateDebugUI();
    }

    /**
     * Log UI events
     */
    logUIEvent(eventType, data) {
        if (this.config.logToConsole) {
            console.log(`🖥️ UI Event: ${eventType}`, data);
        }
    }

    /**
     * Log system events
     */
    logSystemEvent(eventType, data) {
        if (this.config.logToConsole) {
            console.log(`🖥️ System Event: ${eventType}`, data);
        }
    }

    /**
     * Log user interactions
     */
    logInteraction(interactionType, data) {
        const interaction = {
            id: this.generateId(),
            type: interactionType,
            data: this.sanitizeData(data),
            timestamp: Date.now(),
            url: window.location.href
        };

        this.debugData.interactions.push(interaction);
        this.trimArray(this.debugData.interactions, this.config.maxInteractionHistory);

        if (this.config.logToConsole && !interactionType.includes('mouse')) {
            console.log(`👆 Interaction: ${interactionType}`, interaction);
        }

        this.updateDebugUI();
    }

    /**
     * Log file input interactions specifically
     */
    logFileInteraction(interactionType, data) {
        const interaction = {
            id: this.generateId(),
            type: 'file-' + interactionType,
            data: this.sanitizeData(data),
            timestamp: Date.now()
        };

        this.debugData.fileSelections.push(interaction);

        if (this.config.logToConsole) {
            console.log(`📁 File Interaction: ${interactionType}`, interaction);
        }

        this.updateDebugUI();
    }

    /**
     * Log errors with context
     */
    logError(errorType, data) {
        const error = {
            id: this.generateId(),
            type: errorType,
            data: this.sanitizeData(data),
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            componentStates: this.getCurrentComponentStates()
        };

        this.debugData.errors.push(error);
        this.trimArray(this.debugData.errors, this.config.maxErrorHistory);

        if (this.config.logToConsole) {
            console.error(`❌ Error: ${errorType}`, error);
        }

        this.updateDebugUI();
    }

    /**
     * Track component state
     */
    trackComponent(name, component) {
        if (!component) return;

        const state = {
            name,
            available: !!component,
            methods: Object.getOwnPropertyNames(Object.getPrototypeOf(component))
                .filter(name => typeof component[name] === 'function'),
            properties: Object.keys(component),
            timestamp: Date.now()
        };

        this.debugData.componentStates.set(name, state);
    }

    /**
     * Check component health periodically
     */
    checkComponentHealth() {
        const systemManager = window.SystemManager?.getInstance();
        if (systemManager) {
            const status = systemManager.getSystemStatus();
            
            const healthEntry = {
                timestamp: Date.now(),
                systemStatus: status,
                availableComponents: systemManager.getAvailableComponents(),
                globalObjects: {
                    CONFIG: !!window.CONFIG,
                    eventBus: !!window.eventBus,
                    imageProcessor: !!window.imageProcessor,
                    uiManager: !!window.uiManager
                }
            };

            this.debugData.systemHealth.push(healthEntry);
            
            // Keep only last 10 health checks
            if (this.debugData.systemHealth.length > 10) {
                this.debugData.systemHealth.shift();
            }

            // Log warnings if components are missing
            if (status.health !== 'healthy') {
                this.logError('system-health-degraded', healthEntry);
            }
        } else {
            this.logError('system-manager-not-available', {
                timestamp: Date.now(),
                windowSystemManager: typeof window.SystemManager
            });
        }
    }

    /**
     * Create debug UI overlay
     */
    createDebugUI() {
        if (!this.isEnabled) return;

        const debugUI = document.createElement('div');
        debugUI.id = 'debug-overlay';
        debugUI.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 400px;
            max-height: 80vh;
            background: rgba(0, 0, 0, 0.9);
            color: #00ff00;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            padding: 15px;
            border-radius: 8px;
            z-index: 10000;
            overflow-y: auto;
            display: none;
            border: 2px solid #00ff00;
        `;

        debugUI.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #00ff00; padding-bottom: 5px;">
                <h3 style="margin: 0; color: #00ff00;">🐛 Debug Console</h3>
                <div>
                    <button onclick="window.debugManager.clearDebugData()" style="background: #333; color: #00ff00; border: 1px solid #00ff00; padding: 2px 8px; margin-right: 5px; cursor: pointer;">Clear</button>
                    <button onclick="window.debugManager.exportDebugData()" style="background: #333; color: #00ff00; border: 1px solid #00ff00; padding: 2px 8px; margin-right: 5px; cursor: pointer;">Export</button>
                    <button onclick="window.debugManager.toggleDebugUI()" style="background: #333; color: #00ff00; border: 1px solid #00ff00; padding: 2px 8px; cursor: pointer;">×</button>
                </div>
            </div>
            <div id="debug-content">
                <div id="debug-summary">Loading...</div>
                <div id="debug-recent-events" style="margin-top: 10px;">
                    <h4 style="color: #ffff00; margin: 5px 0;">Recent Events (last 10):</h4>
                    <div id="debug-events-list"></div>
                </div>
                <div id="debug-file-interactions" style="margin-top: 10px;">
                    <h4 style="color: #ffff00; margin: 5px 0;">File Interactions:</h4>
                    <div id="debug-file-list"></div>
                </div>
                <div id="debug-errors" style="margin-top: 10px;">
                    <h4 style="color: #ff6666; margin: 5px 0;">Errors:</h4>
                    <div id="debug-error-list"></div>
                </div>
            </div>
        `;

        document.body.appendChild(debugUI);
        this.debugUI = debugUI;

        // Add floating debug indicator
        const indicator = document.createElement('div');
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #ff6600;
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            z-index: 9999;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        indicator.textContent = '🐛 DEBUG';
        indicator.onclick = () => this.toggleDebugUI();
        document.body.appendChild(indicator);

        this.updateDebugUI();
    }

    /**
     * Toggle debug UI visibility
     */
    toggleDebugUI() {
        if (!this.debugUI) return;
        
        this.isUIVisible = !this.isUIVisible;
        this.debugUI.style.display = this.isUIVisible ? 'block' : 'none';
        
        if (this.isUIVisible) {
            this.updateDebugUI();
        }
    }

    /**
     * Update debug UI with current data
     */
    updateDebugUI() {
        if (!this.debugUI || !this.isUIVisible) return;

        // Update summary
        const summaryElement = document.getElementById('debug-summary');
        if (summaryElement) {
            summaryElement.innerHTML = `
                <div><strong>Events:</strong> ${this.debugData.events.length}</div>
                <div><strong>File Interactions:</strong> ${this.debugData.fileSelections.length}</div>
                <div><strong>Errors:</strong> ${this.debugData.errors.length}</div>
                <div><strong>System Health:</strong> ${this.getCurrentSystemHealth()}</div>
            `;
        }

        // Update recent events
        const eventsElement = document.getElementById('debug-events-list');
        if (eventsElement) {
            const recentEvents = this.debugData.events.slice(-10);
            eventsElement.innerHTML = recentEvents.map(event => `
                <div style="margin: 2px 0; padding: 2px; border-left: 2px solid #00ff00; padding-left: 5px;">
                    <span style="color: #ffff00;">${event.eventType}</span>
                    <span style="color: #888; font-size: 10px;">(${new Date(event.timestamp).toLocaleTimeString()})</span>
                </div>
            `).join('');
        }

        // Update file interactions
        const fileElement = document.getElementById('debug-file-list');
        if (fileElement) {
            const recentFiles = this.debugData.fileSelections.slice(-5);
            fileElement.innerHTML = recentFiles.map(file => `
                <div style="margin: 2px 0; padding: 2px; border-left: 2px solid #66ff66; padding-left: 5px;">
                    <span style="color: #66ff66;">${file.type}</span>
                    ${file.data?.files ? `<span style="color: #white;"> - ${file.data.files.length} file(s)</span>` : ''}
                    <span style="color: #888; font-size: 10px;">(${new Date(file.timestamp).toLocaleTimeString()})</span>
                </div>
            `).join('');
        }

        // Update errors
        const errorElement = document.getElementById('debug-error-list');
        if (errorElement) {
            const recentErrors = this.debugData.errors.slice(-5);
            errorElement.innerHTML = recentErrors.map(error => `
                <div style="margin: 2px 0; padding: 2px; border-left: 2px solid #ff6666; padding-left: 5px;">
                    <span style="color: #ff6666;">${error.type}</span>
                    <span style="color: #888; font-size: 10px;">(${new Date(error.timestamp).toLocaleTimeString()})</span>
                </div>
            `).join('');
        }
    }

    /**
     * Get current system health
     */
    getCurrentSystemHealth() {
        const latest = this.debugData.systemHealth[this.debugData.systemHealth.length - 1];
        return latest?.systemStatus?.health || 'unknown';
    }

    /**
     * Get current component states
     */
    getCurrentComponentStates() {
        const states = {};
        for (const [name, state] of this.debugData.componentStates) {
            states[name] = {
                available: state.available,
                methodCount: state.methods?.length || 0,
                propertyCount: state.properties?.length || 0
            };
        }
        return states;
    }

    /**
     * Clear all debug data
     */
    clearDebugData() {
        this.debugData = {
            events: [],
            interactions: [],
            errors: [],
            componentStates: new Map(),
            systemHealth: [],
            fileSelections: [],
            processingAttempts: []
        };
        
        console.log('🗑️ Debug data cleared');
        this.updateDebugUI();
    }

    /**
     * Export debug data for analysis
     */
    exportDebugData() {
        const exportData = {
            metadata: {
                exportedAt: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href,
                timestamp: Date.now()
            },
            debugData: {
                ...this.debugData,
                componentStates: Object.fromEntries(this.debugData.componentStates)
            }
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug-export-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('📤 Debug data exported');
    }

    /**
     * Get element information for logging
     */
    getElementInfo(element) {
        if (!element) return null;
        
        return {
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            textContent: element.textContent?.substring(0, 50),
            value: element.value,
            type: element.type,
            disabled: element.disabled
        };
    }

    /**
     * Sanitize data for logging (remove circular references, etc.)
     */
    sanitizeData(data) {
        if (!data) return data;
        
        try {
            return JSON.parse(JSON.stringify(data));
        } catch (e) {
            return { _sanitized: 'Failed to serialize', error: e.message };
        }
    }

    /**
     * Trim array to max length
     */
    trimArray(array, maxLength) {
        while (array.length > maxLength) {
            array.shift();
        }
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get debug report for troubleshooting
     */
    getDebugReport() {
        return {
            summary: {
                totalEvents: this.debugData.events.length,
                totalFileInteractions: this.debugData.fileSelections.length,
                totalErrors: this.debugData.errors.length,
                systemHealth: this.getCurrentSystemHealth(),
                lastActivity: Math.max(
                    ...this.debugData.events.map(e => e.timestamp),
                    ...this.debugData.fileSelections.map(f => f.timestamp),
                    0
                )
            },
            recentEvents: this.debugData.events.slice(-20),
            fileInteractions: this.debugData.fileSelections,
            errors: this.debugData.errors,
            componentStates: Object.fromEntries(this.debugData.componentStates),
            systemHealth: this.debugData.systemHealth
        };
    }

    /**
     * Cleanup debug manager
     */
    cleanup() {
        if (this.debugUI) {
            this.debugUI.remove();
        }
        this.clearDebugData();
        console.log('🐛 DebugManager cleaned up');
    }
};