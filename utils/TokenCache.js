const axios = require('axios');

class TokenCache {
    constructor() {
        this.cachedToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Get FSM OAuth token (cached)
     */
    async getToken(destination) {
        // Return cached token if still valid (with 5 minute buffer)
        if (this.cachedToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 300000) {
            return this.cachedToken;
        }

        return this._fetchNewToken(destination);
    }

    /**
     * Fetch new FSM OAuth token
     */
    async _fetchNewToken(destination) {
        try {
            const config = destination.destinationConfiguration;
            const tokenServiceUrl = config.tokenServiceURL;
            const clientId = config.clientId;
            const clientSecret = config.clientSecret;

            if (!clientId || !clientSecret) {
                throw new Error('Client credentials not found in destination configuration');
            }

            // FSM OAuth: Basic Authentication
            const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
            const authHeader = `Basic ${credentials}`;

            const response = await axios.post(
                tokenServiceUrl,
                'grant_type=client_credentials',
                {
                    headers: {
                        'Authorization': authHeader,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            this.cachedToken = response.data.access_token;
            const expiresIn = response.data.expires_in || 3600;
            this.tokenExpiry = Date.now() + (expiresIn * 1000);

            return this.cachedToken;

        } catch (error) {
            if (error.response?.data?.error === 'too_many_requests') {
                const retryAfter = error.response.headers['retry-after'] || 900;
                throw new Error(`Rate limited. Retry after ${Math.ceil(retryAfter / 60)} minutes.`);
            }
            throw error;
        }
    }
}

module.exports = new TokenCache();