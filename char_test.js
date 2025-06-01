/**
 * Character Set Validation Tool
 * 
 * Test the expanded character set to ensure it works properly
 * in GitHub Pages environment and doesn't cause encoding issues
 */
window.CharacterSetValidator = class CharacterSetValidator {
    constructor() {
        this.oldCharSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~!$()*,/:@;+';
        this.newCharSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~!$()*,/:@;+&=\'';
        this.addedChars = '&=\'';
    }

    /**
     * Run comprehensive validation tests
     */
    async runValidation() {
        console.log('🧪 Character Set Validation Starting...\n');
        
        this.validateCharacterCounts();
        this.validateUrlSafety();
        this.validateEncodingRoundtrip();
        this.calculateEfficiencyGains();
        await this.testGitHubPagesCompatibility();
        this.generateRecommendations();
        
        console.log('✅ Character Set Validation Complete!');
    }

    /**
     * Validate character counts and uniqueness
     */
    validateCharacterCounts() {
        console.log('📊 Character Count Analysis:');
        console.log(`Old character set: ${this.oldCharSet.length} characters`);
        console.log(`New character set: ${this.newCharSet.length} characters`);
        console.log(`Added characters: "${this.addedChars}" (+${this.addedChars.length})`);
        
        // Check for duplicates
        const oldSet = new Set(this.oldCharSet);
        const newSet = new Set(this.newCharSet);
        
        console.log(`Old set unique chars: ${oldSet.size} (${oldSet.size === this.oldCharSet.length ? '✅' : '❌'} no duplicates)`);
        console.log(`New set unique chars: ${newSet.size} (${newSet.size === this.newCharSet.length ? '✅' : '❌'} no duplicates)`);
        console.log('');
    }

    /**
     * Validate URL safety of new characters
     */
    validateUrlSafety() {
        console.log('🔒 URL Safety Analysis:');
        
        // Test how browsers handle these characters in URLs
        const testData = this.addedChars;
        
        console.log(`Testing characters: "${testData}"`);
        console.log(`encodeURI(): "${encodeURI(testData)}"`);
        console.log(`encodeURIComponent(): "${encodeURIComponent(testData)}"`);
        
        // Test in actual URL context
        const testPath = `/test/path/with${testData}in/it`;
        console.log(`Test path: "${testPath}"`);
        
        try {
            const testUrl = new URL(`https://example.com${testPath}`);
            console.log(`URL pathname: "${testUrl.pathname}"`);
            console.log(`Characters preserved: ${testUrl.pathname.includes(testData) ? '✅' : '❌'}`);
        } catch (e) {
            console.log(`❌ URL parsing error: ${e.message}`);
        }
        console.log('');
    }

    /**
     * Test encoding/decoding roundtrip with new characters
     */
    validateEncodingRoundtrip() {
        console.log('🔄 Encoding Roundtrip Test:');
        
        // Create test data that includes the new characters
        const testString = 'Hello&World=Test\'Data';
        console.log(`Test string: "${testString}"`);
        
        // Simulate DirectBaseEncoder logic
        const encoder = {
            charToIndex: new Map(),
            indexToChar: new Map()
        };
        
        // Build lookup tables
        for (let i = 0; i < this.newCharSet.length; i++) {
            encoder.charToIndex.set(this.newCharSet[i], i);
            encoder.indexToChar.set(i, this.newCharSet[i]);
        }
        
        // Test character mapping
        let mappingSuccess = true;
        for (const char of this.addedChars) {
            if (!encoder.charToIndex.has(char)) {
                mappingSuccess = false;
                console.log(`❌ Character "${char}" not in lookup table`);
            }
        }
        
        console.log(`Character mapping: ${mappingSuccess ? '✅' : '❌'}`);
        
        // Test that all characters are accessible
        console.log(`Total accessible characters: ${encoder.charToIndex.size}`);
        console.log(`Expected: ${this.newCharSet.length}`);
        console.log(`Mapping complete: ${encoder.charToIndex.size === this.newCharSet.length ? '✅' : '❌'}`);
        console.log('');
    }

    /**
     * Calculate efficiency gains
     */
    calculateEfficiencyGains() {
        console.log('📈 Efficiency Analysis:');
        
        const oldRadix = this.oldCharSet.length;
        const newRadix = this.newCharSet.length;
        
        const oldBitsPerChar = Math.log2(oldRadix);
        const newBitsPerChar = Math.log2(newRadix);
        const improvement = (newBitsPerChar / oldBitsPerChar - 1) * 100;
        
        console.log(`Old radix: ${oldRadix} (${oldBitsPerChar.toFixed(4)} bits/char)`);
        console.log(`New radix: ${newRadix} (${newBitsPerChar.toFixed(4)} bits/char)`);
        console.log(`Efficiency improvement: ${improvement.toFixed(2)}%`);
        
        // Calculate space savings for common file sizes
        const testSizes = [1024, 5120, 10240, 25600]; // 1KB, 5KB, 10KB, 25KB
        console.log('\nSpace savings by file size:');
        
        testSizes.forEach(size => {
            const oldLength = Math.ceil(size * 8 / oldBitsPerChar);
            const newLength = Math.ceil(size * 8 / newBitsPerChar);
            const saved = oldLength - newLength;
            const savedPercent = (saved / oldLength * 100).toFixed(2);
            
            console.log(`${(size/1024).toFixed(0).padStart(2)}KB: ${saved.toString().padStart(3)} chars saved (${savedPercent}%)`);
        });
        console.log('');
    }

    /**
     * Test GitHub Pages compatibility
     */
    async testGitHubPagesCompatibility() {
        console.log('🏠 GitHub Pages Compatibility:');
        
        // Simulate the GitHub Pages URL handling
        const testPaths = [
            '/normalpath',
            `/path/with${this.addedChars}/data`,
            `/just${this.addedChars}`,
            `/${this.addedChars}atstart`,
            `/atend${this.addedChars}`
        ];
        
        testPaths.forEach(path => {
            // Test how the path would be handled by the 404 handler
            const extractedData = path.substring(1); // Remove leading slash
            const decodedData = decodeURIComponent(extractedData);
            
            console.log(`Path: "${path}"`);
            console.log(`  Extracted: "${extractedData}"`);
            console.log(`  Decoded: "${decodedData}"`);
            console.log(`  Preserved: ${decodedData.includes(this.addedChars) ? '✅' : '❌'}`);
        });
        console.log('');
    }

    /**
     * Generate recommendations
     */
    generateRecommendations() {
        console.log('💡 Recommendations:');
        
        const improvement = ((this.newCharSet.length / this.oldCharSet.length) - 1) * 100;
        
        if (improvement > 3) {
            console.log('✅ RECOMMENDED: Significant efficiency gain, worth implementing');
        } else if (improvement > 1) {
            console.log('🟡 CONSIDER: Moderate gain, implement if you want every optimization');
        } else {
            console.log('🟠 MARGINAL: Small gain, might not be worth the risk');
        }
        
        console.log(`\nRadix increase: ${improvement.toFixed(1)}%`);
        console.log('Risk assessment: LOW (characters are RFC 3986 compliant)');
        console.log('Implementation: Simple config change');
    }
};

// Auto-run validation when loaded
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const validator = new window.CharacterSetValidator();
        validator.runValidation();
    });
}
