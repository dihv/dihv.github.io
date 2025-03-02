/**
 * RealTimeMetrics.js
 * 
 * Handles real-time streaming updates of metrics and visualization of compression attempts
 * as the algorithm searches for the optimal compression parameters.
 */
window.RealTimeMetrics = class RealTimeMetrics {
    constructor() {
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
            // Create container
            chartContainer = document.createElement('div');
            chartContainer.id = 'attemptsChartContainer';
            chartContainer.className = 'attempts-chart-container';
            chartContainer.style.cssText = `
                margin: 1rem 0;
                padding: 1rem;
                background: var(--background-color);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                display: none;
            `;
            
            // Create header
            const header = document.createElement('h3');
            header.textContent = 'Compression Attempts';
            header.style.margin = '0 0 1rem 0';
            chartContainer.appendChild(header);
            
            // Create chart canvas
            const canvas = document.createElement('canvas');
            canvas.id = 'attemptsChart';
            canvas.style.width = '100%';
            canvas.style.height = '300px';
            chartContainer.appendChild(canvas);
            
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
        // Listen for metrics-update events
        document.addEventListener('metrics-update', (event) => {
            this.handleMetricsUpdate(event.detail);
        });
    }
    
    /**
     * Handle metrics update event
     * @param {Object} data - Metrics data from event
     */
    handleMetricsUpdate(data) {
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
            
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
            script.integrity = 'sha512-ElRFoEQdI5Ht6kZvyzXhYG9NqjtkmlkfYk0wr6wHxU9JEHakS7UJZNeml5ALk+8IKlU6jDgMabC3vkumRokgJA==';
            script.crossOrigin = 'anonymous';
            script.referrerPolicy = 'no-referrer';
            
            script.onload = () => {
                console.log('Chart.js loaded successfully');
                resolve();
            };
            
            script.onerror = (error) => {
                console.error('Failed to load Chart.js:', error);
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
        // Extract data for chart
        const attemptNumbers = attempts.map((_, index) => index + 1);
        const attemptSizes = attempts.map(a => a.size ? a.size / 1024 : 0); // KB
        const attemptFormats = attempts.map(a => a.format ? a.format.split('/')[1].toUpperCase() : 'Unknown');
        const attemptQualities = attempts.map(a => a.quality ? Math.round(a.quality * 100) : 0);
        const attemptDimensions = attempts.map(a => a.width && a.height ? `${a.width}×${a.height}` : 'Unknown');
        const attemptEncodedLengths = attempts.map(a => a.encodedLength || 0);
        const attemptSuccess = attempts.map(a => a.success === true);
        
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
        
        // Destroy previous chart instance if it exists
        if (this.chart) {
            this.chart.destroy();
        }
        
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
        
        // Create the chart
        const ctx = this.elements.attemptsChart.getContext('2d');
        this.chart = new Chart(ctx, {
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
                    },
                    annotation: {
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
                            },
                            originalSizeLine: originalSize > 0 ? {
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
                            } : undefined
                        }
                    }
                }
            }
        });
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
        window.realTimeMetrics = new window.RealTimeMetrics();
    }, 100);
});
