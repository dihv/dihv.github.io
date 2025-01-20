// test-suite.js

// Create a sample GIF image (smiley face with transparent background)
function createSampleImage() {
    // GIF header (GIF89a)
    const header = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    
    // Width and height (32x32)
    const dimensions = new Uint8Array([0x20, 0x00, 0x20, 0x00]);
    
    // Global color table flag, color resolution, sort flag, size of global color table
    const flags = new Uint8Array([0x80]); // 1 bit per pixel
    
    // Background color index and pixel aspect ratio
    const bgAndAspect = new Uint8Array([0x00, 0x00]);
    
    // Global color table (2 colors: transparent and yellow)
    const colorTable = new Uint8Array([
        0x00, 0x00, 0x00, // transparent
        0xFF, 0xFF, 0x00  // yellow
    ]);
    
    // Graphics Control Extension
    const graphicsCtrl = new Uint8Array([
        0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00 // transparency enabled
    ]);
    
    // Image Descriptor
    const imageDescriptor = new Uint8Array([
        0x2C, 0x00, 0x00, 0x00, 0x00, // left, top
        0x20, 0x00, 0x20, 0x00,       // width, height
        0x00                          // local color table flag
    ]);
    
    // LZW minimum code size
    const lzwMinCode = new Uint8Array([0x02]);
    
    // Image data blocks (simplified smiley face pattern)
    const imageData = new Uint8Array([
        0x40, 0x01, 0x02, 0x03, // Data sub-block size and compressed data
        0x00  // End of image data
    ]);
    
    // Trailer
    const trailer = new Uint8Array([0x3B]);
    
    // Combine all parts
    const totalLength = header.length + dimensions.length + flags.length + 
                       bgAndAspect.length + colorTable.length + graphicsCtrl.length + 
                       imageDescriptor.length + lzwMinCode.length + imageData.length + 
                       trailer.length;
    
    const gifData = new Uint8Array(totalLength);
    let offset = 0;
    
    [header, dimensions, flags, bgAndAspect, colorTable, graphicsCtrl, 
     imageDescriptor, lzwMinCode, imageData, trailer].forEach(arr => {
        gifData.set(arr, offset);
        offset += arr.length;
    });
    
    return gifData;
}

class TestRunner {
    constructor() {
        this.tests = [];
        this.results = {
            passed: 0,
            failed: 0,
            total: 0
        };
        this.sampleImage = createSampleImage();
    }

    async runTests() {
        console.log('Starting test suite...');
        const startTime = performance.now();

        for (const test of this.tests) {
            try {
                console.log(`Running test: ${test.name}`);
                await test.fn(this.sampleImage);
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

        assertImageFormat(buffer, expectedFormat) {
        const processor = new ImageProcessor();
        const detectedFormat = processor.detectImageFormat(buffer);
        if (detectedFormat !== expectedFormat) {
            throw new Error(`Expected image format ${expectedFormat}, got ${detectedFormat}`);
        }
    }

    assertValidEncoding(encoded) {
        const invalidChars = [...encoded].filter(char => !CONFIG.SAFE_CHARS.includes(char));
        if (invalidChars.length > 0) {
            throw new Error(`Invalid characters in encoding: ${invalidChars.join(', ')}`);
        }
    }

    assertBufferEquals(buffer1, buffer2) {
        const arr1 = new Uint8Array(buffer1);
        const arr2 = new Uint8Array(buffer2);
        
        if (arr1.length !== arr2.length) {
            throw new Error(`Buffer lengths don't match: ${arr1.length} vs ${arr2.length}`);
        }
        
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) {
                throw new Error(`Buffers differ at position ${i}: ${arr1[i]} vs ${arr2[i]}`);
            }
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

                // Test encoding/decoding of sample image
        runner.addTest('Encodes and decodes sample GIF without loss', async (sampleImage) => {
            const encoder = new BitStreamEncoder(CONFIG.SAFE_CHARS);
            const encoded = await encoder.encodeBits(sampleImage);
            
            // Validate encoding
            runner.assertValidEncoding(encoded);
            runner.assertTrue(encoded.length <= CONFIG.MAX_URL_LENGTH);
            
            // Test decoding
            const decoded = encoder.decodeBits(encoded);
            runner.assertBufferEquals(decoded, sampleImage);
            runner.assertImageFormat(decoded, 'image/gif');
        });

         // Test URL-safety of encoding
        runner.addTest('Produces URL-safe output', async (sampleImage) => {
            const encoder = new BitStreamEncoder(CONFIG.SAFE_CHARS);
            const encoded = await encoder.encodeBits(sampleImage);
            
            // Check each character is in safe set
            const allSafe = [...encoded].every(char => CONFIG.SAFE_CHARS.includes(char));
            runner.assertTrue(allSafe);
            
            // Verify no URL encoding needed
            const urlEncoded = encodeURIComponent(encoded);
            runner.assertEqual(encoded, urlEncoded);
        });

        // Test chunk processing
        runner.addTest('Processes data in correct chunk sizes', async (sampleImage) => {
            const encoder = new BitStreamEncoder(CONFIG.SAFE_CHARS);
            const chunkSize = CONFIG.CHUNK_SIZE;
            
            // Process chunks and verify size estimation
            const estimatedSize = encoder.estimateEncodedSize(sampleImage.length);
            const encoded = await encoder.encodeBits(sampleImage);
            
            runner.assertTrue(Math.abs(encoded.length - estimatedSize) <= chunkSize);
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

                // Test format detection of sample image
        runner.addTest('Detects GIF format correctly', async (sampleImage) => {
            const processor = new ImageProcessor();
            const format = processor.detectImageFormat(sampleImage.buffer);
            runner.assertEqual(format, 'image/gif');
        });

        // Test compression strategy selection
        runner.addTest('Selects appropriate compression for GIF', async (sampleImage) => {
            const processor = new ImageProcessor();
            const file = new File([sampleImage], 'test.gif', { type: 'image/gif' });
            const strategy = await processor.detectOptimalFormat(file);
            
            // Should suggest WebP for optimal compression
            runner.assertEqual(strategy, 'image/webp');
        });

        // Test image size validation
        runner.addTest('Validates image size constraints', async (sampleImage) => {
            const processor = new ImageProcessor();
            const encoder = new BitStreamEncoder(CONFIG.SAFE_CHARS);
            
            const willFit = encoder.willFitInUrl(sampleImage.length, CONFIG.MAX_URL_LENGTH);
            runner.assertTrue(willFit);
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
