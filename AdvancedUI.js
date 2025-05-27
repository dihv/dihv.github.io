/**
 * AdvancedUI.js
 * 
 * Creates and manages advanced UI components for the image processing application
 * including detailed statistics, visualizations, and real-time feedback
 */
window.AdvancedUI = class AdvancedUI {
    constructor() {
        // Prevent duplicate initialization
        if (window.advancedUIInitialized) {
            console.warn('AdvancedUI already initialized, skipping duplicate');
            return;
        }
        window.advancedUIInitialized = true;
        
        this.domElements = {
            container: document.querySelector('.container'),
            imageStatsContainer: document.getElementById('imageStats'),
            resultContainer: document.getElementById('resultContainer'),
            status: document.getElementById('status')
        };
        
        this.charts = {};
        this.initialized = false;
        
        // Store final values to prevent UI from going blank
        this.finalValues = {
            originalSize: '-',
            originalFormat: '-',
            originalDimensions: '-',
            processedSize: '-',
            finalFormat: '-',
            compressionRatio: '-',
            elapsedTime: '-',
            attempts: '-',
            processingStatus: 'Ready'
        };
        
        // Track if processing has completed to use final values
        this.processingCompleted = false;
    }

    /**
     * Initialize UI components and event listeners
     */
    initialize() {
        if (this.initialized) return;
        
        // Check if elements already exist to avoid duplicates
        if (document.querySelector('.advanced-stats')) {
            console.warn('AdvancedUI elements already exist, skipping initialization');
            this.initialized = true;
            return;
        }
        
        this.setupAdvancedStatsPanel();
        this.setupDetailedAnalysisPanel();
        this.setupProgressVisualization();
        this.setupProcessingLog();
        this.setupEventListeners();
        
        this.initialized = true;
        console.log('Advanced UI components initialized');
    }
    
    /**
     * Preserve final values when processing completes
     * @param {Object} metrics - Final metrics data
     */
    preserveFinalValues(metrics) {
        this.processingCompleted = true;
        
        // Calculate compression metrics
        const compressionMetrics = this.calculateCompressionMetrics(metrics);
        
        // Store final values that should persist
        this.finalValues = {
            originalSize: this.formatBytes(metrics.originalImage?.size || 0),
            originalFormat: metrics.originalImage?.format || 'unknown',
            originalDimensions: (metrics.originalImage?.width && metrics.originalImage?.height) ? 
                `${metrics.originalImage.width} × ${metrics.originalImage.height}` : '-',
            processedSize: this.formatBytes(metrics.processedImage?.size || 0),
            finalFormat: metrics.processedImage?.format || 'unknown',
            compressionRatio: `${compressionMetrics.ratio}%`,
            elapsedTime: `${((metrics.elapsedTime || metrics.totalTime || 0) / 1000).toFixed(1)}s`,
            attempts: (metrics.compressionAttempts?.length || 0).toString(),
            processingStatus: metrics.errors?.length > 0 ? 'Error' : 'Complete'
        };
        
        // Update UI with final values
        this.updateUIWithFinalValues();
    }
    
    /**
     * Update UI fields with preserved final values
     */
    updateUIWithFinalValues() {
        if (!this.processingCompleted) return;
        
        // Update stats fields with final values
        Object.keys(this.finalValues).forEach(key => {
            if (this.statFields && this.statFields[key]) {
                this.statFields[key].textContent = this.finalValues[key];
            }
        });
    }
    
    /**
     * Calculate compression metrics
     * @param {Object} metrics - Metrics data
     * @returns {Object} Compression metrics
     */
    calculateCompressionMetrics(metrics) {
        const original = metrics.originalImage;
        const processed = metrics.processedImage;
        
        if (original?.size && processed?.size) {
            const ratio = (1 - (processed.size / original.size)) * 100;
            const bytesReduced = original.size - processed.size;
            
            return {
                ratio: ratio.toFixed(2),
                bytesReduced,
                bytesReducedFormatted: this.formatBytes(bytesReduced)
            };
        }
        
        return { ratio: 0, bytesReduced: 0, bytesReducedFormatted: '0 B' };
    }
    
    /**
     * Creates enhanced statistics panel
     */
    setupAdvancedStatsPanel() {
        const statsPanel = document.createElement('div');
        statsPanel.className = 'advanced-stats';
        statsPanel.innerHTML = `
            <div class="stats-header">
                <h3>Processing Statistics</h3>
                <button class="toggle-button" data-target="stats-content">
                    <span class="toggle-icon">▼</span>
                </button>
            </div>
            <div id="stats-content" class="stats-content">
                <div class="progress-container">
                    <div class="progress">
                        <div id="progressBar" class="progress-bar" role="progressbar" 
                             style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
                    </div>
                    <div id="progressText" class="progress-text">0%</div>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-col">
                        <div class="stat-group">
                            <h4>Input</h4>
                            <div class="stat-row">
                                <div class="stat-label">Size:</div>
                                <div id="originalSize" class="stat-value">-</div>
                            </div>
                            <div class="stat-row">
                                <div class="stat-label">Format:</div>
                                <div id="originalFormat" class="stat-value">-</div>
                            </div>
                            <div class="stat-row">
                                <div class="stat-label">Dimensions:</div>
                                <div id="originalDimensions" class="stat-value">-</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-col">
                        <div class="stat-group">
                            <h4>Output</h4>
                            <div class="stat-row">
                                <div class="stat-label">Size:</div>
                                <div id="processedSize" class="stat-value">-</div>
                            </div>
                            <div class="stat-row">
                                <div class="stat-label">Format:</div>
                                <div id="finalFormat" class="stat-value">-</div>
                            </div>
                            <div class="stat-row">
                                <div class="stat-label">Reduction:</div>
                                <div id="compressionRatio" class="stat-value">-</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stat-col">
                        <div class="stat-group">
                            <h4>Performance</h4>
                            <div class="stat-row">
                                <div class="stat-label">Time:</div>
                                <div id="elapsedTime" class="stat-value">-</div>
                            </div>
                            <div class="stat-row">
                                <div class="stat-label">Attempts:</div>
                                <div id="attempts" class="stat-value">-</div>
                            </div>
                            <div class="stat-row">
                                <div class="stat-label">Status:</div>
                                <div id="processingStatus" class="stat-value">-</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div id="compressionChart" class="chart-container">
                    <!-- Chart will be inserted here -->
                </div>
            </div>
        `;
        
        // Insert after the image stats container
        if (this.domElements.imageStatsContainer) {
            this.domElements.imageStatsContainer.parentNode.insertBefore(
                statsPanel, 
                this.domElements.imageStatsContainer.nextSibling
            );
            
            // Hide the original stats container since we're replacing it
            this.domElements.imageStatsContainer.style.display = 'none';
        } else {
            // Fallback to insert before the result container
            this.domElements.container.insertBefore(
                statsPanel, 
                this.domElements.resultContainer
            );
        }
        
        // Store references to the stat fields
        this.statFields = {
            originalSize: document.getElementById('originalSize'),
            originalFormat: document.getElementById('originalFormat'),
            originalDimensions: document.getElementById('originalDimensions'),
            processedSize: document.getElementById('processedSize'),
            finalFormat: document.getElementById('finalFormat'),
            compressionRatio: document.getElementById('compressionRatio'),
            elapsedTime: document.getElementById('elapsedTime'),
            attempts: document.getElementById('attempts'),
            processingStatus: document.getElementById('processingStatus'),
            progressBar: document.getElementById('progressBar'),
            progressText: document.getElementById('progressText')
        };
    }
    
    /**
     * Sets up detailed image analysis panel
     */
    setupDetailedAnalysisPanel() {
        const analysisPanel = document.createElement('div');
        analysisPanel.className = 'analysis-panel';
        analysisPanel.innerHTML = `
            <div class="analysis-header">
                <h3>Image Analysis</h3>
                <button class="toggle-button" data-target="analysis-content">
                    <span class="toggle-icon">▼</span>
                </button>
            </div>
            <div id="analysis-content" class="analysis-content">
                <div class="analysis-summary">
                    <div class="analysis-type">
                        <span class="label">Image Type:</span>
                        <span id="imageType" class="value">-</span>
                    </div>
                    <div class="analysis-size">
                        <span class="label">Dimensions:</span>
                        <span id="imageDimensions" class="value">-</span>
                    </div>
                </div>
                
                <div class="analysis-details">
                    <div class="analysis-col">
                        <h4>Properties</h4>
                        <div class="property-row">
                            <div class="property-label">Transparency:</div>
                            <div id="hasTransparency" class="property-value">-</div>
                        </div>
                        <div class="property-row">
                            <div class="property-label">Color Count:</div>
                            <div id="colorCount" class="property-value">-</div>
                        </div>
                        <div class="property-row">
                            <div class="property-label">Color Depth:</div>
                            <div id="colorDepth" class="property-value">-</div>
                        </div>
                    </div>
                    
                    <div class="analysis-col">
                        <h4>Complexity</h4>
                        <div class="property-row">
                            <div class="property-label">Entropy:</div>
                            <div id="entropy" class="property-value">-</div>
                        </div>
                        <div class="property-row">
                            <div class="property-label">Edge Detection:</div>
                            <div id="edgeComplexity" class="property-value">-</div>
                        </div>
                        <div class="property-row">
                            <div class="property-label">Bytes/Pixel:</div>
                            <div id="bytesPerPixel" class="property-value">-</div>
                        </div>
                    </div>
                </div>
                
                <div class="format-recommendations">
                    <h4>Recommended Formats</h4>
                    <div id="formatRankings" class="format-rankings">
                        <!-- Format rankings will be inserted here -->
                    </div>
                </div>
                
                <div class="compression-estimate">
                    <h4>Estimated Compression</h4>
                    <div class="estimate-range">
                        <div class="range-min">
                            <span class="label">Min:</span>
                            <span id="minSavings" class="value">-</span>
                        </div>
                        <div class="range-likely">
                            <span class="label">Likely:</span>
                            <span id="likelySavings" class="value">-</span>
                        </div>
                        <div class="range-max">
                            <span class="label">Max:</span>
                            <span id="maxSavings" class="value">-</span>
                        </div>
                    </div>
                    <div id="savingsChart" class="savings-chart">
                        <!-- Savings chart will be inserted here -->
                    </div>
                </div>
            </div>
        `;
        
        // Insert after the stats panel
        const statsPanel = document.querySelector('.advanced-stats');
        if (statsPanel) {
            statsPanel.parentNode.insertBefore(analysisPanel, statsPanel.nextSibling);
        } else {
            // Fallback
            this.domElements.container.insertBefore(
                analysisPanel, 
                this.domElements.resultContainer
            );
        }
        
        // Store references to analysis fields
        this.analysisFields = {
            imageType: document.getElementById('imageType'),
            imageDimensions: document.getElementById('imageDimensions'),
            hasTransparency: document.getElementById('hasTransparency'),
            colorCount: document.getElementById('colorCount'),
            colorDepth: document.getElementById('colorDepth'),
            entropy: document.getElementById('entropy'),
            edgeComplexity: document.getElementById('edgeComplexity'),
            bytesPerPixel: document.getElementById('bytesPerPixel'),
            formatRankings: document.getElementById('formatRankings'),
            minSavings: document.getElementById('minSavings'),
            likelySavings: document.getElementById('likelySavings'),
            maxSavings: document.getElementById('maxSavings')
        };
    }
    
    /**
     * Sets up progress visualization
     */
    setupProgressVisualization() {
        // Add chart container if it doesn't exist
        if (!document.getElementById('compressionChart')) {
            const chartContainer = document.createElement('div');
            chartContainer.id = 'compressionChart';
            chartContainer.className = 'chart-container';
            
            const statsContent = document.getElementById('stats-content');
            if (statsContent) {
                statsContent.appendChild(chartContainer);
            }
        }
        
        this.initializeCharts();
    }
    
    /**
     * Setup real-time processing log
     */
    setupProcessingLog() {
        const logContainer = document.createElement('div');
        logContainer.className = 'processing-log';
        logContainer.innerHTML = `
            <div class="log-header">
                <h3>Processing Log</h3>
                <button class="toggle-button" data-target="log-content">
                    <span class="toggle-icon">▼</span>
                </button>
            </div>
            <div id="log-content" class="log-content">
                <div id="logEntries" class="log-entries"></div>
            </div>
        `;
        
        // Insert after the analysis panel
        const analysisPanel = document.querySelector('.analysis-panel');
        if (analysisPanel) {
            analysisPanel.parentNode.insertBefore(logContainer, analysisPanel.nextSibling);
        } else {
            // Fallback
            this.domElements.container.insertBefore(
                logContainer, 
                this.domElements.resultContainer
            );
        }
        
        this.logEntriesContainer = document.getElementById('logEntries');
    }
    
    /**
     * Setup event listeners for UI interaction
     */
    setupEventListeners() {
        // Toggle buttons
        document.querySelectorAll('.toggle-button').forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.getAttribute('data-target');
                const targetEl = document.getElementById(targetId);
                const iconEl = button.querySelector('.toggle-icon');
                
                if (targetEl) {
                    const isVisible = targetEl.style.display !== 'none';
                    targetEl.style.display = isVisible ? 'none' : 'block';
                    iconEl.textContent = isVisible ? '▶' : '▼';
                }
            });
        });
        
        // Listen for metrics updates
        document.addEventListener('metrics-update', (event) => {
            this.updateFromMetrics(event.detail);
        });
    }
    
    /**
     * Initialize chart visualizations
     */
    initializeCharts() {
        // We'll use simple DOM-based charts for compatibility
        // Later these could be replaced with a chart library
        
        const compressionChartContainer = document.getElementById('compressionChart');
        if (compressionChartContainer) {
            compressionChartContainer.innerHTML = `
                <div class="chart-title">Compression Progress</div>
                <div class="bar-chart-container">
                    <div id="compressionBars" class="bar-chart">
                        <!-- Bars will be added here -->
                    </div>
                    <div class="chart-axis">
                        <div class="axis-label">Original</div>
                        <div class="axis-label">Target</div>
                        <div class="axis-label">Current</div>
                    </div>
                </div>
            `;
        }
        
        const savingsChartContainer = document.getElementById('savingsChart');
        if (savingsChartContainer) {
            savingsChartContainer.innerHTML = `
                <div class="range-chart">
                    <div class="range-bar">
                        <div id="savingsRangeMin" class="range-segment range-min" style="width: 20%"></div>
                        <div id="savingsRangeLikely" class="range-segment range-likely" style="width: 30%"></div>
                        <div id="savingsRangeMax" class="range-segment range-max" style="width: 20%"></div>
                    </div>
                </div>
            `;
        }
    }
    
    /**
     * Update UI from metrics data
     * @param {Object} data - Metrics data
     */
    updateFromMetrics(data) {
        const { metrics, progress, compressionMetrics } = data;
        
        // Check if processing is complete
        const isComplete = metrics.completed === true;
        const hasErrors = metrics.errors && metrics.errors.length > 0;
        
        // If processing just completed, preserve final values
        if ((isComplete || hasErrors) && !this.processingCompleted) {
            this.preserveFinalValues(metrics);
            return; // Return early as preserveFinalValues will update the UI
        }
        
        // If processing is already completed, use final values
        if (this.processingCompleted) {
            this.updateUIWithFinalValues();
            return;
        }
        
        // Update progress
        if (this.statFields.progressBar && progress !== undefined) {
            this.statFields.progressBar.style.width = `${progress}%`;
            this.statFields.progressBar.setAttribute('aria-valuenow', progress);
            
            if (this.statFields.progressText) {
                this.statFields.progressText.textContent = `${progress}%`;
            }
        }
        
        // Update stats fields with current values (only during processing)
        if (metrics.originalImage) {
            if (this.statFields.originalSize) {
                this.statFields.originalSize.textContent = this.formatBytes(metrics.originalImage.size || 0);
            }
            if (this.statFields.originalFormat) {
                this.statFields.originalFormat.textContent = metrics.originalImage.format || '-';
            }
            if (this.statFields.originalDimensions && metrics.originalImage.width && metrics.originalImage.height) {
                this.statFields.originalDimensions.textContent = `${metrics.originalImage.width} × ${metrics.originalImage.height}`;
            }
        }
        
        if (metrics.processedImage) {
            if (this.statFields.processedSize) {
                this.statFields.processedSize.textContent = this.formatBytes(metrics.processedImage.size || 0);
            }
            if (this.statFields.finalFormat) {
                this.statFields.finalFormat.textContent = metrics.processedImage.format || '-';
            }
        }
        
        if (compressionMetrics) {
            if (this.statFields.compressionRatio) {
                this.statFields.compressionRatio.textContent = `${compressionMetrics.ratio}%`;
            }
        }
        
        if (this.statFields.elapsedTime && metrics.elapsedTime) {
            this.statFields.elapsedTime.textContent = `${(metrics.elapsedTime / 1000).toFixed(1)}s`;
        }
        
        if (this.statFields.attempts) {
            this.statFields.attempts.textContent = (metrics.compressionAttempts?.length || 0).toString();
        }
        
        if (this.statFields.processingStatus) {
            if (metrics.currentStage) {
                const stage = metrics.stages?.[metrics.currentStage];
                this.statFields.processingStatus.textContent = stage?.description || stage?.name || 'Processing';
            } else if (hasErrors) {
                this.statFields.processingStatus.textContent = 'Error';
            } else {
                this.statFields.processingStatus.textContent = 'Ready';
            }
        }
        
        // Update compression chart
        this.updateCompressionChart(metrics);
        
        // Update log entries
        this.updateProcessingLog(metrics);
        
        // Update analysis display if analysis data is available
        if (metrics.analysis && Object.keys(metrics.analysis).length > 0) {
            this.updateAnalysisDisplay(metrics.analysis);
        }
    }
    
    /**
     * Update the compression comparison chart
     * @param {Object} metrics - Metrics data
     */
    updateCompressionChart(metrics) {
        const compressionBars = document.getElementById('compressionBars');
        if (!compressionBars) return;
        
        const originalSize = metrics.originalImage?.size || 0;
        const currentSize = metrics.processedImage?.size || originalSize;
        const targetSize = originalSize > (window.CONFIG?.MAX_URL_LENGTH || 8192) ? 
            (window.CONFIG?.MAX_URL_LENGTH || 8192) / 1.1 : originalSize; // 10% buffer
        
        // Clear existing bars
        compressionBars.innerHTML = '';
        
        // Create bars with proper scaling
        const maxSize = Math.max(originalSize, targetSize, currentSize);
        
        if (maxSize === 0) return; // Avoid division by zero
        
        // Original size bar
        const originalBar = document.createElement('div');
        originalBar.className = 'chart-bar original-bar';
        originalBar.style.height = `${(originalSize / maxSize) * 100}%`;
        originalBar.title = `Original: ${this.formatBytes(originalSize)}`;
        compressionBars.appendChild(originalBar);
        
        // Target size bar
        const targetBar = document.createElement('div');
        targetBar.className = 'chart-bar target-bar';
        targetBar.style.height = `${(targetSize / maxSize) * 100}%`;
        targetBar.title = `Target: ${this.formatBytes(targetSize)}`;
        compressionBars.appendChild(targetBar);
        
        // Current size bar
        const currentBar = document.createElement('div');
        currentBar.className = 'chart-bar current-bar';
        currentBar.style.height = `${(currentSize / maxSize) * 100}%`;
        currentBar.title = `Current: ${this.formatBytes(currentSize)}`;
        compressionBars.appendChild(currentBar);
        
        // Add size labels inside bars
        originalBar.textContent = this.formatBytes(originalSize, true);
        targetBar.textContent = this.formatBytes(targetSize, true);
        currentBar.textContent = this.formatBytes(currentSize, true);
    }
    
    /**
     * Update the processing log
     * @param {Object} metrics - Metrics data
     */
    updateProcessingLog(metrics) {
        if (!this.logEntriesContainer) return;
        
        // Clear log if requested
        if (metrics.startTime && !this.logStartTime) {
            this.logEntriesContainer.innerHTML = '';
            this.logStartTime = metrics.startTime;
            this.addLogEntry('Starting image processing', 'info');
        }
        
        // Add entries for stage changes
        if (metrics.currentStage && this.lastStage !== metrics.currentStage) {
            this.lastStage = metrics.currentStage;
            const stage = metrics.stages?.[metrics.currentStage];
            this.addLogEntry(`${stage?.description || stage?.name || metrics.currentStage}`, 'stage');
        }
        
        // Add compression attempts
        const attempts = metrics.compressionAttempts || [];
        if (attempts.length > (this.lastAttemptCount || 0)) {
            const newAttempts = attempts.slice(this.lastAttemptCount || 0);
            newAttempts.forEach(attempt => {
                let message = `Compression attempt: `;
                
                if (attempt.format) {
                    message += `${attempt.format.split('/')[1].toUpperCase()} `;
                }
                
                if (attempt.quality) {
                    message += `quality ${Math.round(attempt.quality * 100)}% `;
                }
                
                if (attempt.width && attempt.height) {
                    message += `${attempt.width}×${attempt.height} `;
                }
                
                if (attempt.size) {
                    message += `= ${this.formatBytes(attempt.size)}`;
                }
                
                const type = attempt.success ? 'success' : 'attempt';
                this.addLogEntry(message, type);
            });
            
            this.lastAttemptCount = attempts.length;
        }
        
        // Add errors
        const errors = metrics.errors || [];
        if (errors.length > (this.lastErrorCount || 0)) {
            const newErrors = errors.slice(this.lastErrorCount || 0);
            newErrors.forEach(error => {
                this.addLogEntry(error.message, 'error');
            });
            
            this.lastErrorCount = errors.length;
        }
        
        // Add completion
        if (metrics.completed && !this.loggedCompletion) {
            this.loggedCompletion = true;
            
            if (metrics.processedImage?.size && metrics.originalImage?.size) {
                const reductionPercent = ((1 - (metrics.processedImage.size / metrics.originalImage.size)) * 100).toFixed(1);
                    
                this.addLogEntry(
                    `Processing complete - Reduced from ${this.formatBytes(metrics.originalImage.size)} to ${this.formatBytes(metrics.processedImage.size)} (${reductionPercent}%)`,
                    'complete'
                );
            } else {
                this.addLogEntry('Processing complete', 'complete');
            }
        }
    }
    
    /**
     * Add entry to processing log
     * @param {string} message - Log message
     * @param {string} type - Entry type (info, error, stage, attempt, success, complete)
     */
    addLogEntry(message, type = 'info') {
        if (!this.logEntriesContainer) return;
        
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        
        const timestamp = document.createElement('span');
        timestamp.className = 'log-timestamp';
        
        const now = performance.now();
        const elapsed = now - (this.logStartTime || now);
        timestamp.textContent = `[${(elapsed / 1000).toFixed(1)}s]`;
        
        const messageEl = document.createElement('span');
        messageEl.className = 'log-message';
        messageEl.textContent = message;
        
        entry.appendChild(timestamp);
        entry.appendChild(messageEl);
        this.logEntriesContainer.appendChild(entry);
        
        // Auto-scroll to bottom
        this.logEntriesContainer.scrollTop = this.logEntriesContainer.scrollHeight;
    }
    
    /**
     * Update analysis display with results
     * @param {Object} analysis - Analysis results
     */
    updateAnalysisDisplay(analysis) {
        if (!this.analysisFields) return;
        
        const { imageType, imageDimensions, hasTransparency, colorCount, colorDepth, 
                entropy, edgeComplexity, bytesPerPixel, formatRankings, 
                minSavings, likelySavings, maxSavings } = this.analysisFields;
        
        // Basic properties
        if (imageType && (analysis.imageType || analysis.analysis?.imageType)) {
            imageType.textContent = this.capitalizeFirstLetter(analysis.imageType || analysis.analysis?.imageType);
        }
        
        if (imageDimensions && (analysis.dimensions || analysis.analysis?.dimensions)) {
            const dims = analysis.dimensions || analysis.analysis?.dimensions;
            imageDimensions.textContent = `${dims.width} × ${dims.height}`;
        }
        
        // Detailed properties
        const analysisData = analysis.analysis || analysis;
        
        if (hasTransparency && analysisData.hasTransparency !== undefined) {
            hasTransparency.textContent = analysisData.hasTransparency ? 'Yes' : 'No';
        }
        
        if (colorCount && analysisData.colorCount) {
            colorCount.textContent = analysisData.colorCount.toLocaleString();
        }
        
        if (colorDepth && analysisData.colorDepth) {
            colorDepth.textContent = `${analysisData.colorDepth}-bit`;
        }
        
        if (entropy && analysisData.entropy) {
            entropy.textContent = `${analysisData.entropy} bits`;
        }
        
        if (edgeComplexity && analysisData.edgeComplexity) {
            edgeComplexity.textContent = `${analysisData.edgeComplexity}`;
        }
        
        if (bytesPerPixel && analysisData.avgBytesPerPixel) {
            bytesPerPixel.textContent = analysisData.avgBytesPerPixel;
        }
        
        // Format rankings
        const recommendations = analysis.recommendations || {};
        if (formatRankings && recommendations.formatRankings) {
            formatRankings.innerHTML = '';
            
            recommendations.formatRankings.forEach((format, index) => {
                const formatEl = document.createElement('div');
                formatEl.className = 'format-rank';
                
                const formatName = format.format.split('/')[1].toUpperCase();
                const qualityPercent = Math.round(format.quality * 100);
                
                formatEl.innerHTML = `
                    <span class="rank-number">#${index + 1}</span>
                    <span class="format-name">${formatName}</span>
                    <span class="format-quality">Quality: ${qualityPercent}%</span>
                `;
                
                formatRankings.appendChild(formatEl);
            });
        }
        
        // Savings estimates
        if (recommendations.estimatedSavings) {
            const savings = recommendations.estimatedSavings;
            
            if (minSavings) {
                minSavings.textContent = `${savings.minPercent}% (${this.formatBytes(savings.minSavedBytes)})`;
            }
            
            if (likelySavings) {
                likelySavings.textContent = `${savings.likelyPercent}% (${this.formatBytes(savings.likelySavedBytes)})`;
            }
            
            if (maxSavings) {
                maxSavings.textContent = `${savings.maxPercent}% (${this.formatBytes(savings.maxSavedBytes)})`;
            }
            
            // Update savings range chart
            this.updateSavingsChart(savings);
        }
    }
    
    /**
     * Update savings range visualization
     * @param {Object} savings - Savings data
     */
    updateSavingsChart(savings) {
        const minEl = document.getElementById('savingsRangeMin');
        const likelyEl = document.getElementById('savingsRangeLikely');
        const maxEl = document.getElementById('savingsRangeMax');
        
        if (!minEl || !likelyEl || !maxEl) return;
        
        const total = 100; // 100%
        const minWidth = savings.minPercent;
        const likelyWidth = savings.likelyPercent - savings.minPercent;
        const maxWidth = savings.maxPercent - savings.likelyPercent;
        
        minEl.style.width = `${minWidth}%`;
        likelyEl.style.width = `${likelyWidth}%`;
        maxEl.style.width = `${maxWidth}%`;
    }
    
    /**
     * Format bytes to human-readable string
     * @param {number} bytes - Number of bytes
     * @param {boolean} [short=false] - Use short format
     * @returns {string} Formatted size
     */
    formatBytes(bytes, short = false) {
        if (bytes === 0) return short ? '0' : '0 B';
        
        const units = short ? ['', 'K', 'M'] : ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024));
        
        const value = (bytes / Math.pow(1024, i)).toFixed(short ? 0 : 2);
        return short ? `${value}${units[i]}` : `${value} ${units[i]}`;
    }
    
    /**
     * Capitalize first letter of a string
     * @param {string} str - Input string
     * @returns {string} Capitalized string
     */
    capitalizeFirstLetter(str) {
        return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    }
};
