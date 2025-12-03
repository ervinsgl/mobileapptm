sap.ui.define([], () => {
    "use strict";

    // Cache for web container context
    let _webContainerContext = null;
    let _webContainerChecked = false;

    return {
        /**
         * Get URL parameters as object
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
         * Check if activity ID exists in URL
         */
        hasActivityId() {
            return !!this.getUrlParameters().activityId;
        },

        /**
         * Get activity ID from URL
         */
        getActivityId() {
            return this.getUrlParameters().activityId;
        },

        /**
         * Fetch web container context from server
         * Called when app is opened from FSM Mobile web container
         * @returns {Promise<Object|null>} Context object or null
         */
        async fetchWebContainerContext() {
            if (_webContainerChecked) {
                return _webContainerContext;
            }

            try {
                console.log('URLHelper: Fetching web container context...');
                
                const response = await fetch('/web-container-context', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (!response.ok) {
                    console.log('URLHelper: No web container context available');
                    _webContainerChecked = true;
                    _webContainerContext = null;
                    return null;
                }

                _webContainerContext = await response.json();
                _webContainerChecked = true;

                console.log('URLHelper: Web container context received');
                console.log('  cloudId:', _webContainerContext.cloudId);
                console.log('  objectType:', _webContainerContext.objectType);                
                console.log('Full context:', _webContainerContext);

                return _webContainerContext;

            } catch (error) {
                console.error('URLHelper: Error fetching web container context:', error);
                _webContainerChecked = true;
                _webContainerContext = null;
                return null;
            }
        },

        /**
         * Get activity ID from any source (URL params or web container)
         * Checks URL params first, then web container context
         * @returns {Promise<string|null>} Activity ID or null
         */
        async getActivityIdAsync() {
            // First check URL params (external app flow)
            const urlActivityId = this.getActivityId();
            if (urlActivityId) {
                console.log('URLHelper: Activity ID from URL:', urlActivityId);
                return urlActivityId;
            }

            // Then check web container context
            const context = await this.fetchWebContainerContext();
            if (context && context.cloudId) {
                // Check objectType (case-insensitive - FSM sends "ACTIVITY" uppercase)
                const objectType = (context.objectType || '').toUpperCase();
                if (objectType === 'ACTIVITY') {
                    console.log('URLHelper: Activity ID from web container:', context.cloudId);
                    return context.cloudId;
                } else {
                    console.log('URLHelper: Web container objectType is not Activity:', context.objectType);
                }
            }

            console.log('URLHelper: No activity ID found');
            return null;
        },

        /**
         * Check if activity ID is available from any source
         * @returns {Promise<boolean>}
         */
        async hasActivityIdAsync() {
            const activityId = await this.getActivityIdAsync();
            return !!activityId;
        },

        /**
         * Get full web container context (cached)
         * @returns {Object|null}
         */
        getWebContainerContext() {
            return _webContainerContext;
        },

        /**
         * Set web container context (used when context is fetched elsewhere)
         * @param {Object} context - Web container context object
         */
        setWebContainerContext(context) {
            _webContainerContext = context;
            _webContainerChecked = true;
            console.log('URLHelper: Web container context set manually');
        },

        /**
         * Clear cached web container context
         */
        clearWebContainerContext() {
            _webContainerContext = null;
            _webContainerChecked = false;
        }
    };
});