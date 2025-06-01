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
            encodingEfficiency: 0,
            optimalChunkSize: 1024,
            recommendedMode: 'cpu',
            completed: false,
            details: {
                smallData: { size: 0, time: 0, efficiency: 0 },
                mediumData: { size: 0, time: 0, efficiency: 0 },
                largeData: { size: 0, time: 0, efficiency: 0 }
            },
            device: {
                hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
                deviceMemory: navigator.deviceMemory || 'unknown',
                userAgent: navigator.userAgent,
                urlLimits: this.detectUrlLimits(),
                performance: 'unknown'
            },
            optimization: {
                characterSetEfficiency: 0,
                optimalDataSizes: [],
                compressionFactors: {},
                urlEncodingOverhead: 0
            }
        };
        
        this.isRunning = false;
        
        // Enhanced configuration
        this.testSizes = [
            { name: 'small', size: 32, description: 'Tiny images/icons' },
            { name: 'medium', size: 1024, description: 'Small photos' },
            { name: 'large', size: 8192, description: 'Medium photos' }
        ];
        
        // Register benchmark globally
        if (!window.benchmarks) {
            window.benchmarks = {};
        }
        window.benchmarks.bitStream = this;
        
        console.log('Enhanced BitStream Benchmark initialized');
    }
    
    /**
     * Detect browser URL limits
     */
    detectUrlLimits() {
        const userAgent = navigator.userAgent;
        const limits = window.CONFIG?.BROWSER_LIMITS || {};
        
        // Detect browser type and return appropriate limit
        if (userAgent.includes('Trident/') || userAgent.includes('MSIE')) {
            return { browser: 'IE', limit: limits.IE || 2083 };
        } else if (userAgent.includes('Edge/')) {
            return { browser: 'Edge', limit: limits.EDGE || 2048 };
        } else if (userAgent.includes('Chrome/')) {
            return { browser: 'Chrome', limit: limits.CHROME || 8192 };
        } else if (userAgent.includes('Firefox/')) {
            return { browser: 'Firefox', limit: limits.FIREFOX || 65536 };
        } else if (userAgent.includes('Safari/')) {
            return { browser: 'Safari', limit: limits.SAFARI || 80000 };
        }
        
        return { browser: 'Unknown', limit: limits.DEFAULT || 2000 };
    }
    
    /**
     * Enhanced benchmark runner with comprehensive testing
     */
    async runBenchmark() {
        if (this.isRunning) {
            return this.results;
        }
        
        // Check dependencies
        if (!this.checkDependencies()) {
            this.results.error = 'Required dependencies not available';
            this.results.recommendedMode = 'cpu';
            return this.results;
        }
        
        this.isRunning = true;
        console.log('Starting enhanced BitStream benchmark...');
        
        try {
            // Test character set efficiency
            await this.testCharacterSetEfficiency();
            
            // Test encoding performance at different data sizes
            await this.testEncodingPerformance();
            
            // Test URL encoding overhead
            await this.testUrlEncodingOverhead();
            
            // Test compression factors for different image types
            await this.testCompressionFactors();
            
            // Determine optimal configuration
            this.determineOptimalConfiguration();
            
            this.results.completed = true;
            console.log('Enhanced benchmark completed:', this.results);
            
            // Dispatch completion event
            document.dispatchEvent(new CustomEvent('bitstream-benchmark-completed', {
                detail: this.results,
                bubbles: true
            }));
            
            return this.results;
        } catch (error) {
            console.error('Benchmark error:', error);
            this.results.error = error.message;
            this.results.recommendedMode = 'cpu';
            
            document.dispatchEvent(new CustomEvent('bitstream-benchmark-completed', {
                detail: this.results,
                bubbles: true
            }));
            
            return this.results;
        } finally {
            this.isRunning = false;
        }
    }
    
    /**
     * Test character set efficiency
     */
    async testCharacterSetEfficiency() {
        if (!window.CONFIG?.SAFE_CHARS) {
            throw new Error('SAFE_CHARS not available for testing');
        }
        
        const safeChars = window.CONFIG.SAFE_CHARS;
        const radix = safeChars.length;
        
        // Calculate theoretical efficiency
        const bitsPerChar = Math.log2(radix);
        const base64BitsPerChar = 6; // Base64 standard
        const efficiencyRatio = bitsPerChar / base64BitsPerChar;
        
        this.results.optimization.characterSetEfficiency = {
            radix: radix,
            bitsPerChar: bitsPerChar,
            efficiencyVsBase64: efficiencyRatio,
            theoreticalImprovement: `${((efficiencyRatio - 1) * 100).toFixed(1)}%`
        };
        
        console.log(`Character set efficiency: ${radix} chars, ${bitsPerChar.toFixed(2)} bits/char`);
    }
    
    /**
     * Test encoding performance at different data sizes
     */
    async testEncodingPerformance() {
        const encoder = new window.GPUBitStreamEncoder(window.CONFIG.SAFE_CHARS);
        
        for (const testConfig of this.testSizes) {
            const testData = this.generateTestData(testConfig.size);
            
            // Perform multiple runs for accurate timing
            const runs = 5;
            let totalTime = 0;
            let totalOutputSize = 0;
            
            for (let run = 0; run < runs; run++) {
                const startTime = performance.now();
                
                try {
                    const encoded = await encoder.encodeBits(testData);
                    const endTime = performance.now();
                    
                    totalTime += (endTime - startTime);
                    totalOutputSize += encoded.length;
                } catch (error) {
                    console.warn(`Encoding test failed for ${testConfig.name}:`, error);
                    break;
                }
            }
            
            const avgTime = totalTime / runs;
            const avgOutputSize = totalOutputSize / runs;
            const efficiency = testConfig.size / avgOutputSize; // Input bytes per output char
            
            this.results.details[testConfig.name] = {
                size: testConfig.size,
                time: avgTime,
                efficiency: efficiency,
                outputSize: avgOutputSize,
                compressionRatio: avgOutputSize / testConfig.size
            };
            
            console.log(`${testConfig.name} test: ${testConfig.size}B → ${avgOutputSize.toFixed(0)} chars in ${avgTime.toFixed(2)}ms`);
        }
    }
    
    /**
     * Test URL encoding overhead
     */
    async testUrlEncodingOverhead() {
        const testData = this.generateTestData(1024);
        const encoder = new window.GPUBitStreamEncoder(window.CONFIG.SAFE_CHARS);
        
        try {
            // Test raw encoding
            const encoded = await encoder.encodeBits(testData);
            
            // Test URL encoding (should be minimal with our safe chars)
            const urlEncoded = encodeURIComponent(encoded);
            
            const overhead = (urlEncoded.length - encoded.length) / encoded.length;
            
            this.results.optimization.urlEncodingOverhead = {
                rawLength: encoded.length,
                urlEncodedLength: urlEncoded.length,
                overhead: overhead,
                overheadPercent: `${(overhead * 100).toFixed(2)}%`
            };
            
            console.log(`URL encoding overhead: ${(overhead * 100).toFixed(2)}%`);
        } catch (error) {
            console.warn('URL encoding test failed:', error);
        }
    }
    
    /**
     * Test compression factors for different data patterns
     */
    async testCompressionFactors() {
        const patterns = {
            uniform: this.generateUniformData(1024),      // All same values
            random: this.generateRandomData(1024),        // Random data
            gradient: this.generateGradientData(1024),    // Smooth transitions
            text: this.generateTextLikeData(1024)         // Text-like patterns
        };
        
        const encoder = new window.GPUBitStreamEncoder(window.CONFIG.SAFE_CHARS);
        
        for (const [patternName, data] of Object.entries(patterns)) {
            try {
                const startTime = performance.now();
                const encoded = await encoder.encodeBits(data);
                const endTime = performance.now();
                
                const compressionRatio = encoded.length / data.length;
                const efficiency = data.length / encoded.length;
                
                this.results.optimization.compressionFactors[patternName] = {
                    inputSize: data.length,
                    outputSize: encoded.length,
                    compressionRatio: compressionRatio,
                    efficiency: efficiency,
                    time: endTime - startTime
                };
                
                console.log(`${patternName} pattern: ${compressionRatio.toFixed(2)}x compression`);
            } catch (error) {
                console.warn(`Pattern test failed for ${patternName}:`, error);
            }
        }
    }
    
    /**
     * Determine optimal configuration based on test results
     */
    determineOptimalConfiguration() {
        const details = this.results.details;
        
        // Calculate optimal chunk size based on performance curve
        let bestEfficiency = 0;
        let optimalSize = 1024;
        
        for (const [sizeName, result] of Object.entries(details)) {
            if (result.efficiency > bestEfficiency) {
                bestEfficiency = result.efficiency;
                optimalSize = result.size;
            }
        }
        
        this.results.optimalChunkSize = optimalSize;
        this.results.encodingEfficiency = bestEfficiency;
        
        // Determine processing recommendation
        const deviceScore = this.calculateDeviceScore();
        const urlLimit = this.results.device.urlLimits.limit;
        
        // For GitHub Pages, prefer CPU processing to reduce server load
        if (deviceScore > 70 && urlLimit > 4000) {
            this.results.recommendedMode = 'balanced'; // Use GPU for large files only
        } else {
            this.results.recommendedMode = 'cpu'; // Safe default for GitHub Pages
        }
        
        // Set optimal data sizes based on URL limits
        this.results.optimization.optimalDataSizes = [
            Math.floor(urlLimit * 0.3 / bestEfficiency), // Conservative
            Math.floor(urlLimit * 0.5 / bestEfficiency), // Moderate
            Math.floor(urlLimit * 0.7 / bestEfficiency)  // Aggressive
        ];
        
        console.log(`Optimal configuration: ${this.results.recommendedMode} mode, ${optimalSize}B chunks`);
    }
    
    /**
     * Calculate device performance score
     */
    calculateDeviceScore() {
        let score = 0;
        
        // CPU cores
        if (this.results.device.hardwareConcurrency) {
            score += Math.min(this.results.device.hardwareConcurrency * 10, 40);
        }
        
        // Memory
        if (this.results.device.deviceMemory) {
            score += Math.min(this.results.device.deviceMemory * 5, 30);
        }
        
        // Performance from encoding tests
        if (this.results.details.medium.time > 0) {
            const timeScore = Math.max(0, 30 - (this.results.details.medium.time / 10));
            score += timeScore;
        }
        
        return Math.min(score, 100);
    }
    
    /**
     * Generate test data with various patterns
     */
    generateTestData(size) {
        const data = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            // Mix of patterns for realistic test
            if (i % 4 === 0) {
                data[i] = i % 256; // Sequential
            } else if (i % 4 === 1) {
                data[i] = Math.floor(Math.random() * 256); // Random
            } else if (i % 4 === 2) {
                data[i] = Math.floor(Math.sin(i / 10) * 127 + 128); // Smooth
            } else {
                data[i] = (i % 2) * 255; // High contrast
            }
        }
        return data.buffer;
    }
    
    generateUniformData(size) {
        return new Uint8Array(size).fill(128).buffer;
    }
    
    generateRandomData(size) {
        const data = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            data[i] = Math.floor(Math.random() * 256);
        }
        return data.buffer;
    }
    
    generateGradientData(size) {
        const data = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            data[i] = Math.floor((i / size) * 255);
        }
        return data.buffer;
    }
    
    generateTextLikeData(size) {
        const data = new Uint8Array(size);
        const textChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,!?';
        for (let i = 0; i < size; i++) {
            data[i] = textChars.charCodeAt(Math.floor(Math.random() * textChars.length));
        }
        return data.buffer;
    }
    
    /**
     * Check if all required dependencies are available
     */
    checkDependencies() {
        const required = ['CONFIG', 'GPUBitStreamEncoder', 'DirectBaseEncoder'];
        
        for (const dep of required) {
            if (!window[dep]) {
                console.error(`Benchmark dependency missing: ${dep}`);
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Get user-friendly summary of results
     */
    getSummary() {
        if (!this.results.completed) {
            return 'Benchmark not yet completed.';
        }
        
        const charSet = this.results.optimization.characterSetEfficiency;
        const overhead = this.results.optimization.urlEncodingOverhead;
        const urlLimits = this.results.device.urlLimits;
        
        return `Enhanced BitStream Benchmark Results:
        
Character Set: ${charSet.radix} characters (${charSet.bitsPerChar.toFixed(2)} bits/char)
Efficiency vs Base64: ${charSet.theoreticalImprovement} improvement
URL Encoding Overhead: ${overhead.overheadPercent}
Browser Limit: ${urlLimits.browser} (${urlLimits.limit.toLocaleString()} chars)
Optimal Chunk Size: ${this.results.optimalChunkSize} bytes
Recommended Mode: ${this.results.recommendedMode.toUpperCase()}
Device Score: ${this.calculateDeviceScore()}/100

Optimal Data Sizes:
- Conservative: ${this.results.optimization.optimalDataSizes[0]} bytes
- Moderate: ${this.results.optimization.optimalDataSizes[1]} bytes  
- Aggressive: ${this.results.optimization.optimalDataSizes[2]} bytes

Performance Results:
- Small data: ${this.results.details.small.time.toFixed(2)}ms
- Medium data: ${this.results.details.medium.time.toFixed(2)}ms
- Large data: ${this.results.details.large.time.toFixed(2)}ms`;
    }
    
    /**
     * Apply optimization results to application configuration
     */
    applyOptimizations() {
        if (!this.results.completed) {
            console.warn('Cannot apply optimizations: benchmark not completed');
            return;
        }
        
        // Update CONFIG with optimized values
        if (window.CONFIG) {
            window.CONFIG.OPTIMAL_CHUNK_SIZE = this.results.optimalChunkSize;
            window.CONFIG.RECOMMENDED_MODE = this.results.recommendedMode;
            window.CONFIG.DEVICE_URL_LIMIT = this.results.device.urlLimits.limit;
            
            // Update compression settings based on results
            if (this.results.optimization.compressionFactors.random) {
                const randomFactor = this.results.optimization.compressionFactors.random.compressionRatio;
                window.CONFIG.COMPRESSION_EFFICIENCY_FACTOR = randomFactor;
            }
        }
        
        console.log('Applied benchmark optimizations to CONFIG');
    }
};
