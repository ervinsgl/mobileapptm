const axios = require('axios');

class DestinationService {
    /**
     * Get Destination Service credentials from VCAP_SERVICES
     */
    getCredentials() {
        const vcapServices = JSON.parse(process.env.VCAP_SERVICES || '{}');
        const destinationService = vcapServices.destination?.[0];

        if (!destinationService) {
            throw new Error('Destination service not bound to application');
        }

        return destinationService.credentials;
    }

    /**
     * Get destination configuration from BTP
     */
    async getDestination(destinationName) {
        try {
            const credentials = this.getCredentials();

            // Get OAuth token for Destination Service
            const tokenResponse = await axios.post(
                credentials.url + '/oauth/token',
                new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: credentials.clientid,
                    client_secret: credentials.clientsecret
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            const accessToken = tokenResponse.data.access_token;

            // Get destination configuration
            const destinationResponse = await axios.get(
                `${credentials.uri}/destination-configuration/v1/destinations/${destinationName}`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );

            return destinationResponse.data;

        } catch (error) {
            console.error('Error loading destination:', error.response?.data || error.message);
            throw new Error('Failed to load destination');
        }
    }
}

module.exports = new DestinationService();