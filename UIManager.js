/**
 * UIManager.js
 * Consolidated UI management system with comprehensive debugging and event reporting.
 * This enhanced version tracks all UI interactions, state changes, and potential issues.
 */
window.UIManager = class UIManager {
    constructor(eventBus, utils, debugManager = null) {
        this.eventBus = eventBus;
        this.utils = utils;
        this.debugManager = debugManager;
        
        // DOM element cache
        this.elements = new Map();
        
        // UI state
        this.state = {
            currentStatus: null,
            isProcessing: false,
            progressValue: 0,
            lastUpdate: 0,
            currentTheme: 'light',
            fileInputClicks: 0,
            lastFileSelection: null,
            elementCacheTime: 0
        };
        
        // Update throttling
        this.updateThrottle = 100; // ms
        this.throttledUpdates = new Map();
        
        // Status timeouts
        this.statusTimeouts = new Map();
        
        // Debug logging helper
        this.debug = (message, data = {}) => {
            if (this.debugManager) {
                this.debugManager.logEvent('ui:debug', { message, ...data }, 'UIManager');
            }
            console.log(`🖥️ UIManager: ${message}`, data);
        };
        
        // Initialize UI
        this.initialize();
        
        console.log('UIManager initialized with debug logging');
    }

    /**
     * Initialize UI manager with enhanced debugging
     */
    async initialize() {
        this.debug('Starting UI initialization');
        
        try {
            await this.cacheElements();
            this.setupEventListeners();
            this.setupGlobalHandlers();
            this.initializeTheme();
            this.startPeriodicHealthCheck();
            
            this.debug('UI initialization completed successfully', {
                cachedElements: this.elements.size,
                state: this.state
            });
            
            // Show ready state
            this.updateStatus('System ready', 'success', '', { timeout: 3000 });
            
        } catch (error) {
            this.debug('UI initialization failed', { error: error.message, stack: error.stack });
            throw error;
        }
    }

    /**
     * Cache DOM elements with enhanced error checking
     */
    async cacheElements() {
        this.debug('Starting element caching');
        
        const elementSelectors = {
            // Core UI elements
            status: '#status',
            progressBar: '#progressBar',
            progressText: '#progressText',
            progressContainer: '#progressContainer',
            
            // Upload elements
            dropZone: '#dropZone',
            fileInput: '#fileInput',
            preview: '#preview',
            selectButton: '#selectButton',
            
            // Results elements
            resultContainer: '#resultContainer',
            resultUrl: '#resultUrl',
            
            // Statistics elements
            imageStats: '#imageStats',
            originalSize: '#originalSize',
            processedSize: '#processedSize',
            originalFormat: '#originalFormat',
            finalFormat: '#finalFormat',
            compressionRatio: '#compressionRatio',
            elapsedTime: '#elapsedTime',
            attempts: '#attempts',
            
            // Control elements
            cancelButton: '#cancelButton',
            copyButton: '#copyButton',
            openButton: '#openButton',
            
            // Error elements
            scriptError: '#scriptError'
        };
        
        const foundElements = [];
        const missingElements = [];
        
        for (const [name, selector] of Object.entries(elementSelectors)) {
            const element = document.querySelector(selector);
            if (element) {
                this.elements.set(name, element);
                foundElements.push(name);
                
                // Add debug attributes
                element.setAttribute('data-ui-element', name);
                element.setAttribute('data-cached-at', Date.now());
            } else {
                missingElements.push({ name, selector });
            }
        }
        
        this.state.elementCacheTime = Date.now();
        
        this.debug('Element caching completed', {
            found: foundElements.length,
            missing: missingElements.length,
            foundElements,
            missingElements
        });
        
        if (missingElements.length > 0) {
            console.warn('UIManager: Missing DOM elements:', missingElements);
        }
        
        return { found: foundElements, missing: missingElements };
    }

    /**
     * Setup event listeners with enhanced debugging
     */
    setupEventListeners() {
        this.debug('Setting up event listeners');
        
        // Listen to processing events
        this.eventBus.on('processing:*', (data, eventType) => {
            this.debug(`Processing event received: ${eventType}`, data);
            this.handleProcessingEvent(eventType, data);
        });
        
        // Listen to error events
        this.eventBus.on('error', (error) => {
            this.debug('Error event received', { error });
            this.showError(error);
        });
        
        this.eventBus.on('warning', (warning) => {
            this.debug('Warning event received', { warning });
            this.showWarning(warning);
        });
        
        // Listen to status events
        this.eventBus.on('ui:show-error', (data) => {
            this.debug('UI show error event', data);
            this.showError(data);
        });
        
        this.eventBus.on('ui:show-warning', (data) => {
            this.debug('UI show warning event', data);
            this.showWarning(data);
        });
        
        this.eventBus.on('ui:show-status', (data) => {
            this.debug('UI show status event', data);
            this.updateStatus(data.message, data.type, data.details);
        });
        
        // Listen to metrics events
        this.eventBus.on('metrics:*', (data, eventType) => {
            this.debug(`Metrics event received: ${eventType}`, data);
            this.handleMetricsEvent(eventType, data);
        });

        this.eventBus.on('ui:update-preview', (data) => {
            this.debug('Update preview event', data);
            const previewElement = this.getElement('preview');
            if (previewElement && data.url) {
                previewElement.src = data.url;
                previewElement.style.display = 'block';
            } else {
                this.debug('Preview update failed', { 
                    previewElement: !!previewElement, 
                    url: !!data.url 
                });
            }
        });
        
        // Setup UI interaction handlers
        this.setupInteractionHandlers();
        
        this.debug('Event listeners setup completed');
    }

    /**
     * Setup interaction handlers with enhanced debugging
     */
    setupInteractionHandlers() {
        this.debug('Setting up interaction handlers');
        
        // Cancel button
        const cancelButton = this.getElement('cancelButton');
        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                this.debug('Cancel button clicked');
                this.eventBus.emit('processing:cancel', { reason: 'User cancelled' });
            });
        }
        
        // Copy button
        const copyButton = this.getElement('copyButton');
        if (copyButton) {
            copyButton.addEventListener('click', () => {
                this.debug('Copy button clicked');
                this.copyResultURL();
            });
        }
        
        // Open button
        const openButton = this.getElement('openButton');
        if (openButton) {
            openButton.addEventListener('click', () => {
                this.debug('Open button clicked');
                this.openResultURL();
            });
        }
        
        // File input with enhanced debugging
        this.setupFileInputHandling();
        
        // Drop zone with enhanced debugging
        this.setupDropZoneHandling();

        // Select button with enhanced debugging
        this.setupSelectButtonHandling();
        
        this.debug('Interaction handlers setup completed');
    }

    /**
     * Setup file input handling with comprehensive debugging
     */
    setupFileInputHandling() {
        const fileInput = this.getElement('fileInput');
        if (!fileInput) {
            this.debug('File input element not found!', { 
                allElements: Array.from(this.elements.keys()),
                domElements: Array.from(document.querySelectorAll('input[type="file"]')).map(el => el.id)
            });
            return;
        }

        this.debug('Setting up file input handling', {
            elementId: fileInput.id,
            elementType: fileInput.type,
            accept: fileInput.accept
        });

        // Track all file input events
        ['change', 'input', 'click', 'focus', 'blur', 'mousedown', 'mouseup'].forEach(eventType => {
            fileInput.addEventListener(eventType, (e) => {
                this.debug(`File input ${eventType} event`, {
                    files: e.target.files ? Array.from(e.target.files).map(f => ({
                        name: f.name,
                        size: f.size,
                        type: f.type,
                        lastModified: f.lastModified
                    })) : [],
                    value: e.target.value,
                    eventDetails: {
                        bubbles: e.bubbles,
                        cancelable: e.cancelable,
                        isTrusted: e.isTrusted
                    }
                });
            });
        });

        // Main change event handler with debugging
        fileInput.addEventListener('change', (e) => {
            this.state.fileInputClicks++;
            
            this.debug('File input change event triggered', {
                fileCount: e.target.files.length,
                clickCount: this.state.fileInputClicks,
                isProcessing: this.state.isProcessing,
                lastSelection: this.state.lastFileSelection
            });
            
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                this.state.lastFileSelection = {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    timestamp: Date.now()
                };
                
                this.debug('Emitting file:selected event', {
                    file: this.state.lastFileSelection,
                    eventBusAvailable: !!this.eventBus
                });
                
                try {
                    this.eventBus.emit('file:selected', { file: e.target.files[0] });
                    this.debug('file:selected event emitted successfully');
                } catch (error) {
                    this.debug('Failed to emit file:selected event', {
                        error: error.message,
                        stack: error.stack
                    });
                }
            } else {
                this.debug('No files selected in change event');
            }
        });

        // Monitor programmatic clicks
        const originalClick = fileInput.click.bind(fileInput);
        fileInput.click = () => {
            this.debug('Programmatic file input click', {
                stackTrace: new Error().stack,
                isProcessing: this.state.isProcessing
            });
            return originalClick();
        };
    }

    /**
     * Setup drop zone handling with enhanced debugging
     */
    setupDropZoneHandling() {
        const dropZone = this.getElement('dropZone');
        if (!dropZone) {
            this.debug('Drop zone element not found!');
            return;
        }

        this.debug('Setting up drop zone handling', {
            elementId: dropZone.id,
            elementClass: dropZone.className
        });

        // Drop zone click handler with debugging
        dropZone.addEventListener('click', (e) => {
            this.debug('Drop zone clicked', {
                target: e.target.tagName + (e.target.id ? '#' + e.target.id : ''),
                targetClass: e.target.className,
                isProcessing: this.state.isProcessing,
                coordinates: { x: e.clientX, y: e.clientY }
            });
            
            const selectButton = this.getElement('selectButton');
            
            // Check if click came from select button
            if (selectButton && selectButton.contains(e.target)) {
                this.debug('Click came from select button, ignoring dropzone handler');
                return;
            }
            
            if (this.state.isProcessing) {
                this.debug('Processing in progress, ignoring dropzone click');
                return;
            }
            
            const fileInput = this.getElement('fileInput');
            if (fileInput) {
                this.debug('Triggering file input click from dropzone');
                fileInput.click();
            } else {
                this.debug('File input not available for dropzone click');
            }
        });

        // Drag and drop event handlers
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                this.debug(`Drop zone ${eventName} event`, {
                    files: e.dataTransfer?.files ? Array.from(e.dataTransfer.files).map(f => ({
                        name: f.name,
                        size: f.size,
                        type: f.type
                    })) : null
                });
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-active');
                this.debug('Drop zone activated');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-active');
                this.debug('Drop zone deactivated');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.debug('Files dropped', {
                fileCount: files.length,
                files: Array.from(files).map(f => ({
                    name: f.name,
                    size: f.size,
                    type: f.type
                }))
            });
            
            if (files.length > 0) {
                try {
                    this.eventBus.emit('file:dropped', { file: files[0] });
                    this.debug('file:dropped event emitted successfully');
                } catch (error) {
                    this.debug('Failed to emit file:dropped event', {
                        error: error.message,
                        stack: error.stack
                    });
                }
            }
        });
        
        // Keyboard accessibility
        dropZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.debug('Keyboard activation of dropzone', { key: e.key });
                const fileInput = this.getElement('fileInput');
                if (fileInput) fileInput.click();
            }
        });
    }

    /**
     * Setup select button handling with enhanced debugging
     */
    setupSelectButtonHandling() {
        const selectButton = this.getElement('selectButton');
        if (!selectButton) {
            this.debug('Select button element not found!');
            return;
        }

        this.debug('Setting up select button handling', {
            elementId: selectButton.id,
            elementText: selectButton.textContent
        });

        selectButton.addEventListener('click', (e) => {
            this.debug('Select button clicked', {
                isProcessing: this.state.isProcessing,
                disabled: selectButton.disabled,
                eventDetails: {
                    bubbles: e.bubbles,
                    cancelable: e.cancelable,
                    isTrusted: e.isTrusted
                }
            });
            
            if (this.state.isProcessing) {
                this.debug('Processing in progress, ignoring select button click');
                return;
            }
            
            // Prevent dropZone click handler from firing
            e.stopPropagation();
            
            const fileInput = this.getElement('fileInput');
            if (fileInput) {
                this.debug('Triggering file input click from select button');
                fileInput.click();
            } else {
                this.debug('File input not available for select button click');
            }
        });
    }

    /**
     * Start periodic health check
     */
    startPeriodicHealthCheck() {
        setInterval(() => {
            this.performHealthCheck();
        }, 10000); // Every 10 seconds
    }

    /**
     * Perform UI health check
     */
    performHealthCheck() {
        const health = {
            timestamp: Date.now(),
            elementsCount: this.elements.size,
            missingElements: [],
            state: { ...this.state },
            domReady: document.readyState,
            eventBusAvailable: !!this.eventBus,
            debugManagerAvailable: !!this.debugManager
        };

        // Check if critical elements are still in DOM
        const criticalElements = ['fileInput', 'dropZone', 'selectButton', 'status'];
        for (const elementName of criticalElements) {
            const element = this.getElement(elementName);
            if (!element || !document.contains(element)) {
                health.missingElements.push(elementName);
            }
        }

        if (health.missingElements.length > 0) {
            this.debug('UI health check failed - missing critical elements', health);
        }

        return health;
    }

    // ... (Keep all other existing methods from the original UIManager.js)
    
    /**
     * Handle processing events with enhanced debugging
     */
    handleProcessingEvent(eventType, data) {
        this.debug(`Handling processing event: ${eventType}`, data);
        
        switch (eventType) {
            case 'processing:started':
                this.handleProcessingStarted(data);
                break;
                
            case 'processing:completed':
                this.handleProcessingCompleted(data);
                break;
                
            case 'processing:cancelled':
                this.handleProcessingCancelled(data);
                break;
                
            case 'processing:progress':
                this.updateProgress(data.progress);
                break;
                
            case 'processing:stage-changed':
                this.updateStatus(data.message, 'processing', data.details);
                break;
        }
    }

    /**
     * Handle processing started with debugging
     */
    handleProcessingStarted(data) {
        this.debug('Processing started', data);
        this.state.isProcessing = true;
        this.updateProgress(0);
        this.showProcessingElements();
        this.updateStatus('Processing started...', 'processing');
    }

    /**
     * Handle processing completed with debugging
     */
    handleProcessingCompleted(data) {
        this.debug('Processing completed', data);
        this.state.isProcessing = false;
        this.updateProgress(100);
        this.hideProcessingElements();
        
        const message = data.message || 'Processing completed successfully';
        this.updateStatus(message, 'success', '', { timeout: 5000 });
        
        // Show results if available
        if (data.resultURL) {
            this.showResult(data.resultURL);
        }
    }

    /**
     * Enhanced error display with debugging context
     */
    showError(error) {
        const errorDetails = {
            message: typeof error === 'string' ? error : error.message || 'An unknown error occurred',
            details: error.details || error.stack || '',
            timestamp: Date.now(),
            uiState: { ...this.state }
        };
        
        this.debug('Showing error', errorDetails);
        
        this.updateStatus(errorDetails.message, 'error', errorDetails.details);
        
        // Also update script error element for critical errors
        if (error.severity === 'critical' || error.type === 'system') {
            const scriptError = this.getElement('scriptError');
            if (scriptError) {
                scriptError.innerHTML = `
                    <strong>⚠️ ${error.title || 'Critical Error'}</strong><br>
                    ${errorDetails.message}<br>
                    ${errorDetails.details ? `<small>${errorDetails.details}</small>` : ''}
                `;
                scriptError.style.display = 'block';
            }
        }
    }

    /**
     * Get debug information about UI state
     */
    getDebugInfo() {
        return {
            state: { ...this.state },
            elements: Array.from(this.elements.keys()),
            healthCheck: this.performHealthCheck(),
            lastFileSelection: this.state.lastFileSelection,
            fileInputClicks: this.state.fileInputClicks
        };
    }

    handleMetricsEvent(eventType, data) {
        switch (eventType) {
            case 'metrics:original-image':
                this.updateOriginalImageStats(data);
                break;
                
            case 'metrics:processed-image':
                this.updateProcessedImageStats(data);
                break;
                
            case 'metrics:compression-attempt':
                this.updateCompressionStats(data);
                break;
                
            case 'metrics:final-stats':
                this.updateAllStats(data);
                break;
        }
    }

    /**
     * Update status display
     * @param {string} message - Status message
     * @param {string} type - Status type (processing, success, error, warning, info)
     * @param {string} details - Optional details
     * @param {Object} options - Additional options
     */
    updateStatus(message, type = 'info', details = '', options = {}) {
        const statusElement = this.getElement('status');
        if (!statusElement) return;
        
        // Clear existing timeout
        const existingTimeout = this.statusTimeouts.get('status');
        if (existingTimeout) {
            clearTimeout(existingTimeout);
            this.statusTimeouts.delete('status');
        }
        
        // Update status
        const statusText = details ? `${message}\n${details}` : message;
        statusElement.textContent = statusText;
        statusElement.className = `status ${type}`;
        statusElement.style.display = 'block';
        
        // Auto-hide with timeout
        if (options.timeout) {
            const timeoutId = setTimeout(() => {
                if (statusElement.classList.contains(type)) {
                    statusElement.style.display = 'none';
                }
                this.statusTimeouts.delete('status');
            }, options.timeout);
            
            this.statusTimeouts.set('status', timeoutId);
        }
        
        // Update state
        this.state.currentStatus = { message, type, details, timestamp: Date.now() };
        
        // Emit status change event
        this.eventBus.emit('ui:status-changed', this.state.currentStatus);
    }

    /**
     * Update progress display
     * @param {number} progress - Progress value (0-100)
     * @param {string} text - Optional progress text
     */
    updateProgress(progress, text = null) {
        const clampedProgress = Math.max(0, Math.min(100, progress));
        
        // Throttle progress updates
        const now = Date.now();
        if (now - this.state.lastUpdate < this.updateThrottle && clampedProgress < 100) {
            return;
        }
        this.state.lastUpdate = now;
        
        // Update progress bar
        const progressBar = this.getElement('progressBar');
        if (progressBar) {
            progressBar.style.width = `${clampedProgress}%`;
            progressBar.setAttribute('aria-valuenow', clampedProgress);
        }
        
        // Update progress text
        const progressText = this.getElement('progressText');
        if (progressText) {
            const displayText = text || `${Math.round(clampedProgress)}%`;
            progressText.textContent = displayText;
        }
        
        // Show/hide progress container
        const progressContainer = this.getElement('progressContainer');
        if (progressContainer) {
            progressContainer.style.display = this.state.isProcessing ? 'block' : 'none';
        }
        
        this.state.progressValue = clampedProgress;
    }

    showProcessingElements() {
        const progressContainer = this.getElement('progressContainer');
        if (progressContainer) {
            progressContainer.style.display = 'block';
        }
    }

    hideProcessingElements() {
        const progressContainer = this.getElement('progressContainer');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
    }

    showResult(url) {
        const resultContainer = this.getElement('resultContainer');
        const resultUrl = this.getElement('resultUrl');
        
        if (resultUrl) {
            resultUrl.textContent = url;
        }
        
        if (resultContainer) {
            resultContainer.style.display = 'block';
        }
        
        // Update browser history
        try {
            window.history.pushState({}, '', url);
        } catch (error) {
            console.warn('Failed to update browser history:', error);
        }
    }

    showWarning(warning) {
        const message = typeof warning === 'string' ? warning : 
                       warning.message || 'Warning';
        
        this.updateStatus(message, 'warning', warning.details || '', { timeout: 5000 });
    }

    updateOriginalImageStats(data) {
        this.updateStatElement('originalSize', this.utils.formatBytes(data.size || 0));
        this.updateStatElement('originalFormat', this.utils.formatImageFormat(data.format || ''));
        this.showImageStats();
    }

    updateProcessedImageStats(data) {
        this.updateStatElement('processedSize', this.utils.formatBytes(data.size || 0));
        this.updateStatElement('finalFormat', this.utils.formatImageFormat(data.format || ''));
        this.updateCompressionRatio();
    }

    updateCompressionStats(data) {
        this.updateStatElement('attempts', (data.totalAttempts || 0).toString());
        
        if (data.elapsedTime) {
            this.updateStatElement('elapsedTime', this.utils.formatTime(data.elapsedTime));
        }
    }

    updateAllStats(data) {
        if (data.originalImage) {
            this.updateOriginalImageStats(data.originalImage);
        }
        
        if (data.processedImage) {
            this.updateProcessedImageStats(data.processedImage);
        }
        
        if (data.processing) {
            this.updateCompressionStats(data.processing);
        }
        
        this.updateCompressionRatio();
    }

    updateCompressionRatio() {
        const originalSizeText = this.getStatElement('originalSize')?.textContent;
        const processedSizeText = this.getStatElement('processedSize')?.textContent;
        
        if (originalSizeText && processedSizeText && 
            originalSizeText !== '-' && processedSizeText !== '-') {
            
            // Parse sizes back to numbers (this is a simplification)
            const originalBytes = this.parseSizeToBytes(originalSizeText);
            const processedBytes = this.parseSizeToBytes(processedSizeText);
            
            if (originalBytes > 0 && processedBytes > 0) {
                const ratio = ((1 - (processedBytes / originalBytes)) * 100);
                this.updateStatElement('compressionRatio', this.utils.formatPercentage(ratio));
            }
        }
    }

    parseSizeToBytes(sizeText) {
        const match = sizeText.match(/^([\d.]+)\s*(\w+)$/);
        if (!match) return 0;
        
        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        
        const multipliers = { B: 1, KB: 1024, MB: 1024*1024, GB: 1024*1024*1024 };
        return value * (multipliers[unit] || 1);
    }

    updateStatElement(name, value) {
        const element = this.getElement(name);
        if (element) {
            element.textContent = value;
        }
    }

    getStatElement(name) {
        return this.getElement(name);
    }

    showImageStats() {
        const imageStats = this.getElement('imageStats');
        if (imageStats) {
            imageStats.style.display = 'block';
        }
    }

    async copyResultURL() {
        const resultUrl = this.getElement('resultUrl');
        const copyButton = this.getElement('copyButton');
        
        if (!resultUrl || !copyButton) return;
        
        try {
            await navigator.clipboard.writeText(resultUrl.textContent);
            
            const originalText = copyButton.innerHTML;
            copyButton.innerHTML = '✅ Copied!';
            copyButton.classList.add('copied');
            
            setTimeout(() => {
                copyButton.innerHTML = originalText;
                copyButton.classList.remove('copied');
            }, 2000);
            
        } catch (error) {
            console.error('Failed to copy URL:', error);
            copyButton.innerHTML = '❌ Failed';
            setTimeout(() => {
                copyButton.innerHTML = '📋 Copy URL';
            }, 2000);
        }
    }

    openResultURL() {
        const resultUrl = this.getElement('resultUrl');
        if (resultUrl) {
            window.open(resultUrl.textContent, '_blank');
        }
    }

    setupGlobalHandlers() {
        // Window resize
        window.addEventListener('resize', this.utils.debounce(() => {
            this.handleResize();
        }, 250));
        
        // Visibility change
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    handleResize() {
        // Emit resize event for other components
        this.eventBus.emit('ui:resize', {
            width: window.innerWidth,
            height: window.innerHeight
        });
    }

    handleVisibilityChange() {
        this.eventBus.emit('ui:visibility-changed', {
            hidden: document.hidden
        });
    }

    handleKeyboardShortcuts(event) {
        // Ctrl/Cmd + O to open file
        if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
            event.preventDefault();
            const fileInput = this.getElement('fileInput');
            if (fileInput) fileInput.click();
        }
        
        // Escape to cancel processing
        if (event.key === 'Escape' && this.state.isProcessing) {
            this.eventBus.emit('processing:cancel', { reason: 'User pressed Escape' });
        }
    }

    initializeTheme() {
        // Detect system theme preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.setTheme('dark');
        } else {
            this.setTheme('light');
        }
        
        // Listen for theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                this.setTheme(e.matches ? 'dark' : 'light');
            });
        }
    }

    setTheme(theme) {
        this.state.currentTheme = theme;
        document.body.setAttribute('data-theme', theme);
        
        this.eventBus.emit('ui:theme-changed', { theme });
    }

    getElement(name) {
        return this.elements.get(name) || null;
    }

    getUIState() {
        return {
            ...this.state,
            elementCount: this.elements.size,
            activeTimeouts: this.statusTimeouts.size
        };
    }

    reset() {
        // Clear all timeouts
        for (const timeoutId of this.statusTimeouts.values()) {
            clearTimeout(timeoutId);
        }
        this.statusTimeouts.clear();
        
        // Reset state
        this.state.isProcessing = false;
        this.state.progressValue = 0;
        this.state.currentStatus = null;
        
        // Hide all containers
        this.hideProcessingElements();
        
        const resultContainer = this.getElement('resultContainer');
        if (resultContainer) {
            resultContainer.style.display = 'none';
        }
        
        // Clear status
        const status = this.getElement('status');
        if (status) {
            status.style.display = 'none';
        }
        
        // Reset statistics
        const statElements = ['originalSize', 'processedSize', 'originalFormat', 
                             'finalFormat', 'compressionRatio', 'elapsedTime', 'attempts'];
        
        statElements.forEach(name => {
            this.updateStatElement(name, '-');
        });
        
        // Clear preview
        const preview = this.getElement('preview');
        if (preview) {
            preview.style.display = 'none';
            preview.src = '';
        }
    }

    cleanup() {
        this.debug('UIManager cleanup started');
        this.reset();
        this.elements.clear();
        this.debug('UIManager cleanup completed');
        console.log('UIManager cleaned up');
    }
};