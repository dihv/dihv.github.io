window.ImageViewer = class ImageViewer {
    constructor(imageData) {
        this.encoder = new window.BitStreamEncoder(window.CONFIG.SAFE_CHARS);
        if (imageData) {
            this.decodeAndDisplayImage(decodeURIComponent(imageData));
        } else {
            this.showError('No image data provided');
        }
    }

    async decodeAndDisplayImage(encodedData) {
        try {
            const buffer = await this.encoder.decodeBits(encodedData);
            const format = this.detectImageFormat(buffer);
            
            if (!format) {
                throw new Error('Unable to detect image format');
            }
            
            const blob = new Blob([buffer], { type: format });
            const url = URL.createObjectURL(blob);
            const img = document.createElement('img');
            
            img.onload = () => URL.revokeObjectURL(url);
            img.onerror = () => {
                URL.revokeObjectURL(url);
                this.showError('Failed to load image data');
            };
            
            img.src = url;
            document.body.appendChild(img);
            
        } catch (error) {
            console.error('Decode error:', error);
            this.showError(`Failed to decode image: ${error.message}`);
        }
    }

    detectImageFormat(buffer) {
        const arr = new Uint8Array(buffer);
        
        for (const [format, signature] of Object.entries(CONFIG.FORMAT_SIGNATURES)) {
            const { bytes, offset = 0 } = signature;
            if (arr.length < (offset + bytes.length)) continue;
            
            if (bytes.every((byte, i) => arr[offset + i] === byte)) {
                return signature.format;
            }
        }
        
        return null;
    }

    showError(message) {
        const error = document.createElement('div');
        error.textContent = message;
        document.body.appendChild(error);
    }
}
