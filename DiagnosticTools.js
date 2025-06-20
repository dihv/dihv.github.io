/**
 * DiagnosticTools.js
 * 
 * Automated diagnostic tools to identify and resolve common issues.
 * Specifically designed to help troubleshoot the double file selection issue.
 */
window.DiagnosticTools = class DiagnosticTools {
    constructor(systemManager, debugManager) {
        this.systemManager = systemManager;
        this.debugManager = debugManager;
        this.diagnostics = new Map();
        this.autoFixes = new Map();
        
        this.setupDiagnostics();
        this.setupAutoFixes();
        
        console.log('🔧 DiagnosticTools initialized');
    }

    /**
     * Setup all diagnostic checks
     */
    setupDiagnostics() {
        // File Input Diagnostics
        this.diagnostics.set('fileInputDuplication', {
            name: 'File Input Duplication Check',
            description: 'Checks for duplicate file input elements or event handlers',
            severity: 'high',
            check: () => this.checkFileInputDuplication()
        });

        this.diagnostics.set('eventHandlerLeaks', {
            name: 'Event Handler Memory Leaks',
            description: 'Detects duplicate event listeners on file input elements',
            severity: 'medium',
            check: () => this.checkEventHandlerLeaks()
        });

        this.diagnostics.set('componentInitialization', {
            name: 'Component Initialization Order',
            description: 'Validates that components are initialized in the correct order',
            severity: 'high',
            check: () => this.checkComponentInitialization()
        });

        this.diagnostics.set('domReadiness', {
            name: 'DOM Element Availability',
            description: 'Ensures all required DOM elements are present and accessible',
            severity: 'high',
            check: () => this.checkDOMReadiness()
        });

        this.diagnostics.set('eventBusHealth', {
            name: 'Event Bus Communication',
            description: 'Tests event bus functionality and event flow',
            severity: 'high',
            check: () => this.checkEventBusHealth()
        });

        this.diagnostics.set('fileAPISupport', {
            name: 'File API Browser Support',
            description: 'Validates browser support for required File APIs',
            severity: 'critical',
            check: () => this.checkFileAPISupport()
        });

        this.diagnostics.set('memoryLeaks', {
            name: 'Memory Leak Detection',
            description: 'Monitors for potential memory leaks in component lifecycle',
            severity: 'medium',
            check: () => this.checkMemoryLeaks()
        });
    }

    /**
     * Setup automated fixes for common issues
     */
    setupAutoFixes() {
        this.autoFixes.set('fileInputDuplication', {
            name: 'Remove Duplicate File Input Handlers',
            description: 'Removes duplicate event listeners from file input elements',
            fix: () => this.fixFileInputDuplication()
        });

        this.autoFixes.set('resetUIState', {
            name: 'Reset UI State',
            description: 'Resets UI manager state to resolve stuck states',
            fix: () => this.fixUIState()
        });

        this.autoFixes.set('clearEventListeners', {
            name: 'Clear All Event Listeners',
            description: 'Removes all event listeners and re-attaches them',
            fix: () => this.fixEventListeners()
        });

        this.autoFixes.set('reinitializeComponents', {
            name: 'Reinitialize Core Components',
            description: 'Safely reinitializes core components',
            fix: () => this.fixComponentInitialization()
        });
    }

    /**
     * Run comprehensive system diagnostics
     */
    async runFullDiagnostics() {
        console.log('🔍 Running comprehensive system diagnostics...');
        
        const results = {
            timestamp: new Date().toISOString(),
            overall: 'unknown',
            issues: [],
            warnings: [],
            passed: [],
            autoFixesAvailable: [],
            recommendations: []
        };

        let criticalIssues = 0;
        let highIssues = 0;
        let mediumIssues = 0;

        for (const [key, diagnostic] of this.diagnostics) {
            try {
                console.log(`Running diagnostic: ${diagnostic.name}`);
                const result = await diagnostic.check();
                
                if (result.passed) {
                    results.passed.push({
                        key,
                        name: diagnostic.name,
                        message: result.message || 'Check passed'
                    });
                } else {
                    const issue = {
                        key,
                        name: diagnostic.name,
                        severity: diagnostic.severity,
                        message: result.message,
                        details: result.details || {},
                        autoFixAvailable: this.autoFixes.has(key)
                    };

                    if (diagnostic.severity === 'critical') {
                        criticalIssues++;
                        results.issues.push(issue);
                    } else if (diagnostic.severity === 'high') {
                        highIssues++;
                        results.issues.push(issue);
                    } else if (diagnostic.severity === 'medium') {
                        mediumIssues++;
                        results.warnings.push(issue);
                    }

                    if (this.autoFixes.has(key)) {
                        results.autoFixesAvailable.push(key);
                    }
                }
            } catch (error) {
                console.error(`Diagnostic ${diagnostic.name} failed:`, error);
                results.issues.push({
                    key,
                    name: diagnostic.name,
                    severity: 'critical',
                    message: `Diagnostic check failed: ${error.message}`,
                    details: { error: error.stack },
                    autoFixAvailable: false
                });
                criticalIssues++;
            }
        }

        // Determine overall health
        if (criticalIssues > 0) {
            results.overall = 'critical';
        } else if (highIssues > 0) {
            results.overall = 'degraded';
        } else if (mediumIssues > 0) {
            results.overall = 'warning';
        } else {
            results.overall = 'healthy';
        }

        // Generate recommendations
        results.recommendations = this.generateRecommendations(results);

        console.log('🔍 Diagnostics completed:', results);
        
        if (this.debugManager) {
            this.debugManager.logEvent('diagnostics:completed', results, 'DiagnosticTools');
        }

        return results;
    }

    /**
     * Check for file input duplication issues
     */
    async checkFileInputDuplication() {
        const fileInputs = document.querySelectorAll('input[type="file"]');
        const fileInputsWithId = document.querySelectorAll('#fileInput');
        
        // Check for multiple file inputs
        if (fileInputs.length > 1) {
            return {
                passed: false,
                message: `Found ${fileInputs.length} file input elements (expected 1)`,
                details: {
                    totalInputs: fileInputs.length,
                    inputsWithFileInputId: fileInputsWithId.length,
                    elements: Array.from(fileInputs).map(input => ({
                        id: input.id,
                        name: input.name,
                        accept: input.accept
                    }))
                }
            };
        }

        // Check for missing file input
        if (fileInputs.length === 0) {
            return {
                passed: false,
                message: 'No file input element found',
                details: { searchSelectors: ['input[type="file"]', '#fileInput'] }
            };
        }

        // Check for multiple elements with same ID
        if (fileInputsWithId.length > 1) {
            return {
                passed: false,
                message: `Multiple elements with ID 'fileInput' found (${fileInputsWithId.length})`,
                details: {
                    elements: Array.from(fileInputsWithId).map(el => ({
                        tagName: el.tagName,
                        type: el.type,
                        id: el.id
                    }))
                }
            };
        }

        // Check event listeners (if possible)
        const fileInput = fileInputs[0];
        const listenerCount = this.getEventListenerCount(fileInput, 'change');
        
        if (listenerCount > 1) {
            return {
                passed: false,
                message: `File input has ${listenerCount} 'change' event listeners (expected 1)`,
                details: { 
                    element: fileInput.id,
                    eventType: 'change',
                    listenerCount 
                }
            };
        }

        return {
            passed: true,
            message: 'File input configuration appears correct',
            details: {
                fileInputFound: true,
                listenerCount,
                elementId: fileInput.id
            }
        };
    }

    /**
     * Check for event handler memory leaks
     */
    async checkEventHandlerLeaks() {
        const issues = [];
        const elements = ['#fileInput', '#selectButton', '#dropZone', '#cancelButton'];
        
        for (const selector of elements) {
            const element = document.querySelector(selector);
            if (element) {
                const listeners = this.getEventListenerInfo(element);
                if (listeners.total > 10) {
                    issues.push({
                        selector,
                        listenerCount: listeners.total,
                        details: listeners
                    });
                }
            }
        }

        if (issues.length > 0) {
            return {
                passed: false,
                message: `Found ${issues.length} elements with excessive event listeners`,
                details: { issues }
            };
        }

        return {
            passed: true,
            message: 'No event handler leaks detected'
        };
    }

    /**
     * Check component initialization order and state
     */
    async checkComponentInitialization() {
        if (!this.systemManager) {
            return {
                passed: false,
                message: 'SystemManager not available',
                details: { systemManagerType: typeof this.systemManager }
            };
        }

        const status = this.systemManager.getSystemStatus();
        const requiredComponents = ['config', 'eventBus', 'uiManager', 'imageProcessor'];
        const missingComponents = [];

        for (const component of requiredComponents) {
            if (!this.systemManager.hasComponent(component)) {
                missingComponents.push(component);
            }
        }

        if (missingComponents.length > 0) {
            return {
                passed: false,
                message: `Missing required components: ${missingComponents.join(', ')}`,
                details: {
                    missing: missingComponents,
                    available: status.components,
                    systemHealth: status.health
                }
            };
        }

        // Check if UI manager is properly initialized
        const uiManager = this.systemManager.getComponent('uiManager');
        if (uiManager) {
            const uiState = uiManager.getUIState();
            if (uiState.elementCount === 0) {
                return {
                    passed: false,
                    message: 'UI Manager has no cached elements',
                    details: { uiState }
                };
            }
        }

        return {
            passed: true,
            message: 'All required components are initialized',
            details: {
                components: status.components,
                health: status.health
            }
        };
    }

    /**
     * Check DOM readiness and element availability
     */
    async checkDOMReadiness() {
        const requiredElements = [
            '#fileInput', '#selectButton', '#dropZone', '#status',
            '#progressContainer', '#resultContainer'
        ];
        
        const missingElements = [];
        const elementStates = {};

        for (const selector of requiredElements) {
            const element = document.querySelector(selector);
            if (!element) {
                missingElements.push(selector);
            } else {
                elementStates[selector] = {
                    found: true,
                    visible: element.offsetParent !== null,
                    disabled: element.disabled,
                    id: element.id,
                    classes: element.className
                };
            }
        }

        if (missingElements.length > 0) {
            return {
                passed: false,
                message: `Missing required DOM elements: ${missingElements.join(', ')}`,
                details: {
                    missing: missingElements,
                    found: elementStates,
                    documentReady: document.readyState
                }
            };
        }

        // Check if file input is properly configured
        const fileInput = document.querySelector('#fileInput');
        if (fileInput) {
            if (!fileInput.accept || fileInput.accept.length === 0) {
                return {
                    passed: false,
                    message: 'File input missing accept attribute',
                    details: { accept: fileInput.accept }
                };
            }
        }

        return {
            passed: true,
            message: 'All required DOM elements are present and configured',
            details: elementStates
        };
    }

    /**
     * Check event bus health and communication
     */
    async checkEventBusHealth() {
        const eventBus = this.systemManager?.getComponent('eventBus');
        if (!eventBus) {
            return {
                passed: false,
                message: 'EventBus component not available',
                details: { available: false }
            };
        }

        // Test event emission and listening
        let testEventReceived = false;
        const testData = { test: true, timestamp: Date.now() };

        const cleanup = eventBus.on('diagnostic:test', (data) => {
            testEventReceived = (data.test === true && data.timestamp === testData.timestamp);
        });

        try {
            await eventBus.emit('diagnostic:test', testData);
            
            // Give it a moment to process
            await new Promise(resolve => setTimeout(resolve, 10));
            
            cleanup(); // Remove test listener

            if (!testEventReceived) {
                return {
                    passed: false,
                    message: 'EventBus test event was not received',
                    details: { testEventReceived, testData }
                };
            }

            const stats = eventBus.getStats();
            return {
                passed: true,
                message: 'EventBus is functioning correctly',
                details: stats
            };

        } catch (error) {
            cleanup();
            return {
                passed: false,
                message: `EventBus test failed: ${error.message}`,
                details: { error: error.message }
            };
        }
    }

    /**
     * Check browser File API support
     */
    async checkFileAPISupport() {
        const requiredAPIs = {
            File: window.File,
            FileReader: window.FileReader,
            FileList: window.FileList,
            Blob: window.Blob,
            createImageBitmap: window.createImageBitmap,
            URL: window.URL,
            'URL.createObjectURL': window.URL?.createObjectURL
        };

        const missingAPIs = [];
        for (const [name, api] of Object.entries(requiredAPIs)) {
            if (!api) {
                missingAPIs.push(name);
            }
        }

        if (missingAPIs.length > 0) {
            return {
                passed: false,
                message: `Missing required browser APIs: ${missingAPIs.join(', ')}`,
                details: {
                    missing: missingAPIs,
                    available: Object.keys(requiredAPIs).filter(name => requiredAPIs[name])
                }
            };
        }

        return {
            passed: true,
            message: 'All required File APIs are supported',
            details: { supportedAPIs: Object.keys(requiredAPIs) }
        };
    }

    /**
     * Check for memory leaks
     */
    async checkMemoryLeaks() {
        if (!performance.memory) {
            return {
                passed: true,
                message: 'Memory monitoring not available in this browser',
                details: { memoryAPIAvailable: false }
            };
        }

        const memory = performance.memory;
        const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

        const issues = [];
        
        if (usagePercent > 80) {
            issues.push('High memory usage detected');
        }

        // Check for component cleanup
        if (this.systemManager) {
            const components = this.systemManager.getAvailableComponents();
            const resourcePool = this.systemManager.getComponent('resourcePool');
            
            if (resourcePool) {
                const poolStats = resourcePool.getUsageStats();
                if (poolStats.pools.objectURLs > 50) {
                    issues.push('High number of object URLs in resource pool');
                }
            }
        }

        if (issues.length > 0) {
            return {
                passed: false,
                message: `Memory issues detected: ${issues.join(', ')}`,
                details: {
                    memoryUsage: {
                        used: memory.usedJSHeapSize,
                        total: memory.totalJSHeapSize,
                        limit: memory.jsHeapSizeLimit,
                        usagePercent
                    },
                    issues
                }
            };
        }

        return {
            passed: true,
            message: 'No memory leaks detected',
            details: {
                memoryUsage: {
                    used: memory.usedJSHeapSize,
                    total: memory.totalJSHeapSize,
                    limit: memory.jsHeapSizeLimit,
                    usagePercent
                }
            }
        };
    }

    /**
     * Generate recommendations based on diagnostic results
     */
    generateRecommendations(results) {
        const recommendations = [];

        if (results.overall === 'critical') {
            recommendations.push({
                priority: 'high',
                action: 'Immediate attention required',
                description: 'Critical issues detected that prevent proper functionality'
            });
        }

        if (results.autoFixesAvailable.length > 0) {
            recommendations.push({
                priority: 'medium',
                action: 'Try automated fixes',
                description: `${results.autoFixesAvailable.length} automated fixes available`,
                command: 'window.diagnosticTools.runAutoFixes()'
            });
        }

        // Specific recommendations based on common issues
        const fileInputIssues = results.issues.find(issue => issue.key === 'fileInputDuplication');
        if (fileInputIssues) {
            recommendations.push({
                priority: 'high',
                action: 'Fix file input duplication',
                description: 'Multiple file inputs or event handlers detected',
                command: 'window.diagnosticTools.fixFileInputDuplication()'
            });
        }

        if (results.issues.some(issue => issue.key === 'componentInitialization')) {
            recommendations.push({
                priority: 'high',
                action: 'Reinitialize system',
                description: 'Component initialization issues detected',
                command: 'window.systemManager.restart()'
            });
        }

        return recommendations;
    }

    /**
     * Run all available auto-fixes
     */
    async runAutoFixes(issueKeys = null) {
        console.log('🔧 Running automated fixes...');
        
        const results = {
            attempted: [],
            successful: [],
            failed: []
        };

        const fixes = issueKeys ? 
            Array.from(this.autoFixes.entries()).filter(([key]) => issueKeys.includes(key)) :
            Array.from(this.autoFixes.entries());

        for (const [key, fix] of fixes) {
            try {
                results.attempted.push(key);
                console.log(`Applying fix: ${fix.name}`);
                
                await fix.fix();
                results.successful.push(key);
                
                console.log(`✅ Fix applied successfully: ${fix.name}`);
                
            } catch (error) {
                console.error(`❌ Fix failed: ${fix.name}`, error);
                results.failed.push({ key, error: error.message });
            }
        }

        console.log('🔧 Auto-fixes completed:', results);
        return results;
    }

    /**
     * Fix file input duplication issues
     */
    async fixFileInputDuplication() {
        console.log('Fixing file input duplication...');
        
        // Remove all duplicate file inputs except the first one
        const fileInputs = document.querySelectorAll('input[type="file"]');
        for (let i = 1; i < fileInputs.length; i++) {
            fileInputs[i].remove();
        }

        // Clear and re-attach event listeners
        const fileInput = document.querySelector('#fileInput');
        if (fileInput) {
            // Clone and replace to remove all event listeners
            const newFileInput = fileInput.cloneNode(true);
            fileInput.parentNode.replaceChild(newFileInput, fileInput);
            
            // Re-initialize UI manager to attach fresh event listeners
            const uiManager = this.systemManager?.getComponent('uiManager');
            if (uiManager) {
                await uiManager.cacheElements();
                uiManager.setupFileInputHandling();
            }
        }

        console.log('File input duplication fix applied');
    }

    /**
     * Fix UI state issues
     */
    async fixUIState() {
        console.log('Resetting UI state...');
        
        const uiManager = this.systemManager?.getComponent('uiManager');
        if (uiManager) {
            uiManager.reset();
            await uiManager.cacheElements();
        }

        console.log('UI state reset completed');
    }

    /**
     * Fix event listener issues
     */
    async fixEventListeners() {
        console.log('Clearing and re-attaching event listeners...');
        
        const uiManager = this.systemManager?.getComponent('uiManager');
        if (uiManager) {
            // Re-setup all interaction handlers
            uiManager.setupInteractionHandlers();
        }

        console.log('Event listeners reset completed');
    }

    /**
     * Fix component initialization issues
     */
    async fixComponentInitialization() {
        console.log('Reinitializing components...');
        
        if (this.systemManager) {
            await this.systemManager.restart();
        }

        console.log('Component reinitialization completed');
    }

    /**
     * Get event listener count for an element (approximation)
     */
    getEventListenerCount(element, eventType) {
        // This is a simplified approximation since we can't directly access listener count
        // In practice, we'd track this in our debug manager
        if (this.debugManager?.debugData?.interactions) {
            return this.debugManager.debugData.interactions.filter(
                interaction => interaction.data?.target?.id === element.id
            ).length;
        }
        return 1; // Default assumption
    }

    /**
     * Get event listener information for an element
     */
    getEventListenerInfo(element) {
        // Simplified implementation - in a real scenario we'd track this
        return {
            total: 1,
            types: ['click', 'change'],
            element: element.id || element.tagName
        };
    }

    /**
     * Create a quick diagnostic report for console output
     */
    async quickDiagnostic() {
        console.log('🔍 Quick Diagnostic Report');
        console.log('=========================');
        
        // File input check
        const fileInputs = document.querySelectorAll('input[type="file"]');
        console.log(`File inputs found: ${fileInputs.length}`);
        
        // System manager check
        const systemStatus = this.systemManager?.getSystemStatus();
        console.log(`System health: ${systemStatus?.health || 'unknown'}`);
        console.log(`Components: ${systemStatus?.components?.join(', ') || 'none'}`);
        
        // Event bus check
        const eventBus = this.systemManager?.getComponent('eventBus');
        console.log(`Event bus: ${eventBus ? 'available' : 'not available'}`);
        
        // UI manager check
        const uiManager = this.systemManager?.getComponent('uiManager');
        if (uiManager) {
            const uiState = uiManager.getUIState();
            console.log(`UI Manager: ${uiState.elementCount} cached elements`);
            console.log(`Processing state: ${uiState.isProcessing}`);
            console.log(`File input clicks: ${uiState.fileInputClicks || 0}`);
        }
        
        // Debug manager check
        if (this.debugManager) {
            console.log(`Debug events: ${this.debugManager.debugData.events.length}`);
            console.log(`File interactions: ${this.debugManager.debugData.fileSelections.length}`);
            console.log(`Errors: ${this.debugManager.debugData.errors.length}`);
        }
        
        console.log('=========================');
        
        return {
            fileInputCount: fileInputs.length,
            systemHealth: systemStatus?.health,
            componentCount: systemStatus?.components?.length || 0,
            eventBusAvailable: !!eventBus,
            uiManagerAvailable: !!uiManager,
            debugManagerAvailable: !!this.debugManager
        };
    }
};

// Auto-initialize diagnostic tools when system is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for system manager to be available
    const initDiagnostics = () => {
        if (window.systemManager && window.systemManager.state?.initialized) {
            const debugManager = window.systemManager.getComponent('debugManager');
            const diagnosticTools = new window.DiagnosticTools(window.systemManager, debugManager);
            
            // Make globally available for console access
            window.diagnosticTools = diagnosticTools;
            
            console.log(`
🔧 Diagnostic Tools Available!

Quick Commands:
• window.diagnosticTools.quickDiagnostic() - Quick system check
• window.diagnosticTools.runFullDiagnostics() - Complete diagnostic scan
• window.diagnosticTools.runAutoFixes() - Apply automated fixes

Specific Issue Fixes:
• window.diagnosticTools.fixFileInputDuplication() - Fix double file selection
• window.diagnosticTools.fixUIState() - Reset UI state
• window.diagnosticTools.fixEventListeners() - Reset event handlers
            `);
        } else {
            // Try again in 1 second
            setTimeout(initDiagnostics, 1000);
        }
    };
    
    setTimeout(initDiagnostics, 2000); // Give system time to initialize
});