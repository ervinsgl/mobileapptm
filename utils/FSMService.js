const axios = require('axios');
const DestinationService = require('./DestinationService');
const TokenCache = require('./TokenCache');

class FSMService {
    constructor() {
        this.config = {
            account: 'tuev-nord_t1',
            company: 'TUEV-NORD_S4E'
        };
    }

    /**
     * Make authenticated request to FSM API (for /api/data/v4 endpoints)
     */
    async makeRequest(path, params = {}) {
        try {
            const destination = await DestinationService.getDestination('FSM_S4E');
            const token = await TokenCache.getToken(destination);

            const baseUrl = destination.destinationConfiguration.URL;
            const fullUrl = `${baseUrl}${path}`;

            const queryParams = {
                ...params,
                account: destination.destinationConfiguration.account || this.config.account,
                company: destination.destinationConfiguration.company || this.config.company
            };

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Account-ID': destination.destinationConfiguration['URL.headers.X-Account-ID'],
                'X-Company-ID': destination.destinationConfiguration['URL.headers.X-Company-ID'],
                'X-Client-ID': destination.destinationConfiguration['URL.headers.X-Client-ID'],
                'X-Client-Version': destination.destinationConfiguration['URL.headers.X-Client-Version']
            };

            const response = await axios.get(fullUrl, {
                params: queryParams,
                headers: headers
            });

            return response.data;

        } catch (error) {
            console.error('FSM API Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get activity by ID
     */
    async getActivityById(activityId) {
        return this.makeRequest(`/Activity/${activityId}`, { dtos: 'Activity.40' });
    }

    /**
     * Get activity by code
     */
    async getActivityByCode(activityCode) {
        return this.makeRequest(`/Activity/externalId/${activityCode}`, { dtos: 'Activity.40' });
    }

    /**
     * Get activities for service call (uses different API endpoint)
     */
    async getActivitiesForServiceCall(serviceCallId) {
        try {
            const destination = await DestinationService.getDestination('FSM_S4E');
            const token = await TokenCache.getToken(destination);

            // Get base cloud host (remove /api/data/v4 from URL)
            const baseUrl = destination.destinationConfiguration.URL;
            const cloudHost = baseUrl.replace('/api/data/v4', '');
            
            // Build service-management API URL
            const fullUrl = `${cloudHost}/api/service-management/v2/composite-tree/service-calls/${serviceCallId}`;

            console.log('Fetching activities from:', fullUrl);

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Client-ID': 'FSM_EXTENSION',
                'X-Client-Version': '1.0.0',
                'X-Account-ID': destination.destinationConfiguration['URL.headers.X-Account-ID'],
                'X-Company-ID': destination.destinationConfiguration['URL.headers.X-Company-ID']
            };

            const response = await axios.get(fullUrl, { headers });
            
            console.log('Activities response:', response.data);
            
            return response.data;

        } catch (error) {
            console.error('FSM API Error (composite-tree):', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get organizational levels
     */
    async getOrganizationalLevels() {
        try {
            const destination = await DestinationService.getDestination('FSM_S4E');
            const token = await TokenCache.getToken(destination);

            // Get base cloud host (remove /api/data/v4 from URL) 
            const baseUrl = destination.destinationConfiguration.URL;
            const cloudHost = baseUrl.replace('/api/data/v4', '');
            
            // Build organizational levels API URL
            const fullUrl = `${cloudHost}/cloud-org-level-service/api/v1/levels`;

            console.log('Fetching organizational levels from:', fullUrl);

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Account-ID': destination.destinationConfiguration['URL.headers.X-Account-ID'],
                'X-Company-ID': destination.destinationConfiguration['URL.headers.X-Company-ID']
            };

            const response = await axios.get(fullUrl, { headers });
            
            console.log('Organizational levels response:', response.data);
            
            return response.data;

        } catch (error) {
            console.error('FSM API Error (organizational-levels):', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Update activity
     */
    async updateActivity(activityId, updateData) {
        const destination = await DestinationService.getDestination('FSM_S4E');
        const token = await TokenCache.getToken(destination);

        const baseUrl = destination.destinationConfiguration.URL;
        const fullUrl = `${baseUrl}/Activity/${activityId}`;

        const queryParams = {
            dtos: 'Activity.40',
            account: destination.destinationConfiguration.account || this.config.account,
            company: destination.destinationConfiguration.company || this.config.company
        };

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Account-ID': destination.destinationConfiguration['URL.headers.X-Account-ID'],
            'X-Company-ID': destination.destinationConfiguration['URL.headers.X-Company-ID'],
            'X-Client-ID': destination.destinationConfiguration['URL.headers.X-Client-ID'],
            'X-Client-Version': destination.destinationConfiguration['URL.headers.X-Client-Version']
        };

        const response = await axios.put(fullUrl, updateData, {
            params: queryParams,
            headers: headers
        });

        return response.data;
    }
}

module.exports = new FSMService();