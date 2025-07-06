/**
 * Image Viewer Component
 * * Client-side viewer for images embedded in URLs using BitStream encoding.
 * Handles URL parsing, data decoding, format detection, and image rendering.
 * * Technical Implementation:
 * - Uses BitStreamDecoder for data decoding
 * - Employs format signature detection from CONFIG.FORMAT_SIGNATURES
 * - Supports all formats defined in CONFIG.SUPPORTED_INPUT_FORMATS
 * - Provides download functionality and error handling
 */
window.ImageViewer = class ImageViewer {
    /**
     * Initialize the image viewer component
     * @param {string} imageData - URL-encoded image data from the path
     * @throws {Error} If required dependencies are not loaded
     */
    constructor(imageData) {
        // Validate dependencies
        this.validateDependencies();
        
        // CORRECTED: Initialize the new BitStreamDecoder
        this.decoder = new window.BitStreamDecoder(window.CONFIG.SAFE_CHARS);
        
        // Setup container and process image data
        this.container = this.createContainer();
        document.body.innerHTML = ''; // Clear the body before appending
        document.body.appendChild(this.container);
        
        // Process image data if provided
        if (imageData) {
            this.decodeAndDisplayImage(decodeURIComponent(imageData))
                .catch(error => this.showError(error.message));
        } else {
            this.showError('No image data provided in URL');
        }
    }

    /**
     * Validate that required dependencies are loaded
     * @throws {Error} If critical dependencies are missing
     */
    validateDependencies() {
        // CORRECTED: Check for BitStreamDecoder instead of GPUBitStreamDecoder
        const required = [
            { name: 'BitStreamDecoder', obj: window.BitStreamDecoder },
            { name: 'CONFIG', obj: window.CONFIG },
            { name: 'CONFIG.SAFE_CHARS', obj: window.CONFIG?.SAFE_CHARS },
            { name: 'CONFIG.FORMAT_SIGNATURES', obj: window.CONFIG?.FORMAT_SIGNATURES },
            { name: 'CONFIG.SUPPORTED_INPUT_FORMATS', obj: window.CONFIG?.SUPPORTED_INPUT_FORMATS }
        ];
        
        const missing = required.filter(dep => !dep.obj);
        if (missing.length > 0) {
            throw new Error(`Required dependencies not loaded: ${missing.map(d => d.name).join(', ')}`);
        }
    }

    /**
     * Create the main container for the image viewer
     * @returns {HTMLElement} Styled container element
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
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            font-family: system-ui, -apple-system, sans-serif;
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
    
            // Step 3: Decode the binary data using dedicated decoder
            const buffer = await this.decoder.decodeBits(encodedData);
            
            // Step 4: Detect and verify image format
            const format = this.detectImageFormat(buffer);
            if (!format) {
                throw new Error('Unable to detect valid image format from decoded data');
            }
    
            // Step 5: Verify format is supported
            if (!window.CONFIG.SUPPORTED_INPUT_FORMATS.includes(format)) {
                throw new Error(`Unsupported image format detected: ${format}`);
            }
    
            // Step 6: Create blob and image URL
            const blob = new Blob([buffer], { type: format });
            const url = URL.createObjectURL(blob);
    
            // Step 7: Create and load image element
            const img = await this.createImage(url, format);
            
            // Step 8: Update UI with image and controls
            this.container.innerHTML = ''; // Clear loading state
            this.addImageInfo(buffer.byteLength, format, encodedData.length);
            this.container.appendChild(img);
            this.addDownloadButton(blob, format);
            this.addTechnicalDetails(buffer.byteLength, encodedData.length, format);
    
        } catch (error) {
            console.error('Image display error:', error);
            this.showError(`Failed to display image: ${error.message}`);
        }
    }

    /**
     * Validate encoded data format and constraints
     * @param {string} encodedData - URL-encoded image data
     * @throws {Error} If data validation fails
     */
    validateEncodedData(encodedData) {
        if (!encodedData || typeof encodedData !== 'string') {
            throw new Error('Invalid or missing image data');
        }

        const invalidChars = [...encodedData].filter(char => !window.CONFIG.SAFE_CHARS.includes(char));
        if (invalidChars.length > 0) {
            const sample = invalidChars.slice(0, 5).join(', ');
            throw new Error(`Image data contains invalid characters: ${sample}${invalidChars.length > 5 ? '...' : ''}`);
        }

        if (encodedData.length > (window.CONFIG.MAX_URL_LENGTH || 8000)) {
            throw new Error(`Image data exceeds maximum allowed length: ${encodedData.length} > ${window.CONFIG.MAX_URL_LENGTH}`);
        }

        if (encodedData.length < 3) {
            throw new Error('Image data too short - appears corrupted');
        }
    }

    /**
     * Detect image format from binary data using signature bytes
     * @param {ArrayBuffer} buffer - Decoded binary data
     * @returns {string|null} Detected MIME type or null if unknown
     */
    detectImageFormat(buffer) {
        const arr = new Uint8Array(buffer);
        
        for (const [formatName, signature] of Object.entries(window.CONFIG.FORMAT_SIGNATURES)) {
            const { bytes, offset = 0, format, verify } = signature;
            
            if (arr.length < (offset + bytes.length)) {
                continue;
            }
            
            const matches = bytes.every((byte, i) => arr[offset + i] === byte);
            
            if (matches) {
                if (verify && typeof verify === 'function') {
                    if (!verify(arr)) {
                        continue;
                    }
                }
                console.log(`✅ Detected format: ${formatName} (${format})`);
                return format;
            }
        }
        
        console.warn('⚠️ No matching format signature found');
        return null;
    }

    /**
     * Create an image element from a blob URL with proper error handling
     * @param {string} url - Object URL for the image blob
     * @param {string} format - Image MIME type
     * @returns {Promise<HTMLImageElement>} Loaded image element
     */
    createImage(url, format) {
        return new Promise((resolve, reject) => {
            const img = document.createElement('img');
            
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error(`Failed to load ${format} image - data may be corrupted`));
            };

            img.style.cssText = `
                max-width: 100%;
                max-height: 80vh;
                object-fit: contain;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                transition: transform 0.3s ease;
            `;
            
            img.addEventListener('mouseenter', () => img.style.transform = 'scale(1.02)');
            img.addEventListener('mouseleave', () => img.style.transform = 'scale(1)');
            
            img.src = url;
            img.alt = `Decoded ${format} image`;
        });
    }

    /**
     * Add image information display above the image
     * @param {number} size - Decoded image size in bytes
     * @param {string} format - Image MIME type
     * @param {number} encodedLength - Length of encoded string
     */
    addImageInfo(size, format, encodedLength) {
        const info = document.createElement('div');
        info.style.cssText = `
            margin-bottom: 24px;
            text-align: center;
            font-family: system-ui, -apple-system, sans-serif;
            color: #2c3e50;
            background: rgba(255,255,255,0.9);
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;
        
        const formatName = format.split('/')[1].toUpperCase();
        const sizeKB = (size / 1024).toFixed(2);
        const compressionRatio = ((size / encodedLength)).toFixed(2);
        
        info.innerHTML = `
            <div style="font-size: 1.2em; font-weight: 600; margin-bottom: 8px;">
                📸 ${formatName} Image Successfully Decoded
            </div>
            <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 16px; font-size: 0.95em;">
                <span><strong>Size:</strong> ${sizeKB} KB</span>
                <span><strong>Format:</strong> ${format}</span>
                <span><strong>Data Density:</strong> ${compressionRatio} bytes/char</span>
            </div>
        `;
        
        this.container.appendChild(info);
    }

    /**
     * Add download button with enhanced styling
     * @param {Blob} blob - Image data as blob
     * @param {string} format - Image MIME type
     */
    addDownloadButton(blob, format) {
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            margin-top: 24px;
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            justify-content: center;
        `;
        
        const downloadButton = document.createElement('a');
        downloadButton.href = URL.createObjectURL(blob);
        downloadButton.download = `bitstream-image.${format.split('/')[1]}`;
        downloadButton.className = 'action-button download-button';
        downloadButton.innerHTML = '📥 Download Image';
        
        const shareButton = document.createElement('button');
        shareButton.className = 'action-button share-button';
        shareButton.innerHTML = '🔗 Copy URL';
        shareButton.onclick = () => this.copyCurrentUrl(shareButton);
        
        [downloadButton, shareButton].forEach(button => {
            button.style.cssText = `
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 12px 24px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-decoration: none;
                border: none;
                border-radius: 8px;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 1rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            `;
            button.addEventListener('mouseenter', () => {
                button.style.transform = 'translateY(-2px)';
                button.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
            });
            button.addEventListener('mouseleave', () => {
                button.style.transform = 'translateY(0)';
                button.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
            });
        });
        
        buttonContainer.appendChild(downloadButton);
        buttonContainer.appendChild(shareButton);
        this.container.appendChild(buttonContainer);
    }

    /**
     * Add technical details section
     * @param {number} decodedSize - Size of decoded data
     * @param {number} encodedLength - Length of encoded string
     * @param {string} format - Image format
     */
    addTechnicalDetails(decodedSize, encodedLength, format) {
        const details = document.createElement('details');
        details.style.cssText = `
            margin-top: 24px;
            background: rgba(255,255,255,0.7);
            padding: 16px;
            border-radius: 8px;
            max-width: 600px;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        
        const summary = document.createElement('summary');
        summary.textContent = '🔧 Technical Details';
        summary.style.cssText = `
            cursor: pointer;
            font-weight: 600;
            margin-bottom: 12px;
            color: #2c3e50;
        `;
        
        const techInfo = document.createElement('div');
        techInfo.style.fontSize = '0.9em';
        techInfo.style.color = '#34495e';
        
        const bitsPerChar = (decodedSize * 8 / encodedLength).toFixed(2);
        
        techInfo.innerHTML = `
            <p><strong>Decoder:</strong> CPU-based (DirectBaseEncoder)</p>
            <p><strong>Character Set:</strong> ${window.CONFIG.SAFE_CHARS.length} URL-safe characters</p>
            <p><strong>Effective Bits/Char:</strong> ${bitsPerChar}</p>
            <p><strong>Format Detection:</strong> Signature-based (${format})</p>
            <p><strong>URL Length:</strong> ${window.location.href.length} characters</p>
        `;
        
        details.appendChild(summary);
        details.appendChild(techInfo);
        this.container.appendChild(details);
    }

    /**
     * Copy current URL to clipboard
     * @param {HTMLElement} button - Button element to update
     */
    async copyCurrentUrl(button) {
        try {
            await navigator.clipboard.writeText(window.location.href);
            const originalText = button.innerHTML;
            button.innerHTML = '✅ Copied!';
            button.style.background = 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)';
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            }, 2000);
        } catch (error) {
            console.error('Failed to copy URL:', error);
            button.innerHTML = '❌ Failed';
            setTimeout(() => {
                button.innerHTML = '🔗 Copy URL';
            }, 2000);
        }
    }

    /**
     * Show status message with enhanced styling
     * @param {string} message - Status message to display
     * @param {string} type - Message type (info, error, success)
     */
    showStatus(message, type = 'info') {
        const status = document.createElement('div');
        status.textContent = message;
        
        const styles = {
            info: 'background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); color: #1565c0; border-left: 4px solid #2196F3;',
            error: 'background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%); color: #c62828; border-left: 4px solid #f44336;',
            success: 'background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); color: #2e7d32; border-left: 4px solid #4caf50;'
        };
        
        status.style.cssText = `
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            font-family: system-ui, -apple-system, sans-serif;
            text-align: center;
            font-size: 1.1em;
            max-width: 600px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            ${styles[type]}
        `;
        
        this.container.innerHTML = '';
        this.container.appendChild(status);
    }

    /**
     * Show error message with enhanced error handling
     * @param {string} message - Error message to display
     */
    showError(message) {
        console.error('ImageViewer Error:', message);
        this.showStatus(`Error: ${message}`, 'error');
        
        const troubleshooting = document.createElement('div');
        troubleshooting.style.cssText = `
            margin-top: 16px;
            padding: 16px;
            background: rgba(255,255,255,0.9);
            border-radius: 8px;
            font-size: 0.9em;
            color: #666;
            text-align: left;
        `;
        
        let tips = '';
        if (message.includes('invalid characters')) {
            tips = '💡 The URL may have been corrupted during sharing. Try copying the URL again.';
        } else if (message.includes('format')) {
            tips = '💡 The image format may not be supported, or the data may be corrupted.';
        } else if (message.includes('length')) {
            tips = '💡 The URL may be too long for this browser. Try using a different browser or a smaller image.';
        } else {
            tips = '💡 Try refreshing the page or checking that the complete URL was copied correctly.';
        }
        
        troubleshooting.innerHTML = `<strong>Troubleshooting:</strong><br>${tips}`;
        this.container.appendChild(troubleshooting);
    }
}
