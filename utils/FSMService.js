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

            return data.data.map(item => {
                const timeEffort = item.timeEffort;

                // Extract ALL UDF values (there can be multiple)
                const udfValues = timeEffort.udfValues || [];
                const udfValuesText = udfValues.map(udf => `${udf.meta}: ${udf.value}`).join(', ') || 'N/A';

                // Calculate duration in minutes
                let durationMinutes = 'N/A';
                if (timeEffort.startDateTime && timeEffort.endDateTime) {
                    const startTime = new Date(timeEffort.startDateTime);
                    const endTime = new Date(timeEffort.endDateTime);
                    durationMinutes = Math.round((endTime - startTime) / (1000 * 60));
                }

                // Handle remarks - prioritize internalRemarks, then remarks
                const remarks = timeEffort.internalRemarks || timeEffort.remarks || 'N/A';

                console.log(`\n=== PROCESSED TIME EFFORT ===`);
                console.log('ID:', timeEffort.id);
                console.log('Duration Minutes:', durationMinutes);
                console.log('Start:', timeEffort.startDateTime);
                console.log('End:', timeEffort.endDateTime);
                console.log('Charge Option:', timeEffort.chargeOption);
                console.log('Create Person:', timeEffort.createPerson);
                console.log('Org Level:', timeEffort.orgLevel);
                console.log('Internal Remarks:', timeEffort.internalRemarks);
                console.log('Remarks:', timeEffort.remarks);
                console.log('UDF Values:', udfValuesText);
                console.log('===============================\n');

                return {
                    id: timeEffort.id,
                    createDateTime: timeEffort.createDateTime,

                    // ✅ ADD REQUESTED FIELDS
                    createPerson: timeEffort.createPerson || 'N/A',
                    orgLevel: timeEffort.orgLevel || 'N/A',
                    chargeOption: timeEffort.chargeOption || 'N/A',
                    internalRemarksText: timeEffort.internalRemarks || 'N/A',
                    remarksText: timeEffort.remarks || 'N/A',

                    // Existing fields
                    task: timeEffort.task || 'N/A',
                    startDateTime: timeEffort.startDateTime || null,
                    endDateTime: timeEffort.endDateTime || null,
                    udfValues: udfValues, // Keep array for complex processing
                    udfValuesText: udfValuesText, // Simple string for display
                    durationMinutes: durationMinutes,
                    syncStatus: timeEffort.syncStatus || 'N/A',
                    type: 'Time Effort',

                    // ✅ PRE-FORMATTED DISPLAY TEXT
                    remarksText: remarks, // Already processed above
                    durationText: typeof durationMinutes === 'number' ? `${durationMinutes} min` : 'N/A',

                    fullData: timeEffort // Keep full object for debugging
                };
            });
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