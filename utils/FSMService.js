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
            const fullUrl = `${baseUrl}/api/data/v4${path}`;

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

            const baseUrl = destination.destinationConfiguration.URL;
            const fullUrl = `${baseUrl}/api/service-management/v2/composite-tree/service-calls/${serviceCallId}`;

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

            const baseUrl = destination.destinationConfiguration.URL;
            const fullUrl = `${baseUrl}/cloud-org-level-service/api/v1/levels`;

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
        const fullUrl = `${baseUrl}/api/data/v4/Activity/${activityId}`;

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

    /**
     * Make Query API request (for /api/query/v1 endpoints)
     */
    async makeQueryRequest(query, dtos) {
        try {
            const destination = await DestinationService.getDestination('FSM_S4E');
            const token = await TokenCache.getToken(destination);

            const baseUrl = destination.destinationConfiguration.URL;
            const queryUrl = `${baseUrl}/api/query/v1`;

            const queryParams = {
                query: query,
                dtos: dtos,
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

            const response = await axios.get(queryUrl, {
                params: queryParams,
                headers: headers
            });

            return response.data;

        } catch (error) {
            console.error('FSM Query API Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get Time Efforts for activity
     */
    async getTimeEffortsForActivity(activityId) {
        try {
            const query = `SELECT timeEffort FROM TimeEffort timeEffort WHERE timeEffort.object.objectId = '${activityId}'`;
            const data = await this.makeQueryRequest(query, 'TimeEffort.17');

            if (!data.data || data.data.length === 0) {
                return [];
            }

            console.log('\n=== TIME EFFORT FULL DATA ===');
            data.data.forEach((item, index) => {
                console.log(`Time Effort ${index + 1}:`, JSON.stringify(item.timeEffort, null, 2));
            });
            console.log('============================\n');

            return data.data.map(item => ({
                id: item.timeEffort.id,
                createDateTime: item.timeEffort.createDateTime,
                fullData: item.timeEffort // ✅ Keep full object for analysis
            }));
        } catch (error) {
            console.error("Error fetching time efforts:", error.message);
            return [];
        }
    }

    /**
     * Get Materials for activity
     */
    async getMaterialsForActivity(activityId) {
        try {
            const query = `SELECT w FROM Material w WHERE w.object.objectId = '${activityId}'`;
            const data = await this.makeQueryRequest(query, 'Material.22');

            if (!data.data || data.data.length === 0) {
                return [];
            }

            console.log('\n=== MATERIAL FULL DATA ===');
            data.data.forEach((item, index) => {
                console.log(`Material ${index + 1}:`, JSON.stringify(item.w, null, 2));
            });
            console.log('===========================\n');

            return data.data.map(item => ({
                id: item.w.id,
                createDateTime: item.w.createDateTime,
                fullData: item.w // ✅ Keep full object for analysis
            }));
        } catch (error) {
            console.error("Error fetching materials:", error);
            return [];
        }
    }

    /**
     * Get Expenses for activity
     */
    async getExpensesForActivity(activityId) {
        try {
            const query = `SELECT w FROM Expense w WHERE w.object.objectId = '${activityId}'`;
            const data = await this.makeQueryRequest(query, 'Expense.17');

            if (!data.data || data.data.length === 0) {
                return [];
            }

            console.log('\n=== EXPENSE FULL DATA ===');
            data.data.forEach((item, index) => {
                console.log(`Expense ${index + 1}:`, JSON.stringify(item.w, null, 2));
            });
            console.log('=========================\n');

            return data.data.map(item => ({
                id: item.w.id,
                createDateTime: item.w.createDateTime,
                fullData: item.w // ✅ Keep full object for analysis
            }));
        } catch (error) {
            console.error("Error fetching expenses:", error);
            return [];
        }
    }

    /**
     * Get Mileages for activity
     */
    async getMileagesForActivity(activityId) {
        try {
            const query = `SELECT w FROM Mileage w WHERE w.object.objectId = '${activityId}'`;
            const data = await this.makeQueryRequest(query, 'Mileage.19');

            if (!data.data || data.data.length === 0) {
                return [];
            }

            console.log('\n=== MILEAGE FULL DATA ===');
            data.data.forEach((item, index) => {
                console.log(`Mileage ${index + 1}:`, JSON.stringify(item.w, null, 2));
            });
            console.log('=========================\n');

            return data.data.map(item => ({
                id: item.w.id,
                createDateTime: item.w.createDateTime,
                fullData: item.w // ✅ Keep full object for analysis
            }));
        } catch (error) {
            console.error("Error fetching mileages:", error);
            return [];
        }
    }
}

module.exports = new FSMService();