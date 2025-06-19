/**
 * EventBus.js
 * 
 * Unified event system that replaces scattered custom event patterns.
 * Provides type-safe event handling, wildcard support, and performance monitoring.
 */
window.EventBus = class EventBus {
    constructor() {
        this.listeners = new Map();
        this.wildcardListeners = new Map();
        this.eventHistory = new Map();
        this.stats = {
            totalEvents: 0,
            totalListeners: 0,
            performanceMetrics: new Map()
        };
        
        // Performance monitoring
        this.enablePerformanceMonitoring = true;
        this.maxHistorySize = 100;
        
        console.log('EventBus initialized');
    }

    /**
     * Add event listener with optional context
     * @param {string} eventType - Event type or pattern (supports wildcards)
     * @param {Function} handler - Event handler function
     * @param {Object} options - Options (once, context, priority)
     * @returns {Function} Unsubscribe function
     */
    on(eventType, handler, options = {}) {
        if (typeof handler !== 'function') {
            throw new Error('Event handler must be a function');
        }

        const wrappedHandler = this._wrapHandler(handler, options);
        
        if (eventType.includes('*')) {
            this._addWildcardListener(eventType, wrappedHandler);
        } else {
            this._addDirectListener(eventType, wrappedHandler);
        }

        this.stats.totalListeners++;

        // Return unsubscribe function
        return () => this.off(eventType, handler);
    }

    /**
     * Add one-time event listener
     * @param {string} eventType - Event type
     * @param {Function} handler - Event handler function
     * @param {Object} options - Additional options
     * @returns {Function} Unsubscribe function
     */
    once(eventType, handler, options = {}) {
        return this.on(eventType, handler, { ...options, once: true });
    }

    /**
     * Remove event listener
     * @param {string} eventType - Event type
     * @param {Function} handler - Original handler function
     */
    off(eventType, handler) {
        if (eventType.includes('*')) {
            this._removeWildcardListener(eventType, handler);
        } else {
            this._removeDirectListener(eventType, handler);
        }
        
        this.stats.totalListeners = Math.max(0, this.stats.totalListeners - 1);
    }

    /**
     * Emit event to all matching listeners
     * @param {string} eventType - Event type
     * @param {*} data - Event data
     * @param {Object} options - Emit options (async, timeout)
     * @returns {Promise<Array>} Array of handler results if async
     */
    async emit(eventType, data, options = {}) {
        const startTime = this.enablePerformanceMonitoring ? performance.now() : 0;
        
        // Store event in history
        this._recordEvent(eventType, data);
        
        const listeners = this._getMatchingListeners(eventType);
        
        if (listeners.length === 0) {
            return [];
        }

        this.stats.totalEvents++;

        let results = [];
        
        if (options.async === false) {
            // Synchronous execution
            results = this._executeHandlersSync(listeners, eventType, data);
        } else {
            // Asynchronous execution (default)
            results = await this._executeHandlersAsync(listeners, eventType, data, options.timeout);
        }

        // Record performance metrics
        if (this.enablePerformanceMonitoring) {
            const duration = performance.now() - startTime;
            this._recordPerformanceMetric(eventType, duration, listeners.length);
        }

        return results;
    }

    /**
     * Emit event synchronously (legacy compatibility)
     * @param {string} eventType - Event type
     * @param {*} data - Event data
     * @returns {Array} Array of handler results
     */
    emitSync(eventType, data) {
        return this.emit(eventType, data, { async: false });
    }

    /**
     * Wait for a specific event
     * @param {string} eventType - Event type to wait for
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise} Promise that resolves with event data
     */
    waitFor(eventType, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.off(eventType, handler);
                reject(new Error(`Timeout waiting for event: ${eventType}`));
            }, timeout);

            const handler = (data) => {
                clearTimeout(timeoutId);
                resolve(data);
            };

            this.once(eventType, handler);
        });
    }

    /**
     * Create a scoped event emitter for a specific namespace
     * @param {string} namespace - Namespace prefix
     * @returns {Object} Scoped emitter
     */
    createScope(namespace) {
        return {
            on: (eventType, handler, options) => this.on(`${namespace}:${eventType}`, handler, options),
            once: (eventType, handler, options) => this.once(`${namespace}:${eventType}`, handler, options),
            off: (eventType, handler) => this.off(`${namespace}:${eventType}`, handler),
            emit: (eventType, data, options) => this.emit(`${namespace}:${eventType}`, data, options),
            emitSync: (eventType, data) => this.emitSync(`${namespace}:${eventType}`, data)
        };
    }

    /**
     * Get event statistics
     * @returns {Object} Event system statistics
     */
    getStats() {
        return {
            ...this.stats,
            activeListeners: this.listeners.size + this.wildcardListeners.size,
            recentEvents: Array.from(this.eventHistory.keys()).slice(-10)
        };
    }

    /**
     * Get recent events for debugging
     * @param {number} count - Number of recent events to return
     * @returns {Array} Recent events
     */
    getRecentEvents(count = 10) {
        const events = Array.from(this.eventHistory.entries());
        return events.slice(-count).map(([eventType, history]) => ({
            eventType,
            lastEmitted: history.lastEmitted,
            count: history.count,
            lastData: history.lastData
        }));
    }

    /**
     * Clear all listeners and history
     */
    clear() {
        this.listeners.clear();
        this.wildcardListeners.clear();
        this.eventHistory.clear();
        this.stats = {
            totalEvents: 0,
            totalListeners: 0,
            performanceMetrics: new Map()
        };
    }

    /**
     * Wrap handler with options and error handling
     * @private
     */
    _wrapHandler(handler, options) {
        return {
            original: handler,
            wrapped: async (eventType, data) => {
                try {
                    // Apply context if provided
                    const result = options.context 
                        ? handler.call(options.context, data, eventType)
                        : handler(data, eventType);
                    
                    // Handle async handlers
                    return result instanceof Promise ? await result : result;
                } catch (error) {
                    console.error(`Event handler error for ${eventType}:`, error);
                    
                    // Emit error event
                    this.emit('eventbus:handler-error', {
                        eventType,
                        error,
                        handler: handler.name || 'anonymous'
                    });
                    
                    throw error;
                }
            },
            options
        };
    }

    /**
     * Add direct event listener
     * @private
     */
    _addDirectListener(eventType, wrappedHandler) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        
        const handlers = this.listeners.get(eventType);
        
        // Insert based on priority
        const priority = wrappedHandler.options.priority || 0;
        let insertIndex = handlers.length;
        
        for (let i = 0; i < handlers.length; i++) {
            if ((handlers[i].options.priority || 0) < priority) {
                insertIndex = i;
                break;
            }
        }
        
        handlers.splice(insertIndex, 0, wrappedHandler);
    }

    /**
     * Add wildcard event listener
     * @private
     */
    _addWildcardListener(pattern, wrappedHandler) {
        if (!this.wildcardListeners.has(pattern)) {
            this.wildcardListeners.set(pattern, []);
        }
        this.wildcardListeners.get(pattern).push(wrappedHandler);
    }

    /**
     * Remove direct event listener
     * @private
     */
    _removeDirectListener(eventType, originalHandler) {
        const handlers = this.listeners.get(eventType);
        if (!handlers) return;

        const index = handlers.findIndex(h => h.original === originalHandler);
        if (index !== -1) {
            handlers.splice(index, 1);
            if (handlers.length === 0) {
                this.listeners.delete(eventType);
            }
        }
    }

    /**
     * Remove wildcard event listener
     * @private
     */
    _removeWildcardListener(pattern, originalHandler) {
        const handlers = this.wildcardListeners.get(pattern);
        if (!handlers) return;

        const index = handlers.findIndex(h => h.original === originalHandler);
        if (index !== -1) {
            handlers.splice(index, 1);
            if (handlers.length === 0) {
                this.wildcardListeners.delete(pattern);
            }
        }
    }

    /**
     * Get all listeners that match the event type
     * @private
     */
    _getMatchingListeners(eventType) {
        const listeners = [];
        
        // Add direct listeners
        const directListeners = this.listeners.get(eventType) || [];
        listeners.push(...directListeners);
        
        // Add wildcard listeners
        for (const [pattern, handlers] of this.wildcardListeners) {
            if (this._matchesPattern(eventType, pattern)) {
                listeners.push(...handlers);
            }
        }
        
        // Sort by priority (highest first)
        return listeners.sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0));
    }

    /**
     * Check if event type matches wildcard pattern
     * @private
     */
    _matchesPattern(eventType, pattern) {
        const regex = new RegExp(
            '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
        );
        return regex.test(eventType);
    }

    /**
     * Execute handlers synchronously
     * @private
     */
    _executeHandlersSync(listeners, eventType, data) {
        const results = [];
        const toRemove = [];

        for (let i = 0; i < listeners.length; i++) {
            const listener = listeners[i];
            
            try {
                const result = listener.wrapped(eventType, data);
                results.push(result);
                
                // Remove one-time listeners
                if (listener.options.once) {
                    toRemove.push(listener);
                }
            } catch (error) {
                results.push(error);
            }
        }

        // Remove one-time listeners
        toRemove.forEach(listener => {
            this.off(eventType, listener.original);
        });

        return results;
    }

    /**
     * Execute handlers asynchronously
     * @private
     */
    async _executeHandlersAsync(listeners, eventType, data, timeout = 5000) {
        const promises = listeners.map(async (listener) => {
            try {
                const promise = listener.wrapped(eventType, data);
                
                // Add timeout if specified
                if (timeout > 0) {
                    return await Promise.race([
                        promise,
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Handler timeout')), timeout)
                        )
                    ]);
                }
                
                return await promise;
            } catch (error) {
                return error;
            }
        });

        const results = await Promise.allSettled(promises);
        
        // Remove one-time listeners
        const toRemove = listeners.filter(l => l.options.once);
        toRemove.forEach(listener => {
            this.off(eventType, listener.original);
        });

        return results.map(result => 
            result.status === 'fulfilled' ? result.value : result.reason
        );
    }

    /**
     * Record event in history
     * @private
     */
    _recordEvent(eventType, data) {
        if (!this.eventHistory.has(eventType)) {
            this.eventHistory.set(eventType, {
                count: 0,
                firstEmitted: Date.now(),
                lastEmitted: 0,
                lastData: null
            });
        }

        const history = this.eventHistory.get(eventType);
        history.count++;
        history.lastEmitted = Date.now();
        history.lastData = data;

        // Trim history if too large
        if (this.eventHistory.size > this.maxHistorySize) {
            const firstKey = this.eventHistory.keys().next().value;
            this.eventHistory.delete(firstKey);
        }
    }

    /**
     * Record performance metrics
     * @private
     */
    _recordPerformanceMetric(eventType, duration, listenerCount) {
        if (!this.stats.performanceMetrics.has(eventType)) {
            this.stats.performanceMetrics.set(eventType, {
                totalDuration: 0,
                totalEmits: 0,
                avgDuration: 0,
                maxDuration: 0,
                avgListeners: 0
            });
        }

        const metrics = this.stats.performanceMetrics.get(eventType);
        metrics.totalDuration += duration;
        metrics.totalEmits++;
        metrics.avgDuration = metrics.totalDuration / metrics.totalEmits;
        metrics.maxDuration = Math.max(metrics.maxDuration, duration);
        metrics.avgListeners = (metrics.avgListeners + listenerCount) / 2;

        // Warn about slow events
        if (duration > 100) {
            console.warn(`Slow event handler for ${eventType}: ${duration.toFixed(2)}ms`);
        }
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.clear();
        console.log('EventBus cleaned up');
    }
};