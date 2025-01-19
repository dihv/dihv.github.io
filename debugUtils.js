// debugUtils.js

const DEBUG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
};

class DebugLogger {
    constructor(moduleName, level = DEBUG_LEVELS.INFO) {
        this.moduleName = moduleName;
        this.level = level;
    }

    formatMessage(level, message, data) {
        const timestamp = new Date().toISOString();
        let formattedMessage = `[${timestamp}] [${this.moduleName}] [${level}] ${message}`;
        
        if (data) {
            if (data instanceof Uint8Array) {
                formattedMessage += '\nData (first 32 bytes): ' + 
                    Array.from(data.slice(0, 32))
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join(' ');
            } else if (typeof data === 'object') {
                try {
                    formattedMessage += '\n' + JSON.stringify(data, null, 2);
                } catch (e) {
                    formattedMessage += '\n[Object cannot be stringified]';
                }
            } else {
                formattedMessage += '\n' + String(data);
            }
        }
        return formattedMessage;
    }

    log(level, message, data) {
        if (level <= this.level) {
            const formattedMessage = this.formatMessage(
                Object.keys(DEBUG_LEVELS)[level],
                message,
                data
            );
            
            switch (level) {
                case DEBUG_LEVELS.ERROR:
                    console.error(formattedMessage);
                    break;
                case DEBUG_LEVELS.WARN:
                    console.warn(formattedMessage);
                    break;
                default:
                    console.log(formattedMessage);
            }
        }
    }

    error(message, data) {
        this.log(DEBUG_LEVELS.ERROR, message, data);
    }

    warn(message, data) {
        this.log(DEBUG_LEVELS.WARN, message, data);
    }

    info(message, data) {
        this.log(DEBUG_LEVELS.INFO, message, data);
    }

    debug(message, data) {
        this.log(DEBUG_LEVELS.DEBUG, message, data);
    }

    trace(message, data) {
        this.log(DEBUG_LEVELS.TRACE, message, data);
    }
}

// Image format detection utilities
const ImageUtils = {
    async detectFormat(arrayBuffer) {
        const header = new Uint8Array(arrayBuffer.slice(0, 16));
        const signatures = {
            'image/jpeg': [[0xFF, 0xD8, 0xFF]],
            'image/png': [[0x89, 0x50, 0x4E, 0x47]],
            'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], 
                         [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
            'image/webp': [[0x52, 0x49, 0x46, 0x46]],
            'image/bmp': [[0x42, 0x4D]]
        };

        for (const [format, sigs] of Object.entries(signatures)) {
            for (const sig of sigs) {
                if (sig.every((byte, i) => header[i] === byte)) {
                    return format;
                }
            }
        }
        return null;
    },

    async validateImage(arrayBuffer) {
        return new Promise((resolve, reject) => {
            const blob = new Blob([arrayBuffer]);
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => reject(new Error('Invalid image data'));
            img.src = URL.createObjectURL(blob);
        });
    }
};

export { DebugLogger, DEBUG_LEVELS, ImageUtils };
