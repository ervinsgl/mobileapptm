/**
 * URLHelper.js
 * 
 * Frontend utility for URL parameter handling and web container context.
 * Manages activity/service call ID resolution from multiple sources.
 * 
 * Key Features:
 * - Parse URL query parameters
 * - Fetch web container context from FSM Mobile
 * - Resolve activity ID or service call ID from URL or web container
 * - Cache web container context for session
 * 
 * Object Sources (in priority order):
 * 1. URL parameter: ?activityId=xxx or ?serviceCallId=xxx
 * 2. Web container context: cloudId (when objectType=ACTIVITY or SERVICECALL)
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
     * Object types supported by the app
     */
    const OBJECT_TYPES = {
        ACTIVITY: 'ACTIVITY',
        SERVICECALL: 'SERVICECALL'
    };

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
         * Supported object types
         */
        OBJECT_TYPES,

        /**
         * Get URL parameters as object.
         * @returns {{activityId: string|null, serviceCallId: string|null, activityCode: string|null, activitySubject: string|null}}
         */
        getUrlParameters() {
            const urlParams = new URLSearchParams(window.location.search);
            return {
                activityId: urlParams.get('activityId'),
                serviceCallId: urlParams.get('serviceCallId'),
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
         * Check if service call ID exists in URL.
         * @returns {boolean}
         */
        hasServiceCallId() {
            return !!this.getUrlParameters().serviceCallId;
        },

        /**
         * Get activity ID from URL.
         * @returns {string|null}
         */
        getActivityId() {
            return this.getUrlParameters().activityId;
        },

        /**
         * Get service call ID from URL.
         * @returns {string|null}
         */
        getServiceCallId() {
            return this.getUrlParameters().serviceCallId;
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
         * Get the context info - determines object type and ID.
         * Checks URL params first, then web container context.
         * @returns {Promise<{objectType: string, objectId: string}|null>} Context info or null
         */
        async getContextInfo() {
            // Priority 1: URL parameters
            const urlParams = this.getUrlParameters();
            
            if (urlParams.activityId) {
                console.log('URLHelper: Found activityId in URL params:', urlParams.activityId);
                return {
                    objectType: OBJECT_TYPES.ACTIVITY,
                    objectId: urlParams.activityId,
                    source: 'URL'
                };
            }
            
            if (urlParams.serviceCallId) {
                console.log('URLHelper: Found serviceCallId in URL params:', urlParams.serviceCallId);
                return {
                    objectType: OBJECT_TYPES.SERVICECALL,
                    objectId: urlParams.serviceCallId,
                    source: 'URL'
                };
            }

            // Priority 2: Web container context
            const context = await this.fetchWebContainerContext();
            if (context && context.cloudId) {
                const objectType = (context.objectType || '').toUpperCase();
                
                if (objectType === 'ACTIVITY') {
                    console.log('URLHelper: Found Activity in web container context:', context.cloudId);
                    return {
                        objectType: OBJECT_TYPES.ACTIVITY,
                        objectId: context.cloudId,
                        source: 'WebContainer'
                    };
                }
                
                if (objectType === 'SERVICECALL') {
                    console.log('URLHelper: Found ServiceCall in web container context:', context.cloudId);
                    return {
                        objectType: OBJECT_TYPES.SERVICECALL,
                        objectId: context.cloudId,
                        source: 'WebContainer'
                    };
                }
                
                console.log('URLHelper: Unknown objectType in web container:', objectType);
            }

            console.log('URLHelper: No context found');
            return null;
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
         * Get service call ID from any source (URL params or web container).
         * @returns {Promise<string|null>} Service Call ID or null
         */
        async getServiceCallIdAsync() {
            const urlServiceCallId = this.getServiceCallId();
            if (urlServiceCallId) {
                return urlServiceCallId;
            }

            const context = await this.fetchWebContainerContext();
            if (context && context.cloudId) {
                const objectType = (context.objectType || '').toUpperCase();
                if (objectType === 'SERVICECALL') {
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
         * Check if service call ID is available from any source.
         * @returns {Promise<boolean>}
         */
        async hasServiceCallIdAsync() {
            const serviceCallId = await this.getServiceCallIdAsync();
            return !!serviceCallId;
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