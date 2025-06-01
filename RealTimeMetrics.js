/**
 * RealTimeMetrics.js
 * 
 * Handles real-time streaming updates of metrics and visualization of compression attempts
 * as the algorithm searches for the optimal compression parameters.
 */
window.RealTimeMetrics = class RealTimeMetrics {
    constructor() {
        // Prevent duplicate initialization
        if (window.realTimeMetricsInitialized) {
            console.warn('RealTimeMetrics already initialized, skipping duplicate');
            return;
        }
        window.realTimeMetricsInitialized = true;
        
        // Set URL limit from config
        this.urlLimit = window.CONFIG ? window.CONFIG.MAX_URL_LENGTH : 8192;
        
        // DOM elements
        this.elements = {
            progressContainer: document.querySelector('.progress-container'),
            originalSize: document.getElementById('originalSize'),
            processedSize: document.getElementById('processedSize'),
            originalFormat: document.getElementById('originalFormat'),
            finalFormat: document.getElementById('finalFormat'),
            compressionRatio: document.getElementById('compressionRatio'),
            elapsedTime: document.getElementById('elapsedTime'),
            attempts: document.getElementById('attempts'),
            imageStats: document.getElementById('imageStats'),
            chartContainer: null,
            attemptsChart: null,
            binarySearchChart: null,
            urlDisplayContainer: null,
            currentUrlString: null,
            urlByteCount: null,
        };
        
        // Create chart container if not exists
        this.createChartContainer();
        
        // Initialize metrics state
        this.metrics = {
            attempts: [],
            currentSize: 0,
            originalSize: 0,
            maxSize: this.urlLimit,
            binarySearchHistory: []
        };
        
        // Chart instances
        this.chart = null;
        this.binarySearchChart = null;
        
        // Last tracked attempt count to determine what's new
        this.lastAttemptCount = 0;
        this.lastBinarySearchCount = 0;
        
        // Processing completion state
        this.processingComplete = false;
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('RealTimeMetrics initialized');
    }
    
    /**
     * Create chart container in DOM
     */
    createChartContainer() {
        // Check if container already exists
        let chartContainer = document.getElementById('attemptsChartContainer');
        
        if (!chartContainer) {
            // Create style element for chart container if not already exists
            if (!document.getElementById('realTimeMetricsStyles')) {
                const style = document.createElement('style');
                style.id = 'realTimeMetricsStyles';
                style.textContent = `
                    .attempts-chart-container {
                        margin: 1.5rem 0;
                        padding: 1.5rem;
                        background: var(--background-color, #fafafa);
                        border: 1px solid var(--border-color, #e0e0e0);
                        border-radius: 8px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    }
                    
                    .attempts-chart-container h3 {
                        margin-top: 0;
                        margin-bottom: 1rem;
                        color: var(--text-color, #333);
                        font-weight: 500;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    }
                    
                    .chart-tabs {
                        display: flex;
                        gap: 0.5rem;
                        margin-bottom: 1rem;
                        border-bottom: 1px solid var(--border-color, #e0e0e0);
                    }
                    
                    .chart-tab {
                        padding: 0.5rem 1rem;
                        background: none;
                        border: none;
                        cursor: pointer;
                        font-size: 0.9rem;
                        border-bottom: 2px solid transparent;
                        color: var(--muted-text, #666);
                    }
                    
                    .chart-tab.active {
                        color: var(--primary-color, #2196F3);
                        border-bottom-color: var(--primary-color, #2196F3);
                    }
                    
                    .chart-tab:hover {
                        background: var(--background-color, #fafafa);
                    }
                    
                    .chart-panel {
                        display: none;
                    }
                    
                    .chart-panel.active {
                        display: block;
                    }
                    
                    .attempts-chart-wrapper, .binary-search-wrapper {
                        position: relative;
                        height: 300px;
                        width: 100%;
                    }
                    
                    .chart-legend {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 1rem;
                        margin-top: 0.5rem;
                        font-size: 0.9rem;
                    }
                    
                    .legend-item {
                        display: flex;
                        align-items: center;
                        margin-right: 1rem;
                    }
                    
                    .legend-color {
                        width: 12px;
                        height: 12px;
                        border-radius: 2px;
                        margin-right: 4px;
                    }
                    
                    .loading-chart {
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(255,255,255,0.7);
                        z-index: 10;
                    }
                    
                    .binary-search-info {
                        margin-bottom: 1rem;
                        padding: 0.75rem;
                        background: #f8f9fa;
                        border-radius: 4px;
                        font-size: 0.9rem;
                        color: var(--muted-text, #666);
                    }
                    
                    @media (max-width: 768px) {
                        .attempts-chart-container {
                            padding: 1rem;
                        }
                        
                        .attempts-chart-wrapper, .binary-search-wrapper {
                            height: 250px;
                        }
                        
                        .chart-tabs {
                            flex-direction: column;
                        }
                        
                        .chart-tab {
                            text-align: left;
                        }
                    }
                    
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Create container
            chartContainer = document.createElement('div');
            chartContainer.id = 'attemptsChartContainer';
            chartContainer.className = 'attempts-chart-container';
            chartContainer.style.display = 'none';
            
            // Create header
            const header = document.createElement('h3');
            header.textContent = 'Compression Analysis';
            chartContainer.appendChild(header);
            
            // Create tabs for different charts
            const tabsContainer = document.createElement('div');
            tabsContainer.className = 'chart-tabs';
            tabsContainer.innerHTML = `
                <button class="chart-tab active" data-tab="attempts">Compression Attempts</button>
                <button class="chart-tab" data-tab="binary-search">Binary Search Progress</button>
            `;
            chartContainer.appendChild(tabsContainer);

            // URL display container
            const urlDisplayContainer = document.createElement('div');
            urlDisplayContainer.id = 'urlDisplayContainer';
            urlDisplayContainer.className = 'url-display-container';
            urlDisplayContainer.style.cssText = `
                margin-bottom: 1rem;
                padding: 1rem;
                background: white;
                border: 1px solid var(--border-color, #e0e0e0);
                border-radius: 8px;
                max-height: 150px;
                overflow: auto;
                display: none;
            `;
            
            // Add header and URL display element
            urlDisplayContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <h4 style="margin: 0; font-size: 1rem;">Current URL String</h4>
                    <div id="urlByteCount" style="font-size: 0.9rem; color: #666;">0 / ${this.urlLimit} chars</div>
                </div>
                <pre id="currentUrlString" style="margin: 0; font-size: 0.8rem; overflow-x: auto; white-space: pre-wrap; word-break: break-all;"></pre>
            `;
            
            chartContainer.appendChild(urlDisplayContainer);

            // Create attempts chart panel
            const attemptsPanel = document.createElement('div');
            attemptsPanel.className = 'chart-panel active';
            attemptsPanel.setAttribute('data-panel', 'attempts');
            
            const attemptsWrapper = document.createElement('div');
            attemptsWrapper.className = 'attempts-chart-wrapper';
            
            // Create loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-chart';
            loadingIndicator.style.display = 'none';
            loadingIndicator.innerHTML = `
                <div style="text-align: center;">
                    <div style="border: 4px solid rgba(0, 0, 0, 0.1); border-left-color: #2196F3; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto 10px;"></div>
                    <div>Loading chart...</div>
                </div>
            `;
            attemptsWrapper.appendChild(loadingIndicator);
            
            // Create chart canvas
            const attemptsCanvas = document.createElement('canvas');
            attemptsCanvas.id = 'attemptsChart';
            attemptsWrapper.appendChild(attemptsCanvas);
            
            attemptsPanel.appendChild(attemptsWrapper);
            
            // Create legend for attempts chart
            const attemptsLegend = document.createElement('div');
            attemptsLegend.className = 'chart-legend';
            attemptsLegend.innerHTML = `
                <div class="legend-item">
                    <div class="legend-color" style="background-color: rgba(75, 192, 192, 0.6);"></div>
                    <span>Successful attempt</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: rgba(255, 99, 132, 0.6);"></div>
                    <span>Failed attempt</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: rgba(54, 162, 235, 0.8);"></div>
                    <span>URL length</span>
                </div>
            `;
            attemptsPanel.appendChild(attemptsLegend);
            chartContainer.appendChild(attemptsPanel);

            // Create binary search chart panel
            const binarySearchPanel = document.createElement('div');
            binarySearchPanel.className = 'chart-panel';
            binarySearchPanel.setAttribute('data-panel', 'binary-search');
            
            // Add info section
            const binarySearchInfo = document.createElement('div');
            binarySearchInfo.className = 'binary-search-info';
            binarySearchInfo.innerHTML = `
                <strong>Binary Search Progress:</strong> This chart shows how the algorithm narrows down the optimal quality and scale parameters. 
                The red line represents the URL length limit. Green points indicate successful compressions that fit within the limit.
            `;
            binarySearchPanel.appendChild(binarySearchInfo);
            
            const binarySearchWrapper = document.createElement('div');
            binarySearchWrapper.className = 'binary-search-wrapper';
            
            // Create binary search canvas
            const binarySearchCanvas = document.createElement('canvas');
            binarySearchCanvas.id = 'binarySearchChart';
            binarySearchWrapper.appendChild(binarySearchCanvas);
            
            binarySearchPanel.appendChild(binarySearchWrapper);
            
            // Create legend for binary search chart
            const binarySearchLegend = document.createElement('div');
            binarySearchLegend.className = 'chart-legend';
            binarySearchLegend.innerHTML = `
                <div class="legend-item">
                    <div class="legend-color" style="background-color: rgba(75, 192, 192, 0.8);"></div>
                    <span>Successful iteration</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: rgba(255, 99, 132, 0.8);"></div>
                    <span>Failed iteration</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: rgba(255, 206, 86, 0.8);"></div>
                    <span>Search bounds</span>
                </div>
            `;
            binarySearchPanel.appendChild(binarySearchLegend);
            chartContainer.appendChild(binarySearchPanel);
            
            // Add container to the page after image stats
            const imageStats = document.getElementById('imageStats');
            if (imageStats && imageStats.parentNode) {
                imageStats.parentNode.insertBefore(chartContainer, imageStats.nextSibling);
            } else {
                // Fallback to adding before result container
                const resultContainer = document.getElementById('resultContainer');
                if (resultContainer && resultContainer.parentNode) {
                    resultContainer.parentNode.insertBefore(chartContainer, resultContainer);
                }
            }

            // Setup tab switching
            this.setupTabSwitching(chartContainer);
        }
        
        this.elements.chartContainer = chartContainer;
        this.elements.attemptsChart = document.getElementById('attemptsChart');
        this.elements.binarySearchChart = document.getElementById('binarySearchChart');
        this.elements.urlDisplayContainer = document.getElementById('urlDisplayContainer');
        this.elements.currentUrlString = document.getElementById('currentUrlString');
        this.elements.urlByteCount = document.getElementById('urlByteCount');
    }

    /**
     * Setup tab switching functionality
     * @param {HTMLElement} container - Chart container element
     */
    setupTabSwitching(container) {
        const tabs = container.querySelectorAll('.chart-tab');
        const panels = container.querySelectorAll('.chart-panel');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetPanel = tab.getAttribute('data-tab');
                
                // Remove active class from all tabs and panels
                tabs.forEach(t => t.classList.remove('active'));
                panels.forEach(p => p.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding panel
                tab.classList.add('active');
                const panel = container.querySelector(`[data-panel="${targetPanel}"]`);
                if (panel) {
                    panel.classList.add('active');
                }
            });
        });
    }
    
    /**
     * Setup event listeners for metrics updates
     */
    setupEventListeners() {
        // Remove any existing event listeners to prevent duplicates
        document.removeEventListener('metrics-update', this.handleMetricsUpdateBound);
        document.removeEventListener('binary-search-progress', this.handleBinarySearchUpdateBound);
        
        // Create bound methods for event listeners
        this.handleMetricsUpdateBound = this.handleMetricsUpdate.bind(this);
        this.handleBinarySearchUpdateBound = this.handleBinarySearchUpdate.bind(this);
        
        // Listen for metrics-update events
        document.addEventListener('metrics-update', this.handleMetricsUpdateBound);
        
        // Listen for binary search progress events
        document.addEventListener('binary-search-progress', this.handleBinarySearchUpdateBound);
    }

    /**
     * Handle binary search progress updates
     * @param {Object} event - Event object
     */
    handleBinarySearchUpdate(event) {
        const { history, current } = event.detail;
        
        // Store binary search history
        this.metrics.binarySearchHistory = history;
        
        // Update binary search chart
        this.updateBinarySearchChart(history);
    }
    
    /**
     * Handle metrics update event
     * @param {Object} event - Event object
     */
    handleMetricsUpdate(event) {
        const data = event.detail;
        const { metrics, progress } = data;
        
        // Update progress 
        if (typeof progress === 'number') {
            this.updateProgress(progress);
        }
        
        // Check if processing is completed or has errors
        const isComplete = metrics.completed === true;
        const hasErrors = metrics.errors && metrics.errors.length > 0;
        
        // Track completion state change
        if ((isComplete || hasErrors) && !this.processingComplete) {
            this.processingComplete = true;
            this.metrics.isProcessingComplete = true;
            this.metrics.finalMetrics = { ...metrics };
            
            // Show completion or error status
            if (hasErrors) {
                this.showErrorStatus(metrics);
            } else {
                this.showCompletionStatus(metrics);
            }
        }
        
        // Update compression attempts chart
        this.updateAttemptsChart(metrics, isComplete || hasErrors);
        
        // Update stats fields - use displayMetrics if available to prevent blanking
        const statsToUse = metrics.displayMetrics || metrics;
        this.updateStatsFields(statsToUse);
        
        // Update URL display
        this.updateUrlDisplay(metrics);
        
        // Update metrics state (always save latest metrics for reference)
        this.metrics = {
            ...this.metrics,
            currentStage: metrics.currentStage,
            elapsedTime: metrics.elapsedTime,
            attempts: metrics.compressionAttempts || [],
            isProcessingComplete: isComplete || hasErrors,
            // Only update finalMetrics on completion or error
            finalMetrics: (isComplete || hasErrors) ? { ...metrics } : this.metrics.finalMetrics
        };
        
        // Show metrics container if not already visible
        if (this.elements.imageStats) {
            this.elements.imageStats.style.display = 'block';
        }
        
        // Show chart container if there are attempts or binary search data
        if ((metrics.compressionAttempts && metrics.compressionAttempts.length > 0) ||
            (this.metrics.binarySearchHistory && this.metrics.binarySearchHistory.length > 0)) {
            this.elements.chartContainer.style.display = 'block';
        }
    }
    
    /**
     * Update progress bar
     * @param {number} progress - Progress percentage
     */
    updateProgress(progress) {
        // Show progress container
        if (this.elements.progressContainer) {
            this.elements.progressContainer.style.display = 'block';
        }
        
        // Update progress bar
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
            progressBar.setAttribute('aria-valuenow', progress);
        }
        
        // Update progress text
        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = `${Math.round(progress)}%`;
        }
    }

    showErrorStatus(metrics) {
        // Update status indicator
        if (this.elements.statusIndicator) {
            this.elements.statusIndicator.style.backgroundColor = '#f44336';
            this.elements.statusIndicator.style.color = 'white';
            this.elements.statusIndicator.textContent = 'Error: Processing Failed';
        }
        
        // Create summary of results with error info
        if (this.elements.metricsSummary && this.elements.summaryContent) {
            const original = metrics.originalImage || {};
            const processed = metrics.processedImage || {};
            
            // Get the latest error message
            const errorMessage = metrics.errors && metrics.errors.length > 0 ? 
                metrics.errors[metrics.errors.length - 1].message : 'Unknown error';
            
            // Calculate how far compression got
            let compressionInfo = '';
            if (metrics.compressionAttempts && metrics.compressionAttempts.length > 0) {
                const attemptsCount = metrics.compressionAttempts.length;
                
                // Find the smallest size reached
                const smallestSize = metrics.compressionAttempts.reduce((min, attempt) => {
                    return (attempt.size && attempt.size < min) ? attempt.size : min;
                }, Number.MAX_SAFE_INTEGER);
                
                if (smallestSize < Number.MAX_SAFE_INTEGER) {
                    compressionInfo = `<p><strong>Best Attempt Size:</strong> ${this.formatBytes(smallestSize)}</p>`;
                }
                
                compressionInfo += `<p><strong>Total Attempts:</strong> ${attemptsCount}</p>`;
            }
            
            let summary = `
                <p><strong style="color: #f44336;">Error:</strong> ${errorMessage}</p>
                <p><strong>Original:</strong> ${this.formatBytes(original.size || 0)} (${original.format || 'unknown'})</p>
                ${compressionInfo}
                <p><strong>Processing Time:</strong> ${((metrics.elapsedTime || 0) / 1000).toFixed(2)}s</p>
            `;
            
            this.elements.summaryContent.innerHTML = summary;
            this.elements.metricsSummary.classList.remove('hidden');
            
            // Add error styling to summary
            this.elements.metricsSummary.style.background = '#ffebee';
            this.elements.metricsSummary.style.borderLeft = '4px solid #f44336';
        }
    }

    showCompletionStatus(metrics) {
        // Show successful completion status
        if (this.elements.statusIndicator) {
            this.elements.statusIndicator.style.backgroundColor = '#4CAF50';
            this.elements.statusIndicator.style.color = 'white';
            this.elements.statusIndicator.textContent = 'Processing Complete';
        }
    }
    
    /**
     * Update stats fields with current metrics
     * @param {Object} metrics - Current metrics data
     */
    updateStatsFields(metrics) {
        // Only update if we have elements
        if (!this.elements.originalSize) return;
        
        // Show image stats container if not already visible
        if (this.elements.imageStats) {
            this.elements.imageStats.style.display = 'block';
        }
        
        // Update original image stats
        if (metrics.originalImage || metrics.originalSize) {
            const originalSize = metrics.originalImage?.size || 
                               (typeof metrics.originalSize === 'string' ? metrics.originalSize : null);
            const originalFormat = metrics.originalImage?.format || metrics.originalFormat;
            
            if (this.elements.originalSize && originalSize) {
                this.elements.originalSize.textContent = typeof originalSize === 'string' ? 
                    originalSize : this.formatBytes(originalSize);
                this.metrics.originalSize = originalSize;
            }
            
            if (this.elements.originalFormat && originalFormat) {
                this.elements.originalFormat.textContent = originalFormat;
            }
        }
        
        // Update processed image stats
        if (metrics.processedImage || metrics.processedSize) {
            const processedSize = metrics.processedImage?.size || 
                                (typeof metrics.processedSize === 'string' ? metrics.processedSize : null);
            const processedFormat = metrics.processedImage?.format || metrics.finalFormat;
            
            if (this.elements.processedSize && processedSize) {
                this.elements.processedSize.textContent = typeof processedSize === 'string' ? 
                    processedSize : this.formatBytes(processedSize);
                this.metrics.currentSize = processedSize;
            }
            
            if (this.elements.finalFormat && processedFormat) {
                this.elements.finalFormat.textContent = processedFormat;
            }
        }
        
        // Update compression ratio
        if (this.elements.compressionRatio && (metrics.compressionRatio || 
            (metrics.originalImage?.size && metrics.processedImage?.size))) {
            
            if (metrics.compressionRatio) {
                this.elements.compressionRatio.textContent = metrics.compressionRatio;
            } else {
                const ratio = ((1 - (metrics.processedImage.size / metrics.originalImage.size)) * 100).toFixed(1);
                this.elements.compressionRatio.textContent = `${ratio}%`;
            }
        }
        
        // Update elapsed time
        if (this.elements.elapsedTime && (metrics.elapsedTime || metrics.elapsedTime)) {
            if (typeof metrics.elapsedTime === 'string') {
                this.elements.elapsedTime.textContent = metrics.elapsedTime;
            } else if (metrics.elapsedTime) {
                this.elements.elapsedTime.textContent = `${(metrics.elapsedTime / 1000).toFixed(1)}s`;
            }
        }
        
        // Update attempts count
        if (this.elements.attempts && (metrics.attempts || metrics.compressionAttempts)) {
            const attemptsCount = metrics.attempts || metrics.compressionAttempts?.length || 0;
            this.elements.attempts.textContent = attemptsCount;
        }
    }
    
    /**
     * Update the attempts chart with new data
     * @param {Object} metrics - Current metrics data
     * @param {boolean} isComplete - Whether processing is complete
     */
    updateAttemptsChart(metrics, isComplete = false) {
        // Check if we have a chart element
        if (!this.elements.attemptsChart) return;
        
        // Get compression attempts
        const attempts = metrics.compressionAttempts || [];
        
        // Only update if we have new attempts
        if (attempts.length <= this.lastAttemptCount && !isComplete) return;
        
        // Store the new count
        this.lastAttemptCount = attempts.length;
        
        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            // Load Chart.js dynamically
            this.loadChartJS().then(() => {
                this.renderChart(attempts, metrics);
            }).catch(error => {
                console.error('Failed to load Chart.js:', error);
            });
        } else {
            // Chart.js already loaded
            this.renderChart(attempts, metrics);
        }
    }

    /**
     * Update the binary search chart
     * @param {Array} searchHistory - Binary search history
     */
    updateBinarySearchChart(searchHistory) {
        if (!this.elements.binarySearchChart || !searchHistory || searchHistory.length === 0) return;
        
        // Only update if we have new data
        if (searchHistory.length <= this.lastBinarySearchCount) return;
        
        this.lastBinarySearchCount = searchHistory.length;
        
        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            // Load Chart.js dynamically
            this.loadChartJS().then(() => {
                this.renderBinarySearchChart(searchHistory);
            }).catch(error => {
                console.error('Failed to load Chart.js for binary search chart:', error);
            });
        } else {
            // Chart.js already loaded
            this.renderBinarySearchChart(searchHistory);
        }
    }

    /**
     * Render the binary search progress chart
     * @param {Array} searchHistory - Binary search iteration history
     */
    renderBinarySearchChart(searchHistory) {
        const canvas = this.elements.binarySearchChart;
        if (!canvas) return;
        
        // Always destroy previous chart to prevent canvas size errors
        if (this.binarySearchChart) {
            this.binarySearchChart.destroy();
            this.binarySearchChart = null;
        }
        
        // Prepare data
        const iterations = searchHistory.map(item => item.iteration);
        const encodedLengths = searchHistory.map(item => item.encodedLength);
        const targetLength = searchHistory.length > 0 ? searchHistory[0].targetLength : this.urlLimit;
        
        // Color points based on success
        const pointColors = searchHistory.map(item => 
            item.success ? 'rgba(75, 192, 192, 0.8)' : 'rgba(255, 99, 132, 0.8)'
        );
        
        // Create search bounds data (quality and scale ranges)
        const qualityRanges = searchHistory.map(item => ({
            x: item.iteration,
            y: item.encodedLength,
            minQuality: item.minQuality,
            maxQuality: item.maxQuality,
            minScale: item.minScale,
            maxScale: item.maxScale
        }));
        
        const ctx = canvas.getContext('2d');
        
        // Create chart config
        const config = {
            type: 'line',
            data: {
                labels: iterations,
                datasets: [
                    {
                        label: 'URL Length',
                        data: encodedLengths,
                        borderColor: 'rgba(54, 162, 235, 0.8)',
                        backgroundColor: pointColors,
                        borderWidth: 2,
                        pointRadius: 6,
                        pointBackgroundColor: pointColors,
                        pointBorderColor: pointColors,
                        fill: false,
                        tension: 0.1
                    },
                    {
                        label: 'Target Length',
                        data: new Array(iterations.length).fill(targetLength),
                        borderColor: 'rgba(255, 0, 0, 0.8)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 300
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Binary Search Iteration'
                        },
                        beginAtZero: true
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'URL Length (characters)'
                        },
                        beginAtZero: true
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                const index = context[0].dataIndex;
                                const item = searchHistory[index];
                                return `Iteration ${item.iteration} ${item.success ? '✓' : '✗'}`;
                            },
                            afterTitle: function(context) {
                                const index = context[0].dataIndex;
                                const item = searchHistory[index];
                                return [
                                    `Quality: ${item.quality.toFixed(3)} (${item.minQuality.toFixed(3)} - ${item.maxQuality.toFixed(3)})`,
                                    `Scale: ${item.scale.toFixed(3)} (${item.minScale.toFixed(3)} - ${item.maxScale.toFixed(3)})`
                                ];
                            },
                            beforeBody: function(context) {
                                const index = context[0].dataIndex;
                                const item = searchHistory[index];
                                return [
                                    `URL Length: ${item.encodedLength.toLocaleString()} chars`,
                                    `Target: ${item.targetLength.toLocaleString()} chars`,
                                    `Status: ${item.success ? 'Success' : 'Too large'}`
                                ];
                            }
                        }
                    },
                    legend: {
                        position: 'top'
                    }
                }
            }
        };
        
        // Create the chart
        this.binarySearchChart = new Chart(ctx, config);
    }
    
    /**
     * Load Chart.js library dynamically
     * @returns {Promise} Promise that resolves when Chart.js is loaded
     */
    loadChartJS() {
        return new Promise((resolve, reject) => {
            if (typeof Chart !== 'undefined') {
                resolve();
                return;
            }
            
            // Show loading indicator
            const loadingIndicator = document.querySelector('.loading-chart');
            if (loadingIndicator) {
                loadingIndicator.style.display = 'flex';
            }
            
            // Load Chart.js
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
            script.crossOrigin = 'anonymous';
            script.referrerPolicy = 'no-referrer';
            
            script.onload = () => {
                console.log('Chart.js loaded successfully');
                
                // Load Chartjs Annotation plugin for horizontal lines
                const annotationScript = document.createElement('script');
                annotationScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-annotation/2.1.2/chartjs-plugin-annotation.min.js';
                annotationScript.crossOrigin = 'anonymous';
                annotationScript.referrerPolicy = 'no-referrer';
                
                annotationScript.onload = () => {
                    console.log('Chart.js Annotation plugin loaded successfully');
                    
                    // Hide loading indicator
                    if (loadingIndicator) {
                        loadingIndicator.style.display = 'none';
                    }
                    
                    resolve();
                };
                
                annotationScript.onerror = (error) => {
                    console.warn('Failed to load Chart.js Annotation plugin:', error);
                    // Still resolve as we can create the chart without annotations
                    
                    // Hide loading indicator
                    if (loadingIndicator) {
                        loadingIndicator.style.display = 'none';
                    }
                    
                    resolve();
                };
                
                document.head.appendChild(annotationScript);
            };
            
            script.onerror = (error) => {
                console.error('Failed to load Chart.js:', error);
                
                // Hide loading indicator
                if (loadingIndicator) {
                    loadingIndicator.style.display = 'none';
                }
                
                reject(error);
            };
            
            document.head.appendChild(script);
        });
    }

    /**
     * Update the real-time URL display
     * @param {Object} metrics - Current metrics data
     */
    updateUrlDisplay(metrics) {
        // Check if we have the URL elements
        if (!this.elements.urlDisplayContainer || !this.elements.currentUrlString) return;
        
        // Check if there's an encoded URL to display from the latest attempt
        const attempts = metrics.compressionAttempts || [];
        if (attempts.length === 0) return;
        
        // Show the URL display container
        this.elements.urlDisplayContainer.style.display = 'block';
        
        // Get the latest attempt with encoded data
        let latestAttempt = null;
        for (let i = attempts.length - 1; i >= 0; i--) {
            if (attempts[i].encoded) {
                latestAttempt = attempts[i];
                break;
            }
        }
        
        if (!latestAttempt || !latestAttempt.encoded) return;
        
        // Get the encoded string
        const encodedString = latestAttempt.encoded;
        
        // Update the URL display
        this.elements.currentUrlString.textContent = encodedString;
        
        // Update the byte count
        const length = encodedString.length;
        const percentOfLimit = Math.round((length / this.urlLimit) * 100);
        
        this.elements.urlByteCount.textContent = `${length.toLocaleString()} / ${this.urlLimit.toLocaleString()} chars (${percentOfLimit}%)`;
        
        // Add color based on percentage
        if (percentOfLimit > 95) {
            this.elements.urlByteCount.style.color = 'red';
        } else if (percentOfLimit > 75) {
            this.elements.urlByteCount.style.color = 'orange';
        } else {
            this.elements.urlByteCount.style.color = '#666';
        }
    }

    
    /**
     * Render the attempts chart
     * @param {Array} attempts - Array of compression attempts
     * @param {Object} metrics - Current metrics data
     */
    renderChart(attempts, metrics) {
        // Make sure we have a valid context
        const canvas = this.elements.attemptsChart;
        if (!canvas) return;
        
        // Always destroy previous chart to prevent canvas size errors
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        
        // Extract data for chart
        const attemptNumbers = attempts.map((_, index) => index + 1);
        const attemptSizes = attempts.map(a => a.size ? a.size / 1024 : 0); // KB
        const attemptFormats = attempts.map(a => a.format ? a.format.split('/')[1].toUpperCase() : 'Unknown');
        const attemptQualities = attempts.map(a => a.quality ? Math.round(a.quality * 100) : 0);
        const attemptDimensions = attempts.map(a => a.width && a.height ? `${a.width}×${a.height}` : 'Unknown');
        const attemptEncodedLengths = attempts.map(a => a.encodedLength || 0);
        
        // Set colors based on success status
        const backgroundColor = attempts.map(a => 
            a.success === true ? 'rgba(75, 192, 192, 0.6)' : 'rgba(255, 99, 132, 0.6)'
        );
        
        const borderColor = attempts.map(a => 
            a.success === true ? 'rgb(75, 192, 192)' : 'rgb(255, 99, 132)'
        );
        
        // Calculate URL limit line
        const effectiveUrlLimit = this.urlLimit * 0.95; // 5% safety margin
        
        // Reset canvas dimensions to prevent growing
        const ctx = canvas.getContext('2d');
        
        // Create tooltips with detailed information
        const tooltips = attempts.map((a, i) => ({
            format: attemptFormats[i],
            quality: attemptQualities[i],
            dimensions: attemptDimensions[i],
            size: a.size ? this.formatBytes(a.size) : 'Unknown',
            encodedLength: a.encodedLength ? a.encodedLength : 'Unknown',
            success: a.success === true ? 'Yes' : 'No'
        }));
        
        // Calculate original size for reference if available
        const originalSize = metrics.originalImage ? metrics.originalImage.size / 1024 : 0;
        
        // Create chart config
        const config = {
            type: 'bar',
            data: {
                labels: attemptNumbers,
                datasets: [
                    {
                        label: 'File Size (KB)',
                        data: attemptSizes,
                        backgroundColor: backgroundColor,
                        borderColor: borderColor,
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Encoded URL Length',
                        data: attemptEncodedLengths,
                        type: 'line',
                        fill: false,
                        borderColor: 'rgba(54, 162, 235, 0.8)',
                        borderWidth: 2,
                        pointRadius: 3,
                        pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                        yAxisID: 'y1',
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 300
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Attempt #'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Size (KB)'
                        },
                        suggestedMin: 0
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'URL Length (chars)'
                        },
                        grid: {
                            drawOnChartArea: false
                        },
                        suggestedMin: 0,
                        suggestedMax: this.urlLimit * 1.1
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return `Attempt #${context[0].dataIndex + 1}`;
                            },
                            afterTitle: function(context) {
                                const i = context[0].dataIndex;
                                return `Format: ${tooltips[i].format}, Quality: ${tooltips[i].quality}%`;
                            },
                            beforeBody: function(context) {
                                const i = context[0].dataIndex;
                                return [
                                    `Dimensions: ${tooltips[i].dimensions}`,
                                    `File Size: ${tooltips[i].size}`,
                                    `URL Length: ${tooltips[i].encodedLength} chars`,
                                    `Success: ${tooltips[i].success}`
                                ];
                            }
                        }
                    },
                    legend: {
                        position: 'top'
                    }
                }
            }
        };
        
        // Add annotations if plugin is available
        if (typeof Chart.annotation !== 'undefined') {
            config.options.plugins.annotation = {
                annotations: {
                    urlLimitLine: {
                        type: 'line',
                        mode: 'horizontal',
                        scaleID: 'y1',
                        value: effectiveUrlLimit,
                        borderColor: 'red',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        label: {
                            content: 'URL Limit',
                            enabled: true,
                            position: 'end'
                        }
                    }
                }
            };
            
            if (originalSize > 0) {
                config.options.plugins.annotation.annotations.originalSizeLine = {
                    type: 'line',
                    mode: 'horizontal',
                    scaleID: 'y',
                    value: originalSize,
                    borderColor: 'orange',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    label: {
                        content: 'Original Size',
                        enabled: true,
                        position: 'start'
                    }
                };
            }
        }
        
        // Create the chart
        this.chart = new Chart(ctx, config);
    }
    
    /**
     * Format bytes to human-readable string
     * @param {number} bytes - Bytes to format
     * @returns {string} Formatted bytes string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    /**
     * Return current metrics state
     * @returns {Object} Current metrics state
     */
    getMetricsState() {
        return this.metrics;
    }
};

// Initialize RealTimeMetrics when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Wait a short time to ensure other components are initialized
    setTimeout(() => {
        if (!window.realTimeMetrics) {
            window.realTimeMetrics = new window.RealTimeMetrics();
            console.log('RealTimeMetrics initialized on page load');
            
            // Show progress container
            const progressContainer = document.querySelector('.progress-container');
            if (progressContainer) {
                progressContainer.style.display = 'block';
            }
        }
    }, 100);
});
