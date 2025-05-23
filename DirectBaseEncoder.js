/**
 * Direct Base Conversion Encoder
 * 
 * Uses a sliding window approach to convert binary data directly to base-N
 * without byte boundary issues, avoiding repetitive patterns.
 */
class DirectBaseEncoder {
    constructor(safeChars) {
        this.SAFE_CHARS = safeChars;
        this.RADIX = safeChars.length;
        
        // Create lookup tables
        this.charToIndex = new Map();
        this.indexToChar = new Map();
        for (let i = 0; i < safeChars.length; i++) {
            this.charToIndex.set(safeChars[i], i);
            this.indexToChar.set(i, safeChars[i]);
        }
        
        // Calculate optimal chunk size based on radix
        // We want chunks that fit in JavaScript's safe integer range
        this.BITS_PER_CHUNK = Math.floor(53 / Math.log2(this.RADIX)) * Math.floor(Math.log2(this.RADIX));
        this.BYTES_PER_CHUNK = Math.floor(this.BITS_PER_CHUNK / 8);
        
        // Try to initialize WebGL for parallel processing
        this.initializeWebGL();
    }
    
    initializeWebGL() {
        try {
            this.canvas = document.createElement('canvas');
            this.gl = this.canvas.getContext('webgl2', {
                antialias: false,
                depth: false,
                stencil: false,
                preserveDrawingBuffer: false
            });
            
            if (this.gl) {
                this.setupShaders();
                this.gpuAvailable = true;
            }
        } catch (e) {
            console.warn('WebGL2 not available, using CPU fallback');
            this.gpuAvailable = false;
        }
    }
    
    setupShaders() {
        const vertexShader = `#version 300 es
            in vec2 position;
            void main() {
                gl_Position = vec4(position, 0.0, 1.0);
            }`;
        
        // Shader that processes multiple digits in parallel
        const fragmentShader = `#version 300 es
            precision highp float;
            precision highp int;
            precision highp usampler2D;
            
            uniform usampler2D u_data;
            uniform uint u_radix;
            uniform uint u_chunkSize;
            uniform uint u_outputDigits;
            
            out uvec4 fragColor;
            
            // Efficient modular exponentiation
            uint modPow(uint base, uint exp, uint mod) {
                uint result = 1u;
                base = base % mod;
                while (exp > 0u) {
                    if ((exp & 1u) == 1u) {
                        result = (result * base) % mod;
                    }
                    exp = exp >> 1u;
                    base = (base * base) % mod;
                }
                return result;
            }
            
            void main() {
                ivec2 coord = ivec2(gl_FragCoord.xy);
                uint chunkIndex = uint(coord.x);
                uint digitOffset = uint(coord.y) * 4u; // 4 digits per pixel
                
                // Read chunk data
                uvec4 chunkData = texelFetch(u_data, ivec2(chunkIndex, 0), 0);
                
                // Convert chunk to value (handle up to 128 bits using two uints)
                uint valueLow = chunkData.x | (chunkData.y << 8u) | (chunkData.z << 16u) | (chunkData.w << 24u);
                
                // Calculate 4 consecutive digits
                uvec4 digits;
                for (uint i = 0u; i < 4u; i++) {
                    uint digitPos = digitOffset + i;
                    if (digitPos < u_outputDigits) {
                        // Calculate (value / radix^digitPos) % radix
                        uint divisor = modPow(u_radix, digitPos, 0xFFFFFFFFu);
                        digits[i] = (valueLow / divisor) % u_radix;
                    } else {
                        digits[i] = 0u;
                    }
                }
                
                fragColor = digits;
            }`;
        
        // Compile shaders and create program
        this.program = this.createShaderProgram(vertexShader, fragmentShader);
        
        // Set up geometry
        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        const posBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, posBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
        
        const posLoc = this.gl.getAttribLocation(this.program, 'position');
        this.gl.enableVertexAttribArray(posLoc);
        this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);
        
        // Get uniform locations
        this.uniforms = {
            data: this.gl.getUniformLocation(this.program, 'u_data'),
            radix: this.gl.getUniformLocation(this.program, 'u_radix'),
            chunkSize: this.gl.getUniformLocation(this.program, 'u_chunkSize'),
            outputDigits: this.gl.getUniformLocation(this.program, 'u_outputDigits')
        };
    }
    
    /**
     * Encode data using sliding window approach
     */
    encode(data) {
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        
        if (bytes.length === 0) {
            throw new Error('Empty input data');
        }
        
        // For small data, use simple encoding
        if (bytes.length <= 32) {
            return this.encodeSmall(bytes);
        }
        
        // Use sliding window approach for larger data
        return this.encodeLarge(bytes);
    }
    
    /**
     * Simple encoding for small data
     */
    encodeSmall(bytes) {
        // Convert bytes to a single number
        let value = 0n;
        for (let i = bytes.length - 1; i >= 0; i--) {
            value = (value << 8n) | BigInt(bytes[i]);
        }
        
        // Convert to base-N
        const digits = [];
        while (value > 0n) {
            digits.push(this.indexToChar.get(Number(value % BigInt(this.RADIX))));
            value = value / BigInt(this.RADIX);
        }
        
        // Add simple metadata
        const metadata = this.indexToChar.get(bytes.length) + 
                        this.indexToChar.get(this.calculateChecksum(bytes));
        
        return metadata + digits.join('');
    }
    
    /**
     * Encode large data using sliding window
     */
    encodeLarge(bytes) {
        const encoded = [];
        const overlap = 1; // Bytes of overlap between windows to avoid patterns
        
        // Process data in overlapping windows
        for (let offset = 0; offset < bytes.length; offset += this.BYTES_PER_CHUNK - overlap) {
            const windowEnd = Math.min(offset + this.BYTES_PER_CHUNK, bytes.length);
            const window = bytes.slice(offset, windowEnd);
            
            // Add entropy based on position to avoid patterns
            const mixed = this.mixWithPosition(window, offset);
            
            // Encode this window
            const windowEncoded = this.encodeWindow(mixed);
            encoded.push(windowEncoded);
        }
        
        // Add metadata
        const metadata = this.encodeMetadata(bytes.length, this.calculateChecksum(bytes));
        
        return metadata + encoded.join('');
    }
    
    /**
     * Mix bytes with position to add entropy
     */
    mixWithPosition(window, position) {
        const mixed = new Uint8Array(window.length);
        const positionHash = this.hashPosition(position);
        
        for (let i = 0; i < window.length; i++) {
            // Simple mixing function that's reversible
            mixed[i] = window[i] ^ ((positionHash >> (i % 4) * 8) & 0xFF);
        }
        
        return mixed;
    }
    
    /**
     * Hash position to get mixing value
     */
    hashPosition(pos) {
        // Simple hash function
        let hash = pos * 0x9E3779B9; // Golden ratio
        hash = (hash ^ (hash >> 16)) * 0x85EBCA6B;
        hash = (hash ^ (hash >> 13)) * 0xC2B2AE35;
        return (hash ^ (hash >> 16)) >>> 0;
    }
    
    /**
     * Encode a single window of data
     */
    encodeWindow(window) {
        // Build value from window bytes
        let value = 0n;
        for (let i = window.length - 1; i >= 0; i--) {
            value = (value << 8n) | BigInt(window[i]);
        }
        
        // Calculate required digits
        const bitsUsed = window.length * 8;
        const digitsNeeded = Math.ceil(bitsUsed / Math.log2(this.RADIX));
        
        // Convert to base-N with fixed width
        const digits = [];
        for (let i = 0; i < digitsNeeded; i++) {
            digits.push(this.indexToChar.get(Number(value % BigInt(this.RADIX))));
            value = value / BigInt(this.RADIX);
        }
        
        return digits.join('');
    }
    
    /**
     * Encode metadata efficiently
     */
    encodeMetadata(length, checksum) {
        // Use variable-length encoding
        const lengthDigits = [];
        let len = length;
        
        do {
            lengthDigits.push(this.indexToChar.get(len % this.RADIX));
            len = Math.floor(len / this.RADIX);
        } while (len > 0);
        
        // Mark end of length with highest char
        lengthDigits.push(this.indexToChar.get(this.RADIX - 1));
        
        // Add checksum
        lengthDigits.push(this.indexToChar.get(checksum));
        
        return lengthDigits.join('');
    }
    
    /**
     * Calculate checksum
     */
    calculateChecksum(bytes) {
        let checksum = 0;
        for (let i = 0; i < bytes.length; i++) {
            checksum = (checksum * 31 + bytes[i]) % this.RADIX;
        }
        return checksum;
    }
    
    /**
     * Helper to create shader program
     */
    createShaderProgram(vsSource, fsSource) {
        const vs = this.gl.createShader(this.gl.VERTEX_SHADER);
        this.gl.shaderSource(vs, vsSource);
        this.gl.compileShader(vs);
        
        const fs = this.gl.createShader(this.gl.FRAGMENT_SHADER);
        this.gl.shaderSource(fs, fsSource);
        this.gl.compileShader(fs);
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vs);
        this.gl.attachShader(program, fs);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            throw new Error('Shader link failed: ' + this.gl.getProgramInfoLog(program));
        }
        
        return program;
    }
}

// Integration with existing system
window.DirectBaseEncoder = DirectBaseEncoder;

// Monkey-patch the existing encoder to use this approach
if (window.GPUBitStreamEncoderImpl) {
    const originalEncode = window.GPUBitStreamEncoderImpl.prototype.encodeBits;
    
    window.GPUBitStreamEncoderImpl.prototype.encodeBits = async function(data) {
        try {
            // Try the new direct base encoding
            if (!this._directEncoder) {
                this._directEncoder = new DirectBaseEncoder(this.SAFE_CHARS);
            }
            
            return this._directEncoder.encode(data);
        } catch (e) {
            console.warn('Direct base encoding failed, falling back to original:', e);
            return originalEncode.call(this, data);
        }
    };
}
