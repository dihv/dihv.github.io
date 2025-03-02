/** imageViewer.js
 * Image Viewer Component
 * 
 * This file implements the client-side viewer for images embedded in URLs.
 * It handles:
 * 1. URL parsing to extract encoded image data
 * 2. Binary data decoding using the BitStream decoder
 * 3. Format detection and validation
 * 4. Image rendering and display
 * 5. Download functionality
 * 
 * Project Technical Approach references:
 * - PTA_1: Uses URL-safe character set from config
 * - PTA_3: Preserves byte boundaries during decoding
 * - PTA_4: Uses magic numbers for format detection
 * - PTA_5: References shared config file
 */
window.ImageViewer = class ImageViewer {
    /**
     * Initialize the image viewer component
     * @param {string} imageData - URL-encoded image data from the path
     */
    constructor(imageData) {
        // Check dependencies are loaded
        if (!window.GPUBitStreamEncoder || !window.CONFIG) {
            throw new Error('Required dependencies not loaded');
        }
        
        // PTA_1 & PTA_5: Use safe character set from shared config
        this.encoder = new window.GPUBitStreamEncoder(window.CONFIG.SAFE_CHARS);
        
        // Verify WebGL support for decoding
        this.hasWebGLSupport = this.checkWebGLSupport();
        if (!this.hasWebGLSupport) {
            console.warn('WebGL2 support not detected. Using CPU fallback for image decoding.');
        }
        
        // Setup container for the image
        this.container = this.createContainer();
        document.body.appendChild(this.container);
        
        // Process image data if provided
        if (imageData) {
            this.decodeAndDisplayImage(decodeURIComponent(imageData))
                .catch(error => this.showError(error.message));
        } else {
            this.showError('No image data provided');
        }
    }

    /**
     * Checks if WebGL2 is supported by the browser
     * @returns {boolean} - Whether WebGL2 is supported
     */
    checkWebGLSupport() {
        const canvas = document.createElement('canvas');
        return !!canvas.getContext('webgl2');
    }

    /**
     * Creates the main container for the image viewer
     * @returns {HTMLElement} - The container element
     */
    createContainer() {
        const container = document.createElement('div');
        container.className = 'image-viewer-container';
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
            box-sizing: border-box;
            background: #f5f5f5;
        `;
        return container;
    }

    /**
     * Main process to decode and display an image from encoded data
     * @param {string} encodedData - URL-encoded image data
     */
    async decodeAndDisplayImage(encodedData) {
        try {
            // Step 1: Validate the encoded data
            this.validateEncodedData(encodedData);

            // Step 2: Show loading state
            this.showStatus('Decoding image data...', 'info');

            // Step 3: Extract and verify metadata
            const { metadata, data, checksum } = this.extractMetadata(encodedData);
            
            // Step 4: Verify data integrity using checksum
            this.showStatus('Verifying data integrity...', 'info');
            if (!this.verifyChecksum(data, checksum)) {
                throw new Error('Data corruption detected: checksum mismatch');
            }

            // Step 5: Decode the binary data
            this.showStatus('Decoding image data...', 'info');
            const buffer = await this.decode(encodedData);
            
            // Step 6: Detect and verify image format
            const format = this.detectImageFormat(buffer);
            if (!format) {
                throw new Error('Unable to detect valid image format');
            }

            // Step 7: Verify format is supported
            if (!window.CONFIG.SUPPORTED_INPUT_FORMATS.includes(format)) {
                throw new Error(`Unsupported image format: ${format}`);
            }

            // Step 8: Create blob and image URL
            const blob = new Blob([buffer], { type: format });
            const url = URL.createObjectURL(blob);

            // Step 9: Create and load image element
            const img = await this.createImage(url, format);
            
            // Step 10: Update UI with image and info
            this.container.innerHTML = ''; // Clear any previous content
            this.addImageInfo(buffer.byteLength, format);
            this.container.appendChild(img);
            this.addDownloadButton(blob, format);

        } catch (error) {
            console.error('Display error:', error);
            this.showError(`Failed to display image: ${error.message}`);
        }
    }

    /**
     * Decodes encoded string data to binary
     * @param {string} encodedData - The encoded image data
     * @returns {Promise<ArrayBuffer>} - Decoded binary data
     */
    async decode(encodedData) {
        if (!encodedData) {
            throw new Error('No encoded data to decode');
        }

        try {
            // Use the encoder's decodeBits method
            return await this.encoder.decodeBits(encodedData);
        } catch (error) {
            console.error('Primary decoding error:', error);
            
            // Try reinitializing the encoder if WebGL context was lost
            if (this.encoder.gl && this.encoder.gl.isContextLost()) {
                console.warn('WebGL context was lost during decoding. Reinitializing encoder...');
                
                try {
                    // Create a new encoder instance
                    this.encoder = new window.GPUBitStreamEncoder(window.CONFIG.SAFE_CHARS);
                    return await this.encoder.decodeBits(encodedData);
                } catch (reinitError) {
                    console.error('Failed to reinitialize encoder:', reinitError);
                    throw new Error(`Decoding failed after context loss: ${reinitError.message}`);
                }
            }
            
            throw new Error(`Decoding failed: ${error.message}`);
        }
    }

    /**
     * Verifies data integrity using checksum
     * @param {string} data - Encoded data string
     * @param {number} expectedChecksum - Expected checksum value
     * @returns {boolean} - Whether checksum is valid
     */
    verifyChecksum(data, expectedChecksum) {
        let checksum = 0;
        for (const char of data) {
            // Calculate running checksum using same algorithm as encoder
            checksum = (checksum + this.encoder.charToIndex.get(char)) % this.encoder.RADIX;
        }
        return checksum === expectedChecksum;
    }

    /**
     * Extracts metadata from encoded data string
     * @param {string} encodedData - URL-encoded image data
     * @returns {Object} - Extracted metadata, data section, and checksum
     */
    extractMetadata(encodedData) {
        // Read metadata length indicator (first character)
        const metadataLengthChar = encodedData[0];
        const metadataLength = this.encoder.charToIndex.get(metadataLengthChar);
        
        // Extract metadata and data sections
        const metadataStr = encodedData.slice(1, metadataLength + 1);
        const dataStr = encodedData.slice(metadataLength + 1);
        
        // Parse checksum (last character of metadata)
        const checksum = this.encoder.charToIndex.get(metadataStr[metadataStr.length - 1]);
        
        // Extract length information (all metadata except checksum)
        const lengthStr = metadataStr.slice(0, -1);
        
        // Calculate original length from base-N encoding
        let length = 0;
        for (const char of lengthStr) {
            length = length * this.encoder.RADIX + this.encoder.charToIndex.get(char);
        }
        
        return {
            metadata: { length },
            data: dataStr,
            checksum
        };
    }

    /**
     * Validates encoded data format and constraints
     * @param {string} encodedData - URL-encoded image data
     * @throws {Error} - If data is invalid
     */
    validateEncodedData(encodedData) {
        // Check for empty data
        if (!encodedData || typeof encodedData !== 'string') {
            throw new Error('Invalid or missing image data');
        }

        // PTA_1: Validate against safe character set
        const invalidChars = [...encodedData].filter(char => !window.CONFIG.SAFE_CHARS.includes(char));
        if (invalidChars.length > 0) {
            throw new Error('Image data contains invalid characters');
        }

        // Check length constraints
        if (encodedData.length > window.CONFIG.MAX_URL_LENGTH) {
            throw new Error('Image data exceeds maximum allowed length');
        }
    }

    /**
     * Detects image format from binary data using signature bytes
     * @param {ArrayBuffer} buffer - Decoded binary data
     * @returns {string|null} - Detected MIME type or null if unknown
     */
    detectImageFormat(buffer) {
        // PTA_4: Format detection from first principles using byte signatures
        const arr = new Uint8Array(buffer);
        
        // Check each known format signature
        for (const [formatName, signature] of Object.entries(window.CONFIG.FORMAT_SIGNATURES)) {
            const { bytes, offset = 0, format } = signature;
            
            // Skip if buffer is too short
            if (arr.length < (offset + bytes.length)) continue;
            
            // Check if signature bytes match at specified offset
            const matches = bytes.every((byte, i) => arr[offset + i] === byte);
            
            if (matches) {
                console.log(`Detected format: ${formatName}`);
                return format;
            }
        }
        
        return null;
    }

    /**
     * Creates an image element from a blob URL
     * @param {string} url - Object URL for the image blob
     * @param {string} format - Image MIME type
     * @returns {Promise<HTMLImageElement>} - Image element
     */
    createImage(url, format) {
        return new Promise((resolve, reject) => {
            const img = document.createElement('img');
            
            img.onload = () => {
                URL.revokeObjectURL(url); // Clean up object URL
                resolve(img);
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url); // Clean up object URL
                reject(new Error(`Failed to load ${format} image`));
            };

            // Set image styles
            img.style.cssText = `
                max-width: 100%;
                max-height: 90vh;
                object-fit: contain;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            `;
            
            img.src = url;
        });
    }

    /**
     * Adds image information display above the image
     * @param {number} size - Image size in bytes
     * @param {string} format - Image MIME type
     */
    addImageInfo(size, format) {
        const info = document.createElement('div');
        info.style.cssText = `
            margin-bottom: 20px;
            text-align: center;
            font-family: system-ui, -apple-system, sans-serif;
            color: #666;
        `;
        
        const formattedSize = (size / 1024).toFixed(2);
        info.textContent = `Format: ${format} | Size: ${formattedSize}KB`;
        
        this.container.appendChild(info);
    }

    /**
     * Adds download button below the image
     * @param {Blob} blob - Image data as blob
     * @param {string} format - Image MIME type
     */
    addDownloadButton(blob, format) {
        const button = document.createElement('a');
        button.href = URL.createObjectURL(blob);
        button.download = `image.${format.split('/')[1]}`;
        button.className = 'download-button';
        button.textContent = 'Download Image';
        
        button.style.cssText = `
            display: inline-block;
            margin-top: 20px;
            padding: 10px 20px;
            background: #2196F3;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-family: system-ui, -apple-system, sans-serif;
            transition: background 0.3s ease;
        `;
        
        button.onmouseover = () => button.style.background = '#1976D2';
        button.onmouseout = () => button.style.background = '#2196F3';
        
        this.container.appendChild(button);
    }

    /**
     * Shows status message in the container
     * @param {string} message - Status message to display
     * @param {string} type - Message type (info or error)
     */
    showStatus(message, type = 'info') {
        const status = document.createElement('div');
        status.textContent = message;
        status.style.cssText = `
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
            font-family: system-ui, -apple-system, sans-serif;
            text-align: center;
            ${type === 'error' ? 'background: #ffebee; color: #c62828;' : 
              'background: #e3f2fd; color: #1565c0;'}
        `;
        
        this.container.innerHTML = '';
        this.container.appendChild(status);
    }

    /**
     * Shows error message in the container
     * @param {string} message - Error message to display
     */
    showError(message) {
        this.showStatus(message, 'error');
    }
};
