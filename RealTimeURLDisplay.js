/**
 * RealTimeURLDisplay.js
 * 
 * A standalone component that shows the current URL string being generated in real-time
 */
window.RealTimeURLDisplay = class RealTimeURLDisplay {
    constructor() {
        // Prevent duplicate initialization
        if (window.realTimeURLDisplayInitialized) {
            console.warn('RealTimeURLDisplay already initialized, skipping duplicate');
            return;
        }
        window.realTimeURLDisplayInitialized = true;
        
        // Create the URL display container
        this.createURLDisplay();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // URL limit from config
        this.urlLimit = window.CONFIG ? window.CONFIG.MAX_URL_LENGTH : 8192;
        
        console.log('RealTimeURLDisplay initialized');
    }
    
    /**
     * Create the URL display container
     */
    createURLDisplay() {
        // Create container element
        const urlDisplayContainer = document.createElement('div');
        urlDisplayContainer.id = 'urlDisplayContainer';
        urlDisplayContainer.className = 'url-display-container';
        urlDisplayContainer.style.cssText = `
            margin: 1.5rem 0;
            padding: 1rem;
            background: white;
            border: 1px solid var(--border-color, #e0e0e0);
            border-radius: 8px;
            display: none;
        `;
        
        // Set inner HTML with header and content
        urlDisplayContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <h3 style="margin: 0; font-size: 1.1rem;">Real-time URL String</h3>
                <div id="urlByteCount" style="font-size: 0.9rem; color: #666;">0 / ${this.urlLimit || 8192} chars</div>
            </div>
            <div style="position: relative;">
                <pre id="currentUrlString" style="margin: 0; padding: 0.5rem; background: #f5f5f5; border-radius: 4px; font-size: 0.8rem; overflow: auto; max-height: 150px; white-space: pre-wrap; word-break: break-all;"></pre>
                <div id="copyUrlButton" style="position: absolute; top: 5px; right: 5px; background: white; padding: 3px 8px; border-radius: 4px; border: 1px solid #ddd; cursor: pointer; font-size: 0.8rem;">Copy</div>
            </div>
            <div style="display: flex; justify-content: flex-end; margin-top: 0.5rem;">
                <label style="font-size: 0.9rem; display: flex; align-items: center;">
                    <input type="checkbox" id="autoScrollUrlCheck" checked> Auto-scroll to end
                </label>
            </div>
        `;
        
        // Find a location to insert the container (after image stats, before results)
        const imageStats = document.getElementById('imageStats');
        const resultContainer = document.getElementById('resultContainer');
        
        // Try to insert after image stats first
        if (imageStats && imageStats.parentNode) {
            imageStats.parentNode.insertBefore(urlDisplayContainer, imageStats.nextSibling);
        }
        // Otherwise, try before result container
        else if (resultContainer && resultContainer.parentNode) {
            resultContainer.parentNode.insertBefore(urlDisplayContainer, resultContainer);
        }
        // Last resort, append to the main container
        else {
            const container = document.querySelector('.container');
            if (container) container.appendChild(urlDisplayContainer);
        }
        
        // Store references to elements
        this.elements = {
            container: urlDisplayContainer,
            urlString: document.getElementById('currentUrlString'),
            byteCount: document.getElementById('urlByteCount'),
            copyButton: document.getElementById('copyUrlButton'),
            autoScrollCheck: document.getElementById('autoScrollUrlCheck')
        };
        
        // Setup copy button
        if (this.elements.copyButton) {
            this.elements.copyButton.addEventListener('click', () => {
                if (this.elements.urlString && this.elements.urlString.textContent) {
                    navigator.clipboard.writeText(this.elements.urlString.textContent)
                        .then(() => {
                            this.elements.copyButton.textContent = 'Copied!';
                            setTimeout(() => {
                                this.elements.copyButton.textContent = 'Copy';
                            }, 2000);
                        })
                        .catch(() => {
                            this.elements.copyButton.textContent = 'Failed';
                            setTimeout(() => {
                                this.elements.copyButton.textContent = 'Copy';
                            }, 2000);
                        });
                }
            });
        }
    }
    
    /**
     * Setup event listeners for metrics updates
     */
    setupEventListeners() {
        // Listen for metrics-update events
        document.addEventListener('metrics-update', this.handleMetricsUpdate.bind(this));
        
        // Listen for file input changes to reset URL
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', this.resetURL.bind(this));
        }
        
        // Listen for drop zone events to reset URL
        const dropZone = document.getElementById('dropZone');
        if (dropZone) {
            dropZone.addEventListener('drop', this.resetURL.bind(this));
        }
    }
    
    /**
     * Handle metrics update event
     * @param {Object} event - Event object
     */
    handleMetricsUpdate(event) {
        const data = event.detail;
        const { metrics } = data;
        
        // Get compression attempts to extract encoded URL
        const attempts = metrics.compressionAttempts || [];
        
        // Only process if there are attempts
        if (attempts.length === 0) return;
        
        // Find the latest successful attempt with encoded data
        let latestAttempt = null;
        for (let i = attempts.length - 1; i >= 0; i--) {
            if (attempts[i].encoded || attempts[i].encodedLength) {
                latestAttempt = attempts[i];
                break;
            }
        }
        
        // Update URL display if we have an attempt with encoded data
        if (latestAttempt && latestAttempt.encoded) {
            this.updateURLDisplay(latestAttempt.encoded);
        }
        
        // Show container if processing has started
        if (attempts.length > 0 && this.elements.container) {
            this.elements.container.style.display = 'block';
        }
        
        // Handle completion
        if (metrics.completed) {
            this.markAsComplete();
        }
    }
    
    /**
     * Update the URL display with the current encoded string
     * @param {string} encodedString - The current encoded string
     */
    updateURLDisplay(encodedString) {
        if (!this.elements.urlString || !this.elements.byteCount) return;
        
        // Update the URL text
        this.elements.urlString.textContent = encodedString;
        
        // Update byte count
        const length = encodedString.length;
        const percentOfLimit = Math.round((length / this.urlLimit) * 100);
        
        this.elements.byteCount.textContent = `${length.toLocaleString()} / ${this.urlLimit.toLocaleString()} chars (${percentOfLimit}%)`;
        
        // Color code based on percentage of limit
        if (percentOfLimit > 95) {
            this.elements.byteCount.style.color = 'red';
        } else if (percentOfLimit > 75) {
            this.elements.byteCount.style.color = 'orange';
        } else {
            this.elements.byteCount.style.color = '#666';
        }
        
        // Auto-scroll to end if enabled
        if (this.elements.autoScrollCheck && this.elements.autoScrollCheck.checked) {
            this.elements.urlString.scrollTop = this.elements.urlString.scrollHeight;
        }
    }
    
    /**
     * Reset the URL display for a new job
     */
    resetURL() {
        if (!this.elements.urlString || !this.elements.byteCount) return;
        
        // Clear URL text
        this.elements.urlString.textContent = '';
        
        // Reset byte count
        this.elements.byteCount.textContent = `0 / ${this.urlLimit.toLocaleString()} chars (0%)`;
        this.elements.byteCount.style.color = '#666';
        
        // Hide container until processing starts
        if (this.elements.container) {
            this.elements.container.style.display = 'none';
        }
    }
    
    /**
     * Mark the URL display as complete
     */
    markAsComplete() {
        // Add success styling
        if (this.elements.container) {
            this.elements.container.style.borderColor = '#4caf50';
        }
        
        if (this.elements.urlString) {
            this.elements.urlString.style.borderLeft = '4px solid #4caf50';
        }
    }
};

// Initialize the component when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Wait a short time to ensure other components are initialized
    setTimeout(() => {
        if (!window.realTimeURLDisplay) {
            window.realTimeURLDisplay = new window.RealTimeURLDisplay();
        }
    }, 200);
});
