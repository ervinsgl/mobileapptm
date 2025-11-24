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

                    // ADD REQUESTED FIELDS
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

                    // PRE-FORMATTED DISPLAY TEXT
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

            return data.data.map(item => {
                const material = item.w;

                console.log(`\n=== PROCESSED MATERIAL ===`);
                console.log('ID:', material.id);
                console.log('Item ID:', material.item);
                console.log('Quantity:', material.quantity);
                console.log('Date:', material.date);
                console.log('Charge Option:', material.chargeOption);
                console.log('Create Person:', material.createPerson);
                console.log('Remarks:', material.remarks);
                console.log('Sync Status:', material.syncStatus);
                console.log('=============================\n');

                return {
                    id: material.id,
                    createDateTime: material.createDateTime,

                    // Basic fields
                    createPerson: material.createPerson || 'N/A',
                    orgLevel: material.orgLevel || 'N/A',
                    chargeOption: material.chargeOption || 'N/A',
                    syncStatus: material.syncStatus || 'N/A',

                    // Material-specific fields
                    date: material.date || null,
                    quantity: material.quantity || 0,
                    remarks: material.remarks || null,

                    // Just use the item ID directly
                    itemDisplayText: material.item || 'N/A',

                    // Display type
                    type: 'Material',

                    // Pre-formatted display text
                    quantityText: material.quantity ? `${material.quantity}` : 'N/A',
                    dateText: material.date || 'N/A',
                    remarksText: material.remarks || 'N/A',

                    // Keep full data for reference
                    fullData: material
                };
            });
        } catch (error) {
            console.error("Error fetching materials:", error.message);
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
            console.log('==========================\n');

            return data.data.map(item => {
                const expense = item.w;

                // Extract UDF values (same pattern as TimeEffort)
                const udfValues = expense.udfValues || [];
                const udfValuesText = udfValues.map(udf => `${udf.meta}: ${udf.value}`).join(', ') || 'N/A';

                // Extract amount information
                const externalAmount = expense.externalAmount ?
                    `${expense.externalAmount.amount} ${expense.externalAmount.currency}` : 'N/A';
                const internalAmount = expense.internalAmount ?
                    `${expense.internalAmount.amount} ${expense.internalAmount.currency}` : 'N/A';

                console.log(`\n=== PROCESSED EXPENSE ===`);
                console.log('ID:', expense.id);
                console.log('Date:', expense.date);
                console.log('Type:', expense.type);
                console.log('External Amount:', externalAmount);
                console.log('Internal Amount:', internalAmount);
                console.log('Charge Option:', expense.chargeOption);
                console.log('Create Person:', expense.createPerson);
                console.log('Org Level:', expense.orgLevel);
                console.log('Remarks:', expense.remarks);
                console.log('Sync Status:', expense.syncStatus);
                console.log('UDF Values:', udfValuesText);
                console.log('=============================\n');

                return {
                    id: expense.id,
                    createDateTime: expense.createDateTime,

                    // BASIC FIELDS (matching TimeEffort/Material pattern)
                    createPerson: expense.createPerson || 'N/A',
                    orgLevel: expense.orgLevel || 'N/A',
                    chargeOption: expense.chargeOption || 'N/A',
                    syncStatus: expense.syncStatus || 'N/A',

                    // EXPENSE-SPECIFIC FIELDS
                    date: expense.date || null,
                    type: expense.type || 'N/A',
                    externalAmount: expense.externalAmount,
                    internalAmount: expense.internalAmount,
                    remarks: expense.remarks || null,

                    // UDF INFORMATION
                    udfValues: udfValues,
                    udfValuesText: udfValuesText,

                    // DISPLAY TYPE
                    type: 'Expense',

                    // PRE-FORMATTED DISPLAY TEXT (no complex expressions needed in UI)
                    dateText: expense.date || 'N/A',
                    expenseTypeText: expense.type || 'N/A',
                    externalAmountText: externalAmount,
                    internalAmountText: internalAmount,
                    remarksText: expense.remarks || 'N/A',

                    // KEEP FULL DATA FOR REFERENCE
                    fullData: expense
                };
            });
        } catch (error) {
            console.error("Error fetching expenses:", error.message);
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
            console.log('==========================\n');

            return data.data.map(item => {
                const mileage = item.w;

                // Extract UDF values (same pattern as other types)
                const udfValues = mileage.udfValues || [];
                const udfValuesText = udfValues.map(udf => `${udf.meta}: ${udf.value}`).join(', ') || 'N/A';

                // Format distance with unit
                const distanceText = mileage.distance && mileage.distanceUnit ?
                    `${mileage.distance} ${mileage.distanceUnit}` : 'N/A';

                // Format route
                const routeText = mileage.source && mileage.destination ?
                    `${mileage.source} → ${mileage.destination}` : 'N/A';

                console.log(`\n=== PROCESSED MILEAGE ===`);
                console.log('ID:', mileage.id);
                console.log('Date:', mileage.date);
                console.log('Source:', mileage.source);
                console.log('Destination:', mileage.destination);
                console.log('Distance:', distanceText);
                console.log('Route:', routeText);
                console.log('Driver:', mileage.driver);
                console.log('Private Car:', mileage.privateCar);
                console.log('Travel Start:', mileage.travelStartDateTime);
                console.log('Travel End:', mileage.travelEndDateTime);
                console.log('Charge Option:', mileage.chargeOption);
                console.log('Create Person:', mileage.createPerson);
                console.log('Org Level:', mileage.orgLevel);
                console.log('Remarks:', mileage.remarks);
                console.log('Sync Status:', mileage.syncStatus);
                console.log('UDF Values:', udfValuesText);
                console.log('=============================\n');

                return {
                    id: mileage.id,
                    createDateTime: mileage.createDateTime,

                    // BASIC FIELDS (matching TimeEffort/Material/Expense pattern)
                    createPerson: mileage.createPerson || 'N/A',
                    orgLevel: mileage.orgLevel || 'N/A',
                    chargeOption: mileage.chargeOption || 'N/A',
                    syncStatus: mileage.syncStatus || 'N/A',

                    // MILEAGE-SPECIFIC FIELDS
                    date: mileage.date || null,
                    source: mileage.source || 'N/A',
                    destination: mileage.destination || 'N/A',
                    distance: mileage.distance || 0,
                    distanceUnit: mileage.distanceUnit || 'KM',
                    driver: mileage.driver || false,
                    privateCar: mileage.privateCar || false,
                    travelStartDateTime: mileage.travelStartDateTime || null,
                    travelEndDateTime: mileage.travelEndDateTime || null,
                    remarks: mileage.remarks || null,

                    // âœ… UDF INFORMATION
                    udfValues: udfValues,
                    udfValuesText: udfValuesText,

                    // âœ… DISPLAY TYPE
                    type: 'Mileage',

                    // âœ… PRE-FORMATTED DISPLAY TEXT (no complex expressions needed in UI)
                    dateText: mileage.date || 'N/A',
                    distanceText: distanceText,
                    routeText: routeText,
                    driverText: mileage.driver ? 'Yes' : 'No',
                    privateCarText: mileage.privateCar ? 'Yes' : 'No',
                    remarksText: mileage.remarks || 'N/A',

                    // âœ… KEEP FULL DATA FOR REFERENCE
                    fullData: mileage
                };
            });
        } catch (error) {
            console.error("Error fetching mileages:", error.message);
            return [];
        }
    }

    /**
     * Get all Time Tasks for lookup/dropdown
     * Used to resolve TimeEffort.task ID to human-readable name
     */
    async getTimeTasks() {
        try {
            console.log('FSMService: Fetching Time Tasks...');
            
            const data = await this.makeRequest('/TimeTask', {
                dtos: 'TimeTask.18',
                fields: 'name,id,code'
            });

            if (!data.data || data.data.length === 0) {
                console.log('FSMService: No time tasks found');
                return [];
            }

            console.log('FSMService: Found', data.data.length, 'time tasks');

            // Transform to simple array of task objects
            return data.data.map(item => ({
                id: item.timeTask.id,
                code: item.timeTask.code,
                name: item.timeTask.name
            }));

        } catch (error) {
            console.error("Error fetching time tasks:", error.message);
            return [];
        }
    }

    /**
     * Get all Items for lookup/dropdown
     * Used to resolve Material.item ID and Activity.serviceProduct to human-readable name
     * Excludes tools and Z11% items
     */
    async getItems() {
        try {
            console.log('FSMService: Fetching Items...');
            
            // Query to get all items excluding tools and Z11% items
            const query = `SELECT DISTINCT w.name, w.externalId, w.id 
                           FROM Item w 
                           WHERE w.tool = false 
                           AND w.externalId NOT LIKE 'Z11%'`;
            
            const data = await this.makeQueryRequest(query, 'Item.24');

            if (!data.data || data.data.length === 0) {
                console.log('FSMService: No items found');
                return [];
            }

            console.log('FSMService: Found', data.data.length, 'items');

            // Transform to simple array of item objects
            return data.data.map(item => ({
                id: item.w.id,
                externalId: item.w.externalId,
                name: item.w.name
            }));

        } catch (error) {
            console.error("Error fetching items:", error.message);
            return [];
        }
    }

    /**
     * Get all Expense Types for lookup/dropdown
     * Used to resolve Expense.type ID to human-readable name
     */
    async getExpenseTypes() {
        try {
            console.log('FSMService: Fetching Expense Types...');
            
            const data = await this.makeRequest('/ExpenseType', {
                dtos: 'ExpenseType.17',
                fields: 'name,id,code'
            });

            if (!data.data || data.data.length === 0) {
                console.log('FSMService: No expense types found');
                return [];
            }

            console.log('FSMService: Found', data.data.length, 'expense types');

            // Transform to simple array of expense type objects
            return data.data.map(item => ({
                id: item.expenseType.id,
                code: item.expenseType.code,
                name: item.expenseType.name
            }));

        } catch (error) {
            console.error("Error fetching expense types:", error.message);
            return [];
        }
    }

    /**
     * Get UDF Meta externalId by ID
     * Used to resolve UDF Meta IDs to human-readable externalId names
     * @param {string} udfMetaId - UDF Meta ID
     * @returns {string|null} externalId or null if not found
     */
    async getUdfMetaById(udfMetaId) {
        try {
            console.log('FSMService: Fetching UDF Meta for ID:', udfMetaId);
            
            const query = `SELECT w.externalId FROM UdfMeta w WHERE w.id = '${udfMetaId}'`;
            const data = await this.makeQueryRequest(query, 'UdfMeta.20');

            if (!data.data || data.data.length === 0) {
                console.log('FSMService: No UDF Meta found for ID:', udfMetaId);
                return null;
            }

            const externalId = data.data[0]?.w?.externalId || null;
            console.log('FSMService: Resolved UDF Meta', udfMetaId, 'to externalId:', externalId);

            return externalId;

        } catch (error) {
            console.error("Error fetching UDF Meta:", error.message);
            return null;
        }
    }

    /**
     * Get Approval Decision Status for a T&M entry
     * @param {string} objectId - The T&M entry ID (TimeEffort, Material, Expense, or Mileage)
     * @returns {string|null} Decision status (PENDING, REVIEW, APPROVED, DECLINED, etc.)
     */
    async getApprovalStatus(objectId) {
        try {
            console.log('FSMService: Fetching Approval status for object:', objectId);
            
            const query = `SELECT w.decisionStatus FROM Approval w WHERE w.object.objectId = '${objectId}'`;
            const data = await this.makeQueryRequest(query, 'Approval.15');

            if (!data.data || data.data.length === 0) {
                console.log('FSMService: No Approval found for object:', objectId);
                return null;
            }

            const decisionStatus = data.data[0]?.w?.decisionStatus || null;
            console.log('FSMService: Approval status for', objectId, ':', decisionStatus);

            return decisionStatus;

        } catch (error) {
            console.error("Error fetching Approval status:", error.message);
            return null;
        }
    }

    /**
     * Get Approval Decision Status for multiple T&M entries (individual queries)
     * @param {string[]} objectIds - Array of T&M entry IDs
     * @returns {Object} Map of objectId -> decisionStatus
     */
    async getApprovalStatusBatch(objectIds) {
        try {
            if (!objectIds || objectIds.length === 0) {
                return {};
            }

            console.log('FSMService: Fetching Approval status for', objectIds.length, 'objects');
            
            const statusMap = {};
            
            // Process in parallel with Promise.all for better performance
            const promises = objectIds.map(async (objectId) => {
                try {
                    const query = `SELECT w.decisionStatus FROM Approval w WHERE w.object.objectId = '${objectId}'`;
                    const data = await this.makeQueryRequest(query, 'Approval.15');
                    
                    if (data.data && data.data.length > 0) {
                        const decisionStatus = data.data[0]?.w?.decisionStatus;
                        if (decisionStatus) {
                            statusMap[objectId] = decisionStatus;
                            console.log('FSMService: Approval for', objectId, ':', decisionStatus);
                        }
                    }
                } catch (err) {
                    console.error('FSMService: Error fetching approval for', objectId, ':', err.message);
                }
            });
            
            await Promise.all(promises);

            console.log('FSMService: Retrieved approval statuses:', Object.keys(statusMap).length);

            return statusMap;

        } catch (error) {
            console.error("Error fetching Approval statuses batch:", error.message);
            return {};
        }
    }
}

module.exports = new FSMService();