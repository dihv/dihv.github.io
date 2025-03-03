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
            attemptsChart: null
        };
        
        // Create chart container if not exists
        this.createChartContainer();
        
        // Initialize metrics state
        this.metrics = {
            attempts: [],
            currentSize: 0,
            originalSize: 0,
            maxSize: window.CONFIG ? window.CONFIG.MAX_URL_LENGTH : 8192
        };
        
        // Chart instance
        this.chart = null;
        
        // Last tracked attempt count to determine what's new
        this.lastAttemptCount = 0;
        
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
                    
                    .attempts-chart-wrapper {
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
                    
                    @media (max-width: 768px) {
                        .attempts-chart-container {
                            padding: 1rem;
                        }
                        
                        .attempts-chart-wrapper {
                            height: 250px;
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
            header.textContent = 'Compression Attempts Chart';
            chartContainer.appendChild(header);
            
            // Create chart wrapper
            const chartWrapper = document.createElement('div');
            chartWrapper.className = 'attempts-chart-wrapper';

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
            chartWrapper.appendChild(loadingIndicator);
            
            // Create chart canvas
            const canvas = document.createElement('canvas');
            canvas.id = 'attemptsChart';
            chartWrapper.appendChild(canvas);
            
            // Add wrapper to container
            chartContainer.appendChild(chartWrapper);
            
            // Create legend
            const legend = document.createElement('div');
            legend.className = 'chart-legend';
            legend.innerHTML = `
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
            chartContainer.appendChild(legend);
            
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
        }
        
        this.elements.chartContainer = chartContainer;
        this.elements.attemptsChart = document.getElementById('attemptsChart');
    }
    
    /**
     * Setup event listeners for metrics updates
     */
    setupEventListeners() {
        // Remove any existing event listeners to prevent duplicates
        document.removeEventListener('metrics-update', this.handleMetricsUpdateBound);
        
        // Create bound method for event listener
        this.handleMetricsUpdateBound = this.handleMetricsUpdate.bind(this);
        
        // Listen for metrics-update events
        document.addEventListener('metrics-update', this.handleMetricsUpdateBound);
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
        
        // Update compression attempts chart
        this.updateAttemptsChart(metrics);
        
        // Update stats fields
        this.updateStatsFields(metrics);
        
        // Update metrics state
        this.metrics = {
            ...this.metrics,
            currentStage: metrics.currentStage,
            elapsedTime: metrics.elapsedTime,
            attempts: metrics.compressionAttempts || []
        };
        
        // Show metrics container if not already visible
        if (this.elements.imageStats) {
            this.elements.imageStats.style.display = 'block';
        }
        
        // Show chart container if there are attempts
        if (metrics.compressionAttempts && metrics.compressionAttempts.length > 0) {
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
        if (metrics.originalImage) {
            if (this.elements.originalSize && metrics.originalImage.size) {
                this.elements.originalSize.textContent = this.formatBytes(metrics.originalImage.size);
                this.metrics.originalSize = metrics.originalImage.size;
            }
            
            if (this.elements.originalFormat && metrics.originalImage.format) {
                this.elements.originalFormat.textContent = metrics.originalImage.format;
            }
        }
        
        // Update processed image stats
        if (metrics.processedImage) {
            if (this.elements.processedSize && metrics.processedImage.size) {
                this.elements.processedSize.textContent = this.formatBytes(metrics.processedImage.size);
                this.metrics.currentSize = metrics.processedImage.size;
            }
            
            if (this.elements.finalFormat && metrics.processedImage.format) {
                this.elements.finalFormat.textContent = metrics.processedImage.format;
            }
        }
        
        // Update compression ratio
        if (this.elements.compressionRatio && metrics.originalImage && metrics.originalImage.size && 
            metrics.processedImage && metrics.processedImage.size) {
            const ratio = ((1 - (metrics.processedImage.size / metrics.originalImage.size)) * 100).toFixed(1);
            this.elements.compressionRatio.textContent = `${ratio}%`;
        }
        
        // Update elapsed time
        if (this.elements.elapsedTime && metrics.elapsedTime) {
            this.elements.elapsedTime.textContent = `${(metrics.elapsedTime / 1000).toFixed(1)}s`;
        }
        
        // Update attempts count
        if (this.elements.attempts && metrics.compressionAttempts) {
            this.elements.attempts.textContent = metrics.compressionAttempts.length;
        }
    }
    
    /**
     * Update the attempts chart with new data
     * @param {Object} metrics - Current metrics data
     */
    updateAttemptsChart(metrics) {
        // Check if we have a chart element
        if (!this.elements.attemptsChart) return;
        
        // Get compression attempts
        const attempts = metrics.compressionAttempts || [];
        
        // Only update if we have new attempts
        if (attempts.length <= this.lastAttemptCount) return;
        
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
            script.integrity = 'sha512-ElRFoEQdI5Ht6kZvyzXhYG9NqjtkmlkfYk0wr6wHxU9JEHakS7UJZNeml5ALk+8IKlU6jDgMabC3vkumRokgJA==';
            script.crossOrigin = 'anonymous';
            script.referrerPolicy = 'no-referrer';
            
            script.onload = () => {
                console.log('Chart.js loaded successfully');
                
                // Load Chartjs Annotation plugin for horizontal lines
                const annotationScript = document.createElement('script');
                annotationScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-annotation/2.1.2/chartjs-plugin-annotation.min.js';
                annotationScript.integrity = 'sha512-XO1wSJGGFeAvYQGEFIFVkTq1SAqvBBJOYK5XGsMSyxkYkRzRsL1K/hIxU2EReN8+XmQ1cGrxCBJTZVXqnYGpnw==';
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
        const urlLimit = window.CONFIG ? window.CONFIG.MAX_URL_LENGTH : 8192;
        const effectiveUrlLimit = urlLimit * 0.95; // 5% safety margin
        
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
                        suggestedMax: urlLimit * 1.1
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
