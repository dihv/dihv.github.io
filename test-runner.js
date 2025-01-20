// test-suite.js

class TestRunner {
    constructor() {
        this.tests = [];
        this.results = {
            passed: 0,
            failed: 0,
            total: 0
        };
    }

    async runTests() {
        console.log('Starting test suite...');
        const startTime = performance.now();

        for (const test of this.tests) {
            try {
                console.log(`Running test: ${test.name}`);
                await test.fn();
                this.results.passed++;
                this.logSuccess(test.name);
            } catch (error) {
                this.results.failed++;
                this.logFailure(test.name, error);
            }
            this.results.total++;
        }

        const endTime = performance.now();
        this.logSummary(endTime - startTime);
    }

    addTest(name, fn) {
        this.tests.push({ name, fn });
    }

    logSuccess(testName) {
        console.log(`✅ ${testName} passed`);
    }

    logFailure(testName, error) {
        console.error(`❌ ${testName} failed:`, error);
    }

    logSummary(duration) {
        console.log(`
Test Summary:
------------
Total tests: ${this.results.total}
Passed: ${this.results.passed}
Failed: ${this.results.failed}
Duration: ${duration.toFixed(2)}ms
        `);
    }

    // Assertion helpers
    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
        }
    }

    assertMatch(value, pattern, message) {
        if (!pattern.test(value)) {
            throw new Error(`${message || 'Pattern match failed'}: ${value} does not match ${pattern}`);
        }
    }

    assertTrue(value, message) {
        if (!value) {
            throw new Error(message || 'Expected true, got false');
        }
    }

    assertFalse(value, message) {
        if (value) {
            throw new Error(message || 'Expected false, got true');
        }
    }
}

// Test Cases
class BitStreamTests {
    static async runAll() {
        const runner = new TestRunner();
        
        // BitStreamEncoder tests
        runner.addTest('Constructor validates safe chars', async () => {
            const encoder = new BitStreamEncoder(CONFIG.SAFE_CHARS);
            runner.assertTrue(encoder instanceof BitStreamEncoder);
        });

        runner.addTest('Rejects empty safe chars', async () => {
            try {
                new BitStreamEncoder('');
                throw new Error('Should have thrown error');
            } catch (error) {
                runner.assertTrue(error.message.includes('Invalid safeChars'));
            }
        });

        runner.addTest('Rejects duplicate safe chars', async () => {
            try {
                new BitStreamEncoder('AAB');
                throw new Error('Should have thrown error');
            } catch (error) {
                runner.assertTrue(error.message.includes('duplicate characters'));
            }
        });

        // Encoding/Decoding tests
        runner.addTest('Encodes and decodes small data', async () => {
            const encoder = new BitStreamEncoder(CONFIG.SAFE_CHARS);
            const data = new Uint8Array([1, 2, 3, 4]);
            const encoded = await encoder.encodeBits(data);
            const decoded = encoder.decodeBits(encoded);
            
            runner.assertTrue(decoded instanceof Uint8Array);
            runner.assertEqual(decoded.length, data.length);
            runner.assertTrue(decoded.every((val, i) => val === data[i]));
        });

        runner.addTest('Handles empty data correctly', async () => {
            const encoder = new BitStreamEncoder(CONFIG.SAFE_CHARS);
            try {
                await encoder.encodeBits(new Uint8Array(0));
                throw new Error('Should have thrown error');
            } catch (error) {
                runner.assertTrue(error.message.includes('Input must be'));
            }
        });

        await runner.runTests();
        return runner.results;
    }
}

class ImageProcessorTests {
    static async runAll() {
        const runner = new TestRunner();

        // Image format detection tests
        runner.addTest('Detects JPEG format', async () => {
            const jpegSignature = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
            const format = new ImageProcessor().detectImageFormat(jpegSignature.buffer);
            runner.assertEqual(format, 'image/jpeg');
        });

        runner.addTest('Detects PNG format', async () => {
            const pngSignature = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
            const format = new ImageProcessor().detectImageFormat(pngSignature.buffer);
            runner.assertEqual(format, 'image/png');
        });

        // Compression strategy tests
        runner.addTest('Selects appropriate compression strategy', async () => {
            const processor = new ImageProcessor();
            const mockFile = new File([new Uint8Array(1000)], 'test.jpg', { type: 'image/jpeg' });
            const strategy = await processor.detectOptimalFormat(mockFile);
            runner.assertTrue(CONFIG.SUPPORTED_INPUT_FORMATS.includes(strategy));
        });

        await runner.runTests();
        return runner.results;
    }
}

class ImageViewerTests {
    static async runAll() {
        const runner = new TestRunner();

        // URL validation tests
        runner.addTest('Validates encoded data', async () => {
            const viewer = new ImageViewer();
            try {
                viewer.validateEncodedData('invalid!@#$chars');
                throw new Error('Should have thrown error');
            } catch (error) {
                runner.assertTrue(error.message.includes('invalid characters'));
            }
        });

        runner.addTest('Handles missing data', async () => {
            const viewer = new ImageViewer();
            try {
                viewer.validateEncodedData('');
                throw new Error('Should have thrown error');
            } catch (error) {
                runner.assertTrue(error.message.includes('Invalid or missing'));
            }
        });

        await runner.runTests();
        return runner.results;
    }
}

// Integration Tests
class IntegrationTests {
    static async runAll() {
        const runner = new TestRunner();

        runner.addTest('Full encode-decode cycle', async () => {
            const encoder = new BitStreamEncoder(CONFIG.SAFE_CHARS);
            const originalData = new Uint8Array([1, 2, 3, 4, 5]);
            
            // Encode
            const encoded = await encoder.encodeBits(originalData);
            runner.assertTrue(encoded.length > 0);
            runner.assertTrue([...encoded].every(char => CONFIG.SAFE_CHARS.includes(char)));
            
            // Decode
            const decoded = encoder.decodeBits(encoded);
            runner.assertTrue(decoded instanceof Uint8Array);
            runner.assertEqual(decoded.length, originalData.length);
            runner.assertTrue(decoded.every((val, i) => val === originalData[i]));
        });

        runner.addTest('URL length constraints', async () => {
            const encoder = new BitStreamEncoder(CONFIG.SAFE_CHARS);
            const largeData = new Uint8Array(10000);
            try {
                const encoded = await encoder.encodeBits(largeData);
                runner.assertTrue(encoded.length <= CONFIG.MAX_URL_LENGTH);
            } catch (error) {
                runner.assertTrue(error.message.includes('exceeds maximum'));
            }
        });

        await runner.runTests();
        return runner.results;
    }
}

// Run all tests
async function runAllTests() {
    console.log('Running all test suites...');
    
    const results = {
        bitStream: await BitStreamTests.runAll(),
        imageProcessor: await ImageProcessorTests.runAll(),
        imageViewer: await ImageViewerTests.runAll(),
        integration: await IntegrationTests.runAll()
    };
    
    console.log('Final Test Results:', results);
    return results;
}
