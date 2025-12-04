/**
 * URLHelper.js
 * 
 * Frontend utility for URL parameter handling and web container context.
 * Manages activity ID resolution from multiple sources.
 * 
 * Key Features:
 * - Parse URL query parameters
 * - Fetch web container context from FSM Mobile
 * - Resolve activity ID from URL or web container
 * - Cache web container context for session
 * 
 * Activity ID Sources (in priority order):
 * 1. URL parameter: ?activityId=xxx
 * 2. Web container context: cloudId (when objectType=ACTIVITY)
 * 
 * Web Container Context:
 * When app is opened from FSM Mobile, context is available at /web-container-context
 * Contains: cloudId, objectType, and other FSM context data
 * 
 * @file URLHelper.js
 * @module mobileappsc/utils/helpers/URLHelper
 */
sap.ui.define([], () => {
    "use strict";

    /**
     * Cached web container context.
     * @type {Object|null}
     * @private
     */
    let _webContainerContext = null;
    
    /**
     * Flag indicating if context has been checked.
     * @type {boolean}
     * @private
     */
    let _webContainerChecked = false;

    return {
        /**
         * Get URL parameters as object.
         * @returns {{activityId: string|null, activityCode: string|null, activitySubject: string|null}}
         */
        getUrlParameters() {
            const urlParams = new URLSearchParams(window.location.search);
            return {
                activityId: urlParams.get('activityId'),
                activityCode: urlParams.get('activityCode'),
                activitySubject: urlParams.get('activitySubject')
            };
        },

        /**
         * Check if activity ID exists in URL.
         * @returns {boolean}
         */
        hasActivityId() {
            return !!this.getUrlParameters().activityId;
        },

        /**
         * Get activity ID from URL.
         * @returns {string|null}
         */
        getActivityId() {
            return this.getUrlParameters().activityId;
        },

        /**
         * Fetch web container context from server.
         * Called when app is opened from FSM Mobile web container.
         * @returns {Promise<Object|null>} Context object or null
         */
        async fetchWebContainerContext() {
            if (_webContainerChecked) {
                return _webContainerContext;
            }

            try {
                const response = await fetch('/web-container-context', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (!response.ok) {
                    _webContainerChecked = true;
                    _webContainerContext = null;
                    return null;
                }

                _webContainerContext = await response.json();
                _webContainerChecked = true;

                return _webContainerContext;

            } catch (error) {
                console.error('URLHelper: Error fetching web container context:', error);
                _webContainerChecked = true;
                _webContainerContext = null;
                return null;
            }
        },

        /**
         * Get activity ID from any source (URL params or web container).
         * Checks URL params first, then web container context.
         * @returns {Promise<string|null>} Activity ID or null
         */
        async getActivityIdAsync() {
            const urlActivityId = this.getActivityId();
            if (urlActivityId) {
                return urlActivityId;
            }

            const context = await this.fetchWebContainerContext();
            if (context && context.cloudId) {
                const objectType = (context.objectType || '').toUpperCase();
                if (objectType === 'ACTIVITY') {
                    return context.cloudId;
                }
            }

            return null;
        },

        /**
         * Check if activity ID is available from any source.
         * @returns {Promise<boolean>}
         */
        async hasActivityIdAsync() {
            const activityId = await this.getActivityIdAsync();
            return !!activityId;
        },

        /**
         * Get full web container context (cached).
         * @returns {Object|null}
         */
        getWebContainerContext() {
            return _webContainerContext;
        },

        /**
         * Set web container context (used when context is fetched elsewhere).
         * @param {Object} context - Web container context object
         */
        setWebContainerContext(context) {
            _webContainerContext = context;
            _webContainerChecked = true;
        },

        /**
         * Clear cached web container context.
         */
        clearWebContainerContext() {
            _webContainerContext = null;
            _webContainerChecked = false;
        }
    };
});