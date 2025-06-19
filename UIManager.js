/**
 * UIManager.js
 * * Consolidated UI management system that replaces scattered UI update mechanisms.
 * Provides centralized DOM manipulation, status updates, and user feedback.
 */
window.UIManager = class UIManager {
    constructor(eventBus, utils) {
        this.eventBus = eventBus;
        this.utils = utils;
        
        // DOM element cache
        this.elements = new Map();
        
        // UI state
        this.state = {
            currentStatus: null,
            isProcessing: false,
            progressValue: 0,
            lastUpdate: 0,
            currentTheme: 'light'
        };
        
        // Update throttling
        this.updateThrottle = 100; // ms
        this.throttledUpdates = new Map();
        
        // Status timeouts
        this.statusTimeouts = new Map();
        
        // Initialize UI
        this.initialize();
        
        console.log('UIManager initialized');
    }

    /**
     * Initialize UI manager
     */
    async initialize() {
        this.cacheElements();
        this.setupEventListeners();
        this.setupGlobalHandlers();
        this.initializeTheme();
        
        // Show ready state
        this.updateStatus('System ready', 'success', '', { timeout: 3000 });
    }

    /**
     * Cache DOM elements for faster access
     */
    cacheElements() {
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
            cancelButton: '#cancelProcessing',
            copyButton: '#copyButton',
            openButton: '#openButton',
            
            // Error elements
            scriptError: '#scriptError'
        };
        
        for (const [name, selector] of Object.entries(elementSelectors)) {
            const element = document.querySelector(selector);
            if (element) {
                this.elements.set(name, element);
            } else {
                console.warn(`UI element not found: ${selector}`);
            }
        }
        
        console.log(`UIManager cached ${this.elements.size} DOM elements`);
    }

    /**
     * Setup event listeners for UI events
     */
    setupEventListeners() {
        // Listen to processing events
        this.eventBus.on('processing:*', (data, eventType) => {
            this.handleProcessingEvent(eventType, data);
        });
        
        // Listen to error events
        this.eventBus.on('error', (error) => this.showError(error));
        this.eventBus.on('warning', (warning) => this.showWarning(warning));
        
        // Listen to status events
        this.eventBus.on('ui:show-error', (data) => this.showError(data));
        this.eventBus.on('ui:show-warning', (data) => this.showWarning(data));
        this.eventBus.on('ui:show-status', (data) => this.updateStatus(data.message, data.type, data.details));
        
        // Listen to metrics events
        this.eventBus.on('metrics:*', (data, eventType) => {
            this.handleMetricsEvent(eventType, data);
        });
        
        // Setup UI interaction handlers
        this.setupInteractionHandlers();
    }

    /**
     * Setup interaction handlers for UI elements
     */
    setupInteractionHandlers() {
        // Cancel button
        const cancelButton = this.getElement('cancelButton');
        if (cancelButton) {
            cancelButton.addEventListener('click', () => {
                this.eventBus.emit('processing:cancel', { reason: 'User cancelled' });
            });
        }
        
        // Copy button
        const copyButton = this.getElement('copyButton');
        if (copyButton) {
            copyButton.addEventListener('click', () => this.copyResultURL());
        }
        
        // Open button
        const openButton = this.getElement('openButton');
        if (openButton) {
            openButton.addEventListener('click', () => this.openResultURL());
        }
        
        // File input
        const fileInput = this.getElement('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.eventBus.emit('file:selected', { file: e.target.files[0] });
                }
            });
        }
        
        // Drop zone
        const dropZone = this.getElement('dropZone');
        if (dropZone) {
            this.setupDropZone(dropZone);
        }

        // Select button
        const selectButton = this.getElement('selectButton');
        if (selectButton) {
            selectButton.addEventListener('click', (e) => {
                // This is to prevent the dropZone click handler from firing as well
                e.stopPropagation();
                if (fileInput) {
                    fileInput.click();
                }
            });
        }
    }

    /**
     * Setup drop zone handlers
     */
    setupDropZone(dropZone) {
        dropZone.addEventListener('click', () => {
            const fileInput = this.getElement('fileInput');
            if (fileInput) {
                fileInput.click();
            }
        });

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-active');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-active');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.eventBus.emit('file:dropped', { file: files[0] });
            }
        });
        
        // Keyboard accessibility
        dropZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const fileInput = this.getElement('fileInput');
                if (fileInput) fileInput.click();
            }
        });
    }

    /**
     * Setup global UI handlers
     */
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

    /**
     * Handle processing events
     */
    handleProcessingEvent(eventType, data) {
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
     * Handle metrics events
     */
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

    /**
     * Show error message
     * @param {Object} error - Error object or string
     */
    showError(error) {
        const message = typeof error === 'string' ? error : 
                       error.message || 'An unknown error occurred';
        
        const details = error.details || error.stack || '';
        
        this.updateStatus(message, 'error', details);
        
        // Also update script error element for critical errors
        if (error.severity === 'critical' || error.type === 'system') {
            const scriptError = this.getElement('scriptError');
            if (scriptError) {
                scriptError.innerHTML = `
                    <strong>⚠️ ${error.title || 'Critical Error'}</strong><br>
                    ${message}<br>
                    ${details ? `<small>${details}</small>` : ''}
                `;
                scriptError.style.display = 'block';
            }
        }
    }

    /**
     * Show warning message
     * @param {Object} warning - Warning object
     */
    showWarning(warning) {
        const message = typeof warning === 'string' ? warning : 
                       warning.message || 'Warning';
        
        this.updateStatus(message, 'warning', warning.details || '', { timeout: 5000 });
    }

    /**
     * Handle processing started
     */
    handleProcessingStarted(data) {
        this.state.isProcessing = true;
        this.updateProgress(0);
        this.showProcessingElements();
        this.updateStatus('Processing started...', 'processing');
    }

    /**
     * Handle processing completed
     */
    handleProcessingCompleted(data) {
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
     * Handle processing cancelled
     */
    handleProcessingCancelled(data) {
        this.state.isProcessing = false;
        this.updateProgress(0);
        this.hideProcessingElements();
        
        const reason = data.reason || 'Processing was cancelled';
        this.updateStatus(`Cancelled: ${reason}`, 'warning');
    }

    /**
     * Show processing-related UI elements
     */
    showProcessingElements() {
        const progressContainer = this.getElement('progressContainer');
        if (progressContainer) {
            progressContainer.style.display = 'block';
        }
    }

    /**
     * Hide processing-related UI elements
     */
    hideProcessingElements() {
        const progressContainer = this.getElement('progressContainer');
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
    }

    /**
     * Show result URL
     * @param {string} url - Result URL
     */
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

    /**
     * Update original image statistics
     */
    updateOriginalImageStats(data) {
        this.updateStatElement('originalSize', this.utils.formatBytes(data.size || 0));
        this.updateStatElement('originalFormat', this.utils.formatImageFormat(data.format || ''));
        this.showImageStats();
    }

    /**
     * Update processed image statistics
     */
    updateProcessedImageStats(data) {
        this.updateStatElement('processedSize', this.utils.formatBytes(data.size || 0));
        this.updateStatElement('finalFormat', this.utils.formatImageFormat(data.format || ''));
        this.updateCompressionRatio();
    }

    /**
     * Update compression statistics
     */
    updateCompressionStats(data) {
        this.updateStatElement('attempts', (data.totalAttempts || 0).toString());
        
        if (data.elapsedTime) {
            this.updateStatElement('elapsedTime', this.utils.formatTime(data.elapsedTime));
        }
    }

    /**
     * Update all statistics
     */
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

    /**
     * Update compression ratio display
     */
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

    /**
     * Parse formatted size back to bytes (simplified)
     */
    parseSizeToBytes(sizeText) {
        const match = sizeText.match(/^([\d.]+)\s*(\w+)$/);
        if (!match) return 0;
        
        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        
        const multipliers = { B: 1, KB: 1024, MB: 1024*1024, GB: 1024*1024*1024 };
        return value * (multipliers[unit] || 1);
    }

    /**
     * Update a specific statistic element
     */
    updateStatElement(name, value) {
        const element = this.getElement(name);
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * Get a specific statistic element
     */
    getStatElement(name) {
        return this.getElement(name);
    }

    /**
     * Show image statistics container
     */
    showImageStats() {
        const imageStats = this.getElement('imageStats');
        if (imageStats) {
            imageStats.style.display = 'block';
        }
    }

    /**
     * Copy result URL to clipboard
     */
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

    /**
     * Open result URL in new window
     */
    openResultURL() {
        const resultUrl = this.getElement('resultUrl');
        if (resultUrl) {
            window.open(resultUrl.textContent, '_blank');
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        // Emit resize event for other components
        this.eventBus.emit('ui:resize', {
            width: window.innerWidth,
            height: window.innerHeight
        });
    }

    /**
     * Handle visibility change
     */
    handleVisibilityChange() {
        this.eventBus.emit('ui:visibility-changed', {
            hidden: document.hidden
        });
    }

    /**
     * Handle keyboard shortcuts
     */
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

    /**
     * Initialize theme
     */
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

    /**
     * Set UI theme
     * @param {string} theme - Theme name (light, dark)
     */
    setTheme(theme) {
        this.state.currentTheme = theme;
        document.body.setAttribute('data-theme', theme);
        
        this.eventBus.emit('ui:theme-changed', { theme });
    }

    /**
     * Get cached DOM element
     * @param {string} name - Element name
     * @returns {HTMLElement|null} DOM element
     */
    getElement(name) {
        return this.elements.get(name) || null;
    }

    /**
     * Get current UI state
     * @returns {Object} Current UI state
     */
    getUIState() {
        return {
            ...this.state,
            elementCount: this.elements.size,
            activeTimeouts: this.statusTimeouts.size
        };
    }

    /**
     * Reset UI to initial state
     */
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

    /**
     * Cleanup UI manager
     */
    cleanup() {
        this.reset();
        this.elements.clear();
        console.log('UIManager cleaned up');
    }
};
