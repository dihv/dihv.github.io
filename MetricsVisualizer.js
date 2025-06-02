/**
 * MetricsVisualizer.js
 * 
 * Handles all chart rendering and real-time visualization for BitStream Image Share.
 * Manages Chart.js integration and provides interactive data visualization.
 * Pure visualization layer - no data collection concerns.
 */
window.MetricsVisualizer = class MetricsVisualizer {
    constructor(metricsCollector) {
        // Prevent duplicate instances
        if (window.metricsVisualizerInstance) {
            return window.metricsVisualizerInstance;
        }
        window.metricsVisualizerInstance = this;

        this.metricsCollector = metricsCollector;
        this.charts = new Map();
        this.chartContainers = new Map();
        
        // Chart.js loading state
        this.chartJSLoaded = false;
        this.chartJSLoading = false;
        
        // Configuration
        this.config = {
            updateInterval: 250, // ms between chart updates
            maxDataPoints: 100,  // maximum points to show on charts
            animationDuration: 200,
            colors: {
                success: 'rgba(75, 192, 192, 0.8)',
                failure: 'rgba(255, 99, 132, 0.8)',
                progress: 'rgba(54, 162, 235, 0.8)',
                warning: 'rgba(255, 206, 86, 0.8)',
                target: 'rgba(255, 0, 0, 0.8)'
            }
        };

        // Chart update throttling
        this.updateQueue = new Set();
        this.isUpdating = false;

        this.initialize();
        console.log('MetricsVisualizer initialized');
    }

    /**
     * Initialize the visualizer and setup event listeners
     */
    async initialize() {
        await this.createChartContainers();
        this.setupEventListeners();
        await this.ensureChartJSLoaded();
    }

    /**
     * Create chart containers in the DOM
     */
    async createChartContainers() {
        // Add CSS styles for charts
        this.injectChartStyles();

        // Create main visualization container
        const mainContainer = this.createMainContainer();
        
        // Create individual chart containers
        await this.createCompressionAttemptsChart(mainContainer);
        await this.createBinarySearchChart(mainContainer);
        await this.createPerformanceChart(mainContainer);
        
        // Insert into DOM
        this.insertIntoDOM(mainContainer);
    }

    /**
     * Inject required CSS styles for charts
     */
    injectChartStyles() {
        if (document.getElementById('metricsVisualizerStyles')) return;

        const style = document.createElement('style');
        style.id = 'metricsVisualizerStyles';
        style.textContent = `
            .metrics-visualizer {
                margin: 1.5rem 0;
                padding: 1.5rem;
                background: var(--background-color, #fafafa);
                border: 1px solid var(--border-color, #e0e0e0);
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                display: none;
            }

            .metrics-visualizer.active {
                display: block;
            }

            .chart-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
                padding-bottom: 0.5rem;
                border-bottom: 1px solid var(--border-color, #e0e0e0);
            }

            .chart-title {
                font-size: 1.2rem;
                font-weight: 600;
                color: var(--text-color, #333);
                margin: 0;
            }

            .chart-controls {
                display: flex;
                gap: 0.5rem;
            }

            .chart-tab-container {
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
                transition: all 0.2s ease;
            }

            .chart-tab:hover {
                background: var(--background-color, #fafafa);
                color: var(--text-color, #333);
            }

            .chart-tab.active {
                color: var(--primary-color, #2196F3);
                border-bottom-color: var(--primary-color, #2196F3);
                font-weight: 500;
            }

            .chart-panel {
                display: none;
            }

            .chart-panel.active {
                display: block;
            }

            .chart-wrapper {
                position: relative;
                height: 300px;
                margin-bottom: 1rem;
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
            }

            .legend-color {
                width: 12px;
                height: 12px;
                border-radius: 2px;
                margin-right: 6px;
            }

            .chart-loading {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(255,255,255,0.8);
                z-index: 10;
            }

            .loading-spinner {
                border: 3px solid rgba(0, 0, 0, 0.1);
                border-left-color: var(--primary-color, #2196F3);
                border-radius: 50%;
                width: 30px;
                height: 30px;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .chart-info {
                margin-bottom: 1rem;
                padding: 0.75rem;
                background: #f8f9fa;
                border-radius: 4px;
                font-size: 0.9rem;
                color: var(--muted-text, #666);
            }

            .chart-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 1rem;
                margin-top: 1rem;
                padding: 1rem;
                background: white;
                border-radius: 4px;
                border: 1px solid var(--border-color, #e0e0e0);
            }

            .chart-stat {
                text-align: center;
            }

            .chart-stat-value {
                font-size: 1.2rem;
                font-weight: 600;
                color: var(--primary-color, #2196F3);
            }

            .chart-stat-label {
                font-size: 0.8rem;
                color: var(--muted-text, #666);
                margin-top: 0.25rem;
            }

            @media (max-width: 768px) {
                .metrics-visualizer {
                    padding: 1rem;
                    margin: 1rem 0;
                }

                .chart-wrapper {
                    height: 250px;
                }

                .chart-tab-container {
                    flex-direction: column;
                }

                .chart-header {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 0.5rem;
                }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Create main visualization container
     * @returns {HTMLElement} Main container element
     */
    createMainContainer() {
        const container = document.createElement('div');
        container.id = 'metricsVisualizer';
        container.className = 'metrics-visualizer';

        const header = document.createElement('div');
        header.className = 'chart-header';
        header.innerHTML = `
            <h3 class="chart-title">Processing Visualization</h3>
            <div class="chart-controls">
                <button id="toggleCharts" class="chart-tab">Hide Charts</button>
            </div>
        `;

        container.appendChild(header);
        return container;
    }

    /**
     * Create compression attempts chart container
     * @param {HTMLElement} parent - Parent container
     */
    async createCompressionAttemptsChart(parent) {
        const panel = this.createChartPanel('compression-attempts', 'Compression Attempts', true);
        
        panel.innerHTML += `
            <div class="chart-info">
                <strong>Compression Progress:</strong> This chart shows each compression attempt with file size and URL length.
                Green bars indicate successful attempts that fit within the URL limit.
            </div>
            <div class="chart-wrapper">
                <canvas id="compressionAttemptsChart"></canvas>
                <div class="chart-loading" style="display: none;">
                    <div class="loading-spinner"></div>
                </div>
            </div>
            <div class="chart-legend">
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${this.config.colors.success};"></div>
                    <span>Successful attempt</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${this.config.colors.failure};"></div>
                    <span>Failed attempt</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${this.config.colors.progress};"></div>
                    <span>URL length</span>
                </div>
            </div>
            <div class="chart-stats" id="compressionStats">
                <div class="chart-stat">
                    <div class="chart-stat-value" id="totalAttempts">0</div>
                    <div class="chart-stat-label">Total Attempts</div>
                </div>
                <div class="chart-stat">
                    <div class="chart-stat-value" id="successfulAttempts">0</div>
                    <div class="chart-stat-label">Successful</div>
                </div>
                <div class="chart-stat">
                    <div class="chart-stat-value" id="successRate">0%</div>
                    <div class="chart-stat-label">Success Rate</div>
                </div>
            </div>
        `;

        parent.appendChild(panel);
        this.chartContainers.set('compression-attempts', panel);
    }

    /**
     * Create binary search chart container
     * @param {HTMLElement} parent - Parent container
     */
    async createBinarySearchChart(parent) {
        const panel = this.createChartPanel('binary-search', 'Binary Search Progress');
        
        panel.innerHTML += `
            <div class="chart-info">
                <strong>Binary Search Progress:</strong> Shows how the algorithm narrows down optimal quality and scale parameters.
                Each point represents a search iteration with the resulting URL length.
            </div>
            <div class="chart-wrapper">
                <canvas id="binarySearchChart"></canvas>
                <div class="chart-loading" style="display: none;">
                    <div class="loading-spinner"></div>
                </div>
            </div>
            <div class="chart-legend">
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${this.config.colors.success};"></div>
                    <span>Successful iteration</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${this.config.colors.failure};"></div>
                    <span>Failed iteration</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${this.config.colors.target};"></div>
                    <span>URL limit</span>
                </div>
            </div>
        `;

        parent.appendChild(panel);
        this.chartContainers.set('binary-search', panel);
    }

    /**
     * Create performance monitoring chart container
     * @param {HTMLElement} parent - Parent container
     */
    async createPerformanceChart(parent) {
        const panel = this.createChartPanel('performance', 'Performance Metrics');
        
        panel.innerHTML += `
            <div class="chart-info">
                <strong>Performance Monitoring:</strong> Real-time tracking of memory usage and processing performance.
            </div>
            <div class="chart-wrapper">
                <canvas id="performanceChart"></canvas>
                <div class="chart-loading" style="display: none;">
                    <div class="loading-spinner"></div>
                </div>
            </div>
            <div class="chart-legend">
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${this.config.colors.progress};"></div>
                    <span>Memory usage</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${this.config.colors.warning};"></div>
                    <span>Processing time</span>
                </div>
            </div>
        `;

        parent.appendChild(panel);
        this.chartContainers.set('performance', panel);
    }

    /**
     * Create a chart panel with tabs
     * @param {string} id - Panel ID
     * @param {string} title - Panel title
     * @param {boolean} active - Whether panel is initially active
     * @returns {HTMLElement} Panel element
     */
    createChartPanel(id, title, active = false) {
        const panel = document.createElement('div');
        panel.id = `${id}Panel`;
        panel.className = `chart-panel${active ? ' active' : ''}`;
        panel.setAttribute('data-panel', id);

        return panel;
    }

    /**
     * Setup tab switching and event listeners
     */
    setupEventListeners() {
        // Setup metrics collector event listeners
        if (this.metricsCollector) {
            this.metricsCollector.addEventListener('compression-attempt-recorded', 
                this.handleCompressionAttempt.bind(this));
            this.metricsCollector.addEventListener('binary-search-iteration', 
                this.handleBinarySearchIteration.bind(this));
            this.metricsCollector.addEventListener('performance-metric-recorded', 
                this.handlePerformanceMetric.bind(this));
            this.metricsCollector.addEventListener('processing-started', 
                this.handleProcessingStarted.bind(this));
            this.metricsCollector.addEventListener('processing-completed', 
                this.handleProcessingCompleted.bind(this));
        }

        // Setup tab switching after container is in DOM
        setTimeout(() => this.setupTabSwitching(), 100);
    }

    /**
     * Setup tab switching functionality
     */
    setupTabSwitching() {
        const container = document.getElementById('metricsVisualizer');
        if (!container) return;

        // Create tab container if it doesn't exist
        let tabContainer = container.querySelector('.chart-tab-container');
        if (!tabContainer) {
            tabContainer = document.createElement('div');
            tabContainer.className = 'chart-tab-container';
            tabContainer.innerHTML = `
                <button class="chart-tab active" data-tab="compression-attempts">Compression</button>
                <button class="chart-tab" data-tab="binary-search">Binary Search</button>
                <button class="chart-tab" data-tab="performance">Performance</button>
            `;
            
            const header = container.querySelector('.chart-header');
            if (header) {
                header.parentNode.insertBefore(tabContainer, header.nextSibling);
            }
        }

        // Setup tab click handlers
        const tabs = tabContainer.querySelectorAll('.chart-tab');
        const panels = container.querySelectorAll('.chart-panel');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetPanel = tab.getAttribute('data-tab');

                // Update tab states
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update panel states
                panels.forEach(p => p.classList.remove('active'));
                const panel = container.querySelector(`[data-panel="${targetPanel}"]`);
                if (panel) {
                    panel.classList.add('active');
                }
            });
        });

        // Setup toggle button
        const toggleButton = container.querySelector('#toggleCharts');
        if (toggleButton) {
            toggleButton.addEventListener('click', () => {
                const isVisible = !container.classList.contains('collapsed');
                if (isVisible) {
                    container.classList.add('collapsed');
                    toggleButton.textContent = 'Show Charts';
                    panels.forEach(p => p.style.display = 'none');
                } else {
                    container.classList.remove('collapsed');
                    toggleButton.textContent = 'Hide Charts';
                    const activePanel = container.querySelector('.chart-panel.active');
                    if (activePanel) activePanel.style.display = 'block';
                }
            });
        }
    }

    /**
     * Insert chart container into DOM at appropriate location
     * @param {HTMLElement} container - Container to insert
     */
    insertIntoDOM(container) {
        // Try to insert after image stats
        const imageStats = document.getElementById('imageStats');
        if (imageStats && imageStats.parentNode) {
            imageStats.parentNode.insertBefore(container, imageStats.nextSibling);
            return;
        }

        // Fallback to before result container
        const resultContainer = document.getElementById('resultContainer');
        if (resultContainer && resultContainer.parentNode) {
            resultContainer.parentNode.insertBefore(container, resultContainer);
            return;
        }

        // Last resort - append to main container
        const mainContainer = document.querySelector('.container');
        if (mainContainer) {
            mainContainer.appendChild(container);
        }
    }

    /**
     * Ensure Chart.js is loaded
     * @returns {Promise<boolean>} Whether Chart.js was loaded successfully
     */
    async ensureChartJSLoaded() {
        if (this.chartJSLoaded) return true;
        if (this.chartJSLoading) {
            // Wait for existing load to complete
            return new Promise(resolve => {
                const checkLoaded = () => {
                    if (this.chartJSLoaded) resolve(true);
                    else if (!this.chartJSLoading) resolve(false);
                    else setTimeout(checkLoaded, 100);
                };
                checkLoaded();
            });
        }

        this.chartJSLoading = true;

        try {
            // Check if Chart.js is already loaded
            if (typeof Chart !== 'undefined') {
                this.chartJSLoaded = true;
                this.chartJSLoading = false;
                return true;
            }

            // Load Chart.js
            await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js');
            
            // Load annotation plugin
            try {
                await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-annotation/2.1.2/chartjs-plugin-annotation.min.js');
            } catch (error) {
                console.warn('Failed to load Chart.js annotation plugin:', error);
                // Continue without annotations
            }

            this.chartJSLoaded = true;
            console.log('Chart.js loaded successfully');
            return true;

        } catch (error) {
            console.error('Failed to load Chart.js:', error);
            return false;
        } finally {
            this.chartJSLoading = false;
        }
    }

    /**
     * Load external script
     * @param {string} src - Script source URL
     * @returns {Promise<void>} Promise that resolves when script loads
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.crossOrigin = 'anonymous';
            script.referrerPolicy = 'no-referrer';
            
            script.onload = resolve;
            script.onerror = reject;
            
            document.head.appendChild(script);
        });
    }

    /**
     * Handle compression attempt events
     * @param {Event} event - Compression attempt event
     */
    async handleCompressionAttempt(event) {
        const { attempt, totalAttempts } = event.detail;
        
        this.queueChartUpdate('compression-attempts', async () => {
            await this.updateCompressionAttemptsChart();
            this.updateCompressionStats();
        });

        // Show visualizer if hidden
        this.showVisualizer();
    }

    /**
     * Handle binary search iteration events
     * @param {Event} event - Binary search event
     */
    async handleBinarySearchIteration(event) {
        const { iteration, totalIterations } = event.detail;
        
        this.queueChartUpdate('binary-search', async () => {
            await this.updateBinarySearchChart();
        });
    }

    /**
     * Handle performance metric events
     * @param {Event} event - Performance metric event
     */
    async handlePerformanceMetric(event) {
        const { category, metric, value } = event.detail;
        
        this.queueChartUpdate('performance', async () => {
            await this.updatePerformanceChart();
        });
    }

    /**
     * Handle processing started events
     * @param {Event} event - Processing started event
     */
    async handleProcessingStarted(event) {
        this.showVisualizer();
        this.clearAllCharts();
    }

    /**
     * Handle processing completed events
     * @param {Event} event - Processing completed event
     */
    async handleProcessingCompleted(event) {
        // Final update of all charts
        await this.updateAllCharts();
    }

    /**
     * Queue a chart update to prevent excessive redraws
     * @param {string} chartId - Chart identifier
     * @param {Function} updateFunction - Update function to execute
     */
    queueChartUpdate(chartId, updateFunction) {
        this.updateQueue.add({ chartId, updateFunction });
        
        if (!this.isUpdating) {
            this.processUpdateQueue();
        }
    }

    /**
     * Process queued chart updates
     */
    async processUpdateQueue() {
        this.isUpdating = true;

        // Group updates by chart to prevent duplicate work
        const updates = new Map();
        for (const update of this.updateQueue) {
            updates.set(update.chartId, update.updateFunction);
        }
        this.updateQueue.clear();

        // Execute updates
        for (const [chartId, updateFunction] of updates) {
            try {
                await updateFunction();
            } catch (error) {
                console.error(`Error updating chart ${chartId}:`, error);
            }
        }

        this.isUpdating = false;

        // Process any updates that were queued while we were updating
        if (this.updateQueue.size > 0) {
            setTimeout(() => this.processUpdateQueue(), this.config.updateInterval);
        }
    }

    /**
     * Update compression attempts chart
     */
    async updateCompressionAttemptsChart() {
        if (!this.chartJSLoaded) {
            await this.ensureChartJSLoaded();
        }

        const metrics = this.metricsCollector.getMetrics();
        const attempts = metrics.compressionAttempts || [];
        
        if (attempts.length === 0) return;

        const canvas = document.getElementById('compressionAttemptsChart');
        if (!canvas) return;

        // Destroy existing chart
        const existingChart = this.charts.get('compression-attempts');
        if (existingChart) {
            existingChart.destroy();
        }

        // Prepare data
        const labels = attempts.map((_, index) => `#${index + 1}`);
        const fileSizes = attempts.map(a => (a.size || 0) / 1024); // KB
        const urlLengths = attempts.map(a => a.encodedLength || 0);
        const targetLength = this.metricsCollector.getTargetLength();

        // Color points based on success
        const colors = attempts.map(a => 
            a.success ? this.config.colors.success : this.config.colors.failure
        );

        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'File Size (KB)',
                        data: fileSizes,
                        backgroundColor: colors,
                        borderColor: colors,
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'URL Length',
                        data: urlLengths,
                        type: 'line',
                        fill: false,
                        borderColor: this.config.colors.progress,
                        borderWidth: 2,
                        pointRadius: 4,
                        pointBackgroundColor: this.config.colors.progress,
                        yAxisID: 'y1',
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: this.config.animationDuration },
                scales: {
                    x: { title: { display: true, text: 'Attempt #' } },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Size (KB)' },
                        beginAtZero: true
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'URL Length (chars)' },
                        grid: { drawOnChartArea: false },
                        beginAtZero: true,
                        suggestedMax: targetLength * 1.1
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: (context) => `Attempt ${context[0].dataIndex + 1}`,
                            afterBody: (context) => {
                                const attempt = attempts[context[0].dataIndex];
                                return [
                                    `Format: ${attempt.format?.split('/')[1]?.toUpperCase() || 'Unknown'}`,
                                    `Quality: ${Math.round((attempt.quality || 0) * 100)}%`,
                                    `Dimensions: ${attempt.width || '?'}×${attempt.height || '?'}`,
                                    `Success: ${attempt.success ? 'Yes' : 'No'}`
                                ];
                            }
                        }
                    },
                    legend: { position: 'top' }
                }
            }
        });

        // Add target line annotation if plugin is available
        if (typeof Chart.register !== 'undefined' && window.chartjsPluginAnnotation) {
            Chart.register(window.chartjsPluginAnnotation);
            chart.options.plugins.annotation = {
                annotations: {
                    targetLine: {
                        type: 'line',
                        mode: 'horizontal',
                        scaleID: 'y1',
                        value: targetLength,
                        borderColor: this.config.colors.target,
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
            chart.update('none');
        }

        this.charts.set('compression-attempts', chart);
    }

    /**
     * Update binary search chart
     */
    async updateBinarySearchChart() {
        if (!this.chartJSLoaded) {
            await this.ensureChartJSLoaded();
        }

        const metrics = this.metricsCollector.getMetrics();
        const iterations = metrics.binarySearchHistory || [];
        
        if (iterations.length === 0) return;

        const canvas = document.getElementById('binarySearchChart');
        if (!canvas) return;

        // Destroy existing chart
        const existingChart = this.charts.get('binary-search');
        if (existingChart) {
            existingChart.destroy();
        }

        // Prepare data
        const labels = iterations.map(i => `Iter ${i.iteration || i.id}`);
        const urlLengths = iterations.map(i => i.encodedLength || 0);
        const targetLength = this.metricsCollector.getTargetLength();

        // Color points based on success
        const pointColors = iterations.map(i => 
            i.success ? this.config.colors.success : this.config.colors.failure
        );

        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'URL Length',
                        data: urlLengths,
                        borderColor: this.config.colors.progress,
                        backgroundColor: pointColors,
                        borderWidth: 2,
                        pointRadius: 6,
                        pointBackgroundColor: pointColors,
                        pointBorderColor: pointColors,
                        fill: false,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: this.config.animationDuration },
                scales: {
                    x: { title: { display: true, text: 'Binary Search Iteration' } },
                    y: {
                        title: { display: true, text: 'URL Length (characters)' },
                        beginAtZero: true,
                        suggestedMax: targetLength * 1.2
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: (context) => {
                                const iteration = iterations[context[0].dataIndex];
                                return `Iteration ${iteration.iteration || iteration.id} ${iteration.success ? '✓' : '✗'}`;
                            },
                            afterBody: (context) => {
                                const iteration = iterations[context[0].dataIndex];
                                return [
                                    `Quality: ${(iteration.quality || 0).toFixed(3)} (${(iteration.minQuality || 0).toFixed(3)} - ${(iteration.maxQuality || 1).toFixed(3)})`,
                                    `Scale: ${(iteration.scale || 0).toFixed(3)} (${(iteration.minScale || 0).toFixed(3)} - ${(iteration.maxScale || 1).toFixed(3)})`,
                                    `URL Length: ${iteration.encodedLength || 0} chars`,
                                    `Target: ${targetLength} chars`
                                ];
                            }
                        }
                    },
                    legend: { position: 'top' }
                }
            }
        });

        this.charts.set('binary-search', chart);
    }

    /**
     * Update performance chart
     */
    async updatePerformanceChart() {
        if (!this.chartJSLoaded) {
            await this.ensureChartJSLoaded();
        }

        const metrics = this.metricsCollector.getMetrics();
        const performance = metrics.performance || {};
        
        const canvas = document.getElementById('performanceChart');
        if (!canvas) return;

        // For now, show a simple placeholder until we have performance data
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('Performance data will appear here during processing', canvas.width / 2, canvas.height / 2);
    }

    /**
     * Update compression statistics display
     */
    updateCompressionStats() {
        const metrics = this.metricsCollector.getMetrics();
        const attempts = metrics.compressionAttempts || [];
        
        const totalAttempts = attempts.length;
        const successfulAttempts = attempts.filter(a => a.success).length;
        const successRate = totalAttempts > 0 ? (successfulAttempts / totalAttempts * 100).toFixed(1) : 0;

        // Update stats display
        const totalEl = document.getElementById('totalAttempts');
        const successfulEl = document.getElementById('successfulAttempts');
        const rateEl = document.getElementById('successRate');

        if (totalEl) totalEl.textContent = totalAttempts;
        if (successfulEl) successfulEl.textContent = successfulAttempts;
        if (rateEl) rateEl.textContent = `${successRate}%`;
    }

    /**
     * Show the visualizer container
     */
    showVisualizer() {
        const container = document.getElementById('metricsVisualizer');
        if (container) {
            container.classList.add('active');
        }
    }

    /**
     * Hide the visualizer container
     */
    hideVisualizer() {
        const container = document.getElementById('metricsVisualizer');
        if (container) {
            container.classList.remove('active');
        }
    }

    /**
     * Clear all charts
     */
    clearAllCharts() {
        for (const chart of this.charts.values()) {
            chart.destroy();
        }
        this.charts.clear();
    }

    /**
     * Update all charts
     */
    async updateAllCharts() {
        await this.updateCompressionAttemptsChart();
        await this.updateBinarySearchChart();
        await this.updatePerformanceChart();
        this.updateCompressionStats();
    }

    /**
     * Clean up resources
     */
    cleanup() {
        // Destroy all charts
        this.clearAllCharts();

        // Clear timers
        this.updateQueue.clear();

        // Remove event listeners
        if (this.metricsCollector) {
            // Note: EventTarget doesn't have removeAllListeners, 
            // so we'd need to track listeners to remove them properly
        }

        // Clear instance reference
        if (window.metricsVisualizerInstance === this) {
            window.metricsVisualizerInstance = null;
        }

        console.log('MetricsVisualizer cleaned up');
    }
};