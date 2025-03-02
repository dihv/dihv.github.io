/**
 * BitStreamBenchmark.js
 * 
 * Performs a series of benchmarks to determine whether GPU or CPU 
 * processing would be faster for the user's specific device by testing
 * different data sizes that trigger different processing paths.
 */
window.BitStreamBenchmark = class BitStreamBenchmark {
    constructor() {
        this.results = {
            smallDataScore: 0,  // Small data = CPU processing
            largeDataScore: 0,  // Large data = potentially GPU processing
            recommended: 'unknown',
            completed: false,
            details: {
                smallData: { 
                    size: 0,
                    encodeTime: 0,
                    processingPath: 'cpu',
                    totalTime: 0 
                },
                largeData: { 
                    size: 0,
                    encodeTime: 0, 
                    processingPath: 'unknown',
                    totalTime: 0
                }
            },
            device: {
                hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
                deviceMemory: navigator.deviceMemory || 'unknown',
                userAgent: navigator.userAgent,
                gpu: 'unknown',
                gpuSupported: false
            }
        };
        
        // Flag to track if benchmark is currently running
        this.isRunning = false;
        
        // Register this benchmark with the window
        if (!window.benchmarks) {
            window.benchmarks = {};
        }
        window.benchmarks.bitStream = this;
        
        // Event for notifying when benchmark completes
        this.benchmarkCompletedEvent = new CustomEvent('bitstream-benchmark-completed', {
            detail: this.results,
            bubbles: true
        });
    }
    
    /**
     * Check if all required dependencies are available
     * @returns {boolean} True if all dependencies are available
     */
    checkDependencies() {
        if (!window.CONFIG) {
            console.error('Benchmark error: CONFIG not available');
            return false;
        }
        
        if (!window.CONFIG.SAFE_CHARS) {
            console.error('Benchmark error: CONFIG.SAFE_CHARS not available');
            return false;
        }
        
        if (!window.GPUBitStreamEncoder) {
            console.error('Benchmark error: GPUBitStreamEncoder not available');
            return false;
        }
        
        return true;
    }
    
    /**
     * Run benchmarks to determine optimal processing method
     * @returns {Promise<Object>} Benchmark results
     */
    async runBenchmark() {
        if (this.isRunning) {
            return this.results;
        }
        
        // Check dependencies first
        if (!this.checkDependencies()) {
            this.results.error = 'Required dependencies not available';
            this.results.recommended = 'cpu'; // Default to CPU on error
            return this.results;
        }
        
        this.isRunning = true;
        console.log('Starting BitStream benchmark...');
        
        try {
            // Detect device information
            this.detectDeviceInfo();
            
            // Create single encoder instance for testing
            const safeChars = window.CONFIG.SAFE_CHARS;
            const encoder = new window.GPUBitStreamEncoder(safeChars);
            
            // Check if GPU acceleration is available
            this.results.device.gpuSupported = this.isGPUSupported(encoder);
            
            // Detect GPU information if available
            if (this.results.device.gpuSupported && encoder.gl) {
                this.detectGPUInfo(encoder.gl);
            }
            
            // Test small data performance (will use CPU path)
            const smallDataSize = 50; // Bytes, small enough to force CPU path
            const smallTestData = this.generateTestData(smallDataSize);
            
            const smallDataResults = await this.benchmarkProcessing(encoder, smallTestData);
            this.results.details.smallData = {
                size: smallDataSize,
                encodeTime: smallDataResults.encodeTime,
                processingPath: 'cpu',
                totalTime: smallDataResults.totalTime
            };
            this.results.smallDataScore = 1000 / smallDataResults.totalTime; // Normalize to higher = better
            
            // Test larger data performance (may use GPU if available)
            const largeDataSize = 200 * 1024; // 200KB - large enough for GPU path
            const largeTestData = this.generateTestData(largeDataSize);
            
            const largeDataResults = await this.benchmarkProcessing(encoder, largeTestData);
            const processingPath = this.results.device.gpuSupported ? 'gpu' : 'cpu';
            
            this.results.details.largeData = {
                size: largeDataSize,
                encodeTime: largeDataResults.encodeTime,
                processingPath: processingPath,
                totalTime: largeDataResults.totalTime
            };
            this.results.largeDataScore = 1000 / largeDataResults.totalTime; // Normalize to higher = better
            
            // Calculate normalized scores
            // Normalize by data size to get a fair comparison (time per KB)
            const smallNormalized = this.results.smallDataScore * smallDataSize / 1024;
            const largeNormalized = this.results.largeDataScore * largeDataSize / 1024;
            
            // Determine recommendation
            // If large data (GPU path) is significantly faster when normalized by size
            if (this.results.device.gpuSupported && largeNormalized > smallNormalized * 1.1) {
                this.results.recommended = 'gpu';
            } else {
                this.results.recommended = 'cpu';
            }
            
            this.results.completed = true;
            console.log('BitStream benchmark completed:', this.results);
            
            // Dispatch event to notify completion
            document.dispatchEvent(this.benchmarkCompletedEvent);
            
            return this.results;
        } catch (error) {
            console.error('Benchmark error:', error);
            this.results.error = error.message;
            this.results.recommended = 'cpu'; // Default to CPU on error
            
            // Still dispatch event
            document.dispatchEvent(this.benchmarkCompletedEvent);
            
            return this.results;
        } finally {
            this.isRunning = false;
        }
    }
    
    /**
     * Check if GPU acceleration is supported by the encoder
     * @param {Object} encoder - BitStream encoder instance
     * @returns {boolean} - Whether GPU acceleration is supported
     */
    isGPUSupported(encoder) {
        // Check if the encoder was able to initialize WebGL
        if (!encoder.gl) {
            return false;
        }
        
        // Check if the WebGL context is not lost
        if (encoder.gl.isContextLost()) {
            return false;
        }
        
        // Check if the encoder has GPU acceleration enabled flag set
        if (!encoder.gpuAccelerationEnabled) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Generate test data for benchmarking
     * @param {number} dataSize - Size of test data in bytes
     * @returns {ArrayBuffer} Test data
     */
    generateTestData(dataSize) {
        const data = new Uint8Array(dataSize);
        
        // Fill with semi-realistic image data patterns
        for (let i = 0; i < dataSize; i++) {
            if (i % 4 === 3) {
                // Alpha channel (mostly opaque)
                data[i] = 255;
            } else {
                // Color channels (with some patterns)
                const pattern = Math.floor(i / 256) % 3;
                
                if (pattern === 0) {
                    // Gradual changes (like photos)
                    data[i] = (i + (i % 32 * 8)) % 256;
                } else if (pattern === 1) {
                    // Sharp edges (like graphics)
                    data[i] = (i % 32 < 16) ? 240 : 32;
                } else {
                    // Random (varied textures)
                    data[i] = Math.floor(Math.random() * 256);
                }
            }
        }
        
        return data.buffer;
    }
    
    /**
     * Benchmark processing performance for a given data size
     * @param {Object} encoder - BitStream encoder instance
     * @param {ArrayBuffer} testData - Test data
     * @returns {Object} Benchmark results
     */
    async benchmarkProcessing(encoder, testData) {
        try {
            // Track times
            const startEncodeTime = performance.now();
            
            // Convert to bits and encode
            const bits = await encoder.toBitArray(testData);
            const encoded = await encoder.encodeBits(bits);
            
            const endEncodeTime = performance.now();
            
            // Initialize decoder
            const decoder = new window.GPUBitStreamDecoder(window.CONFIG.SAFE_CHARS);
            
            // Decode back to binary
            const startDecodeTime = performance.now();
            await decoder.decodeBits(encoded);
            const endDecodeTime = performance.now();
            
            // Calculate timing metrics
            const encodeTime = endEncodeTime - startEncodeTime;
            const decodeTime = endDecodeTime - startDecodeTime;
            const totalTime = encodeTime + decodeTime;
            
            return {
                encodeTime: encodeTime,
                decodeTime: decodeTime,
                totalTime: totalTime
            };
        } catch (error) {
            console.error('Benchmark error:', error);
            // Return fallback values
            return {
                encodeTime: 1000,
                decodeTime: 1000,
                totalTime: 2000,
                error: error.message
            };
        }
    }
    
    /**
     * Check if WebGL2 is supported
     * @returns {boolean} Whether WebGL2 is supported
     */
    hasWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2');
            if (!gl) return false;
            
            // Check that we can get a valid context
            const isContextValid = !gl.isContextLost();
            
            // Clean up
            const loseContext = gl.getExtension('WEBGL_lose_context');
            if (loseContext) loseContext.loseContext();
            
            return isContextValid;
        } catch (e) {
            console.warn('WebGL support check error:', e);
            return false;
        }
    }
    
    /**
     * Detect device information
     */
    detectDeviceInfo() {
        // CPU info
        this.results.device.hardwareConcurrency = navigator.hardwareConcurrency || 'unknown';
        this.results.device.deviceMemory = navigator.deviceMemory || 'unknown';
        this.results.device.userAgent = navigator.userAgent;
        
        // Try to get more detailed info in supported browsers
        if (window.navigator.userAgentData && window.navigator.userAgentData.getHighEntropyValues) {
            navigator.userAgentData.getHighEntropyValues([
                "platformVersion", "architecture", "model", "uaFullVersion"
            ]).then(ua => {
                this.results.device.platform = ua.platform;
                this.results.device.architecture = ua.architecture;
                this.results.device.model = ua.model;
                this.results.device.fullVersion = ua.uaFullVersion;
            }).catch(error => {
                console.warn('Could not get high entropy values:', error);
            });
        }
    }
    
    /**
     * Detect GPU information using WebGL
     * @param {WebGLRenderingContext} gl - WebGL context
     */
    detectGPUInfo(gl) {
        if (!gl) return;
        
        try {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                
                this.results.device.gpu = {
                    vendor: vendor,
                    renderer: renderer
                };
            }
        } catch (error) {
            console.warn('Could not detect GPU info:', error);
        }
    }
    
    /**
     * Apply benchmark results to encoder configuration
     * @param {Object} encoder - Encoder instance to configure
     */
    applyResults(encoder) {
        if (!this.results.completed) {
            console.warn('Benchmark not completed, using default configuration');
            return;
        }
        
        if (!encoder) {
            console.warn('No encoder provided to apply benchmark results');
            return;
        }
        
        // Note: we can't actually force CPU or GPU mode after initialization
        // But we can log the recommendation for informational purposes
        console.log(`Benchmark recommends ${this.results.recommended.toUpperCase()} processing`);
        
        // We cannot force the encoder to use a specific mode, but we can track the recommendation
        encoder._recommendedMode = this.results.recommended;
    }
    
    /**
     * Get a user-friendly summary of benchmark results
     * @returns {string} Benchmark summary
     */
    getSummary() {
        if (!this.results.completed) {
            return 'Benchmark not yet completed.';
        }
        
        let summary = `BitStream Benchmark Results:\n`;
        
        const smallDataMS = this.results.details.smallData.totalTime.toFixed(2);
        const largeDataMS = this.results.details.largeData.totalTime.toFixed(2);
        
        // Calculate speed per KB
        const smallDataKB = this.results.details.smallData.size / 1024;
        const largeDataKB = this.results.details.largeData.size / 1024;
        
        const smallDataSpeedPerKB = (this.results.details.smallData.totalTime / smallDataKB).toFixed(2);
        const largeDataSpeedPerKB = (this.results.details.largeData.totalTime / largeDataKB).toFixed(2);
        
        summary += `- Small data (${smallDataKB.toFixed(2)}KB): ${smallDataMS}ms (${smallDataSpeedPerKB}ms/KB)\n`;
        summary += `- Large data (${largeDataKB.toFixed(2)}KB): ${largeDataMS}ms (${largeDataSpeedPerKB}ms/KB)\n`;
        
        if (this.results.device.gpuSupported) {
            summary += `- GPU acceleration available\n`;
        } else {
            summary += `- GPU acceleration not available\n`;
        }
        
        summary += `- Recommended: ${this.results.recommended.toUpperCase()} processing path\n`;
        
        if (this.results.device.gpu && this.results.device.gpu.renderer) {
            summary += `- GPU detected: ${this.results.device.gpu.renderer}\n`;
        }
        
        return summary;
    }
    
    /**
     * Display benchmark results in the UI
     */
    displayResults() {
        if (!this.results.completed) return;
        
        // Check if we have a container to display results
        const container = document.getElementById('benchmarkResults');
        if (!container) {
            // Create a container if it doesn't exist
            const benchmarkSection = document.createElement('div');
            benchmarkSection.id = 'benchmarkContainer';
            benchmarkSection.className = 'benchmark-container';
            benchmarkSection.innerHTML = `
                <div class="benchmark-header">
                    <h3>Performance Benchmark</h3>
                    <button class="toggle-button" data-target="benchmarkResults">
                        <span class="toggle-icon">▼</span>
                    </button>
                </div>
                <div id="benchmarkResults" class="benchmark-results">
                    <div class="benchmark-summary"></div>
                    <div class="benchmark-chart"></div>
                </div>
            `;
            
            // Style the benchmark container
            const style = document.createElement('style');
            style.textContent = `
                .benchmark-container {
                    background: var(--background-color, #fafafa);
                    border: 1px solid var(--border-color, #e0e0e0);
                    border-radius: 8px;
                    margin: 1rem 0;
                    overflow: hidden;
                }
                
                .benchmark-header {
                    display: flex;
                    align-items: center;
                    padding: 1rem;
                    border-bottom: 1px solid var(--border-color, #e0e0e0);
                }
                
                .benchmark-header h3 {
                    margin: 0;
                    color: var(--text-color, #333);
                }
                
                .benchmark-results {
                    padding: 1rem;
                }
                
                .benchmark-summary {
                    margin-bottom: 1rem;
                    white-space: pre-line;
                }
                
                .benchmark-chart {
                    display: flex;
                    height: 200px;
                    align-items: flex-end;
                    gap: 1rem;
                    border-bottom: 1px solid var(--border-color, #e0e0e0);
                    padding-bottom: 1rem;
                }
                
                .benchmark-bar {
                    flex: 1;
                    background: var(--primary-color, #2196F3);
                    position: relative;
                    text-align: center;
                    color: white;
                    padding-top: 0.5rem;
                    transition: height 0.5s ease;
                    min-height: 2rem;
                }
                
                .benchmark-bar.cpu-bar {
                    background: #4caf50;
                }
                
                .benchmark-bar.gpu-bar {
                    background: #2196f3;
                }
                
                .benchmark-bar.recommended {
                    border: 2px solid #ff9800;
                }
                
                .bar-label {
                    position: absolute;
                    bottom: -2rem;
                    left: 0;
                    right: 0;
                    text-align: center;
                    color: var(--text-color, #333);
                }
                
                .device-info {
                    margin-top: 2rem;
                    font-size: 0.9rem;
                    color: var(--muted-text, #666);
                }
            `;
            
            document.head.appendChild(style);
            
            // Find a place to insert the benchmark results
            const projectInfo = document.querySelector('.project-info');
            if (projectInfo) {
                projectInfo.parentNode.insertBefore(benchmarkSection, projectInfo.nextSibling);
            } else {
                const container = document.querySelector('.container');
                if (container && container.firstChild) {
                    container.insertBefore(benchmarkSection, container.firstChild.nextSibling);
                }
            }
        }
        
        // Update the benchmark results display
        const resultsContainer = document.getElementById('benchmarkResults');
        if (!resultsContainer) return;
        
        // Add summary
        const summaryDiv = resultsContainer.querySelector('.benchmark-summary') || document.createElement('div');
        summaryDiv.className = 'benchmark-summary';
        summaryDiv.textContent = this.getSummary().replace(/\n/g, '\n• ').replace('BitStream Benchmark Results:\n', '');
        
        // Add chart
        const chartDiv = resultsContainer.querySelector('.benchmark-chart') || document.createElement('div');
        chartDiv.className = 'benchmark-chart';
        chartDiv.innerHTML = '';
        
        // Calculate speeds per KB for fair comparison
        const smallDataKB = this.results.details.smallData.size / 1024;
        const largeDataKB = this.results.details.largeData.size / 1024;
        
        const smallDataSpeedPerKB = this.results.details.smallData.totalTime / smallDataKB;
        const largeDataSpeedPerKB = this.results.details.largeData.totalTime / largeDataKB;
        
        // Invert times so taller = better (lower time = higher bar)
        const maxTime = Math.max(smallDataSpeedPerKB, largeDataSpeedPerKB);
        const smallScaledHeight = (maxTime / smallDataSpeedPerKB) * 80; // 80% of container height
        const largeScaledHeight = (maxTime / largeDataSpeedPerKB) * 80;
        
        // Add bars for comparison
        const smallBar = document.createElement('div');
        smallBar.className = `benchmark-bar cpu-bar ${this.results.recommended === 'cpu' ? 'recommended' : ''}`;
        smallBar.style.height = `${smallScaledHeight}%`;
        smallBar.textContent = `Small Data (CPU)`;
        
        const smallLabel = document.createElement('div');
        smallLabel.className = 'bar-label';
        smallLabel.textContent = `${smallDataSpeedPerKB.toFixed(2)} ms/KB`;
        smallBar.appendChild(smallLabel);
        
        chartDiv.appendChild(smallBar);
        
        // Add large data bar (potentially GPU)
        const largeBar = document.createElement('div');
        largeBar.className = `benchmark-bar ${this.results.device.gpuSupported ? 'gpu-bar' : 'cpu-bar'} ${this.results.recommended === 'gpu' ? 'recommended' : ''}`;
        largeBar.style.height = `${largeScaledHeight}%`;
        largeBar.textContent = `Large Data ${this.results.device.gpuSupported ? '(GPU)' : '(CPU)'}`;
        
        const largeLabel = document.createElement('div');
        largeLabel.className = 'bar-label';
        largeLabel.textContent = `${largeDataSpeedPerKB.toFixed(2)} ms/KB`;
        largeBar.appendChild(largeLabel);
        
        chartDiv.appendChild(largeBar);
        
        // Add device info
        const deviceInfoDiv = document.createElement('div');
        deviceInfoDiv.className = 'device-info';
        
        let deviceInfo = `Device Info: `;
        deviceInfo += `${this.results.device.hardwareConcurrency} cores`;
        
        if (this.results.device.deviceMemory && this.results.device.deviceMemory !== 'unknown') {
            deviceInfo += `, ${this.results.device.deviceMemory}GB RAM`;
        }
        
        if (this.results.device.gpu && this.results.device.gpu.renderer) {
            deviceInfo += `, ${this.results.device.gpu.renderer}`;
        }
        
        deviceInfoDiv.textContent = deviceInfo;
        
        // Add components to the container
        resultsContainer.innerHTML = '';
        resultsContainer.appendChild(summaryDiv);
        resultsContainer.appendChild(chartDiv);
        resultsContainer.appendChild(deviceInfoDiv);
        
        // Add toggle functionality
        const toggleButton = document.querySelector('.toggle-button[data-target="benchmarkResults"]');
        if (toggleButton) {
            toggleButton.addEventListener('click', () => {
                const targetElement = document.getElementById('benchmarkResults');
                if (!targetElement) return;
                
                const isVisible = targetElement.style.display !== 'none';
                targetElement.style.display = isVisible ? 'none' : 'block';
                
                const iconEl = toggleButton.querySelector('.toggle-icon');
                if (iconEl) {
                    iconEl.textContent = isVisible ? '▶' : '▼';
                }
            });
        }
    }
};
