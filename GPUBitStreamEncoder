class GPUBitStreamEncoder {
    constructor(safeChars) {
        this.SAFE_CHARS = safeChars;
        this.RADIX = safeChars.length;
        
        // Initialize WebGL context
        this.canvas = document.createElement('canvas');
        this.gl = this.canvas.getContext('webgl2');
        if (!this.gl) {
            throw new Error('WebGL 2 not supported');
        }
        
        // Initialize shaders
        this.initShaders();
    }

    initShaders() {
        // Vertex shader - positions the texture
        const vertexShaderSource = `#version 300 es
            in vec4 a_position;
            in vec2 a_texCoord;
            out vec2 v_texCoord;
            
            void main() {
                gl_Position = a_position;
                v_texCoord = a_texCoord;
            }`;

        // Fragment shader - processes the binary data
        const fragmentShaderSource = `#version 300 es
            precision highp float;
            precision highp int;
            precision highp sampler2D;
            
            uniform sampler2D u_image;
            uniform int u_radix;
            out vec4 outColor;
            
            // Convert 4 bytes to base-N
            vec4 convertToBaseN(vec4 bytes) {
                // Each component of bytes contains a byte value (0-255)
                float value = bytes.r + 
                            bytes.g * 256.0 + 
                            bytes.b * 65536.0 + 
                            bytes.a * 16777216.0;
                            
                // Convert to base-N
                float remainder;
                vec4 result = vec4(0.0);
                int index = 0;
                
                while (value > 0.0 && index < 4) {
                    remainder = mod(value, float(u_radix));
                    result[index] = remainder;
                    value = floor(value / float(u_radix));
                    index++;
                }
                
                return result;
            }
            
            void main() {
                // Read 4 bytes from the texture
                vec4 bytes = texture(u_image, v_texCoord);
                
                // Convert to our custom base
                outColor = convertToBaseN(bytes * 255.0);
            }`;

        // Create and compile shaders
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
        
        // Create program
        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);
        
        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            throw new Error('Unable to initialize shader program');
        }
    }

    async encodeBits(data) {
        const bytes = new Uint8Array(data);
        
        // Calculate texture dimensions
        // Each pixel holds 4 bytes (RGBA)
        const pixelCount = Math.ceil(bytes.length / 4);
        const textureSide = Math.ceil(Math.sqrt(pixelCount));
        
        // Resize canvas to match texture
        this.canvas.width = textureSide;
        this.canvas.height = textureSide;
        
        // Create texture from bytes
        const texture = this.createDataTexture(bytes, textureSide);
        
        // Process the texture
        const processedData = await this.processTexture(texture, textureSide);
        
        // Convert processed data to safe chars
        return this.convertToString(processedData);
    }

    createDataTexture(bytes, textureSide) {
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        
        // Pad the data to fill the texture
        const paddedData = new Uint8Array(textureSide * textureSide * 4);
        paddedData.set(bytes);
        
        // Upload the data to the texture
        this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0,               // level
            this.gl.RGBA8,  // internal format
            textureSide,    // width
            textureSide,    // height
            0,              // border
            this.gl.RGBA,   // format
            this.gl.UNSIGNED_BYTE, // type
            paddedData      // data
        );
        
        // Set texture parameters
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        
        return texture;
    }

    async processTexture(texture, textureSide) {
        // Set up framebuffer for rendering
        const framebuffer = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
        
        // Create output texture
        const outputTexture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, outputTexture);
        this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0,
            this.gl.RGBA32F,
            textureSide,
            textureSide,
            0,
            this.gl.RGBA,
            this.gl.FLOAT,
            null
        );
        
        // Attach output texture to framebuffer
        this.gl.framebufferTexture2D(
            this.gl.FRAMEBUFFER,
            this.gl.COLOR_ATTACHMENT0,
            this.gl.TEXTURE_2D,
            outputTexture,
            0
        );
        
        // Set up viewport and bind shader program
        this.gl.viewport(0, 0, textureSide, textureSide);
        this.gl.useProgram(this.program);
        
        // Set uniforms
        const radixLocation = this.gl.getUniformLocation(this.program, 'u_radix');
        this.gl.uniform1i(radixLocation, this.RADIX);
        
        // Draw the quad
        this.drawQuad();
        
        // Read back the results
        const results = new Float32Array(textureSide * textureSide * 4);
        this.gl.readPixels(
            0, 0,
            textureSide, textureSide,
            this.gl.RGBA,
            this.gl.FLOAT,
            results
        );
        
        return results;
    }

    convertToString(processedData) {
        // Convert the processed data to our safe character set
        let result = '';
        for (let i = 0; i < processedData.length; i++) {
            const value = Math.floor(processedData[i]);
            if (value > 0) { // Skip zero values
                result += this.SAFE_CHARS[value % this.RADIX];
            }
        }
        return result;
    }
}
