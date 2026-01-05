/**
 * FSMService.js
 * 
 * Backend service for SAP FSM (Field Service Management) API integration.
 * Provides methods for all FSM data operations including activities, T&M entries,
 * lookup data, and user/organization management.
 * 
 * Key Features:
 * - Authenticated requests to FSM Data API (/api/data/v4)
 * - Query API requests (/api/query/v1)
 * - Composite-tree API for service calls (/api/service-management/v2)
 * - User and Organization API integration
 * - T&M entry retrieval (TimeEffort, Material, Expense, Mileage)
 * - Lookup data (TimeTasks, Items, ExpenseTypes, Persons)
 * 
 * API Endpoints Used:
 * - /api/data/v4/* - CRUD operations
 * - /api/query/v1 - Query operations
 * - /api/service-management/v2/composite-tree - Service call with activities
 * - /api/user/v1/users - User lookup
 * - /cloud-org-level-service/api/v1/levels - Organization hierarchy
 * 
 * @file FSMService.js
 * @module utils/FSMService
 * @requires axios
 * @requires ./DestinationService
 * @requires ./TokenCache
 */
const axios = require('axios');
const DestinationService = require('./DestinationService');
const TokenCache = require('./TokenCache');

class FSMService {
    constructor() {
        /**
         * Default FSM account/company configuration.
         * @type {{account: string, company: string}}
         */
        this.config = {
            account: 'tuev-nord_t1',
            company: 'TUEV-NORD_S4E'
        };
    }

    /**
     * Make authenticated request to FSM Data API (/api/data/v4 endpoints).
     * @param {string} path - API path (e.g., '/Activity/123')
     * @param {Object} [params={}] - Query parameters
     * @returns {Promise<Object>} API response data
     * @throws {Error} If request fails
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
            console.error('FSMService: API Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Make POST request to FSM API.
     * @param {string} path - API path (e.g., '/Expense')
     * @param {Object} data - Request body
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} API response
     */
    async postRequest(path, data, params = {}) {
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

            const response = await axios.post(fullUrl, data, {
                params: queryParams,
                headers: headers
            });

            return response.data;

        } catch (error) {
            console.error('FSMService: POST Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Make PATCH request to FSM API.
     * @param {string} path - API path (e.g., '/Expense/ID')
     * @param {Object} data - Request body
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Response data
     */
    async patchRequest(path, data, params = {}) {
        try {
            const destination = await DestinationService.getDestination('FSM_S4E');
            const token = await TokenCache.getToken(destination);

            const baseUrl = destination.destinationConfiguration.URL;
            const fullUrl = `${baseUrl}/api/data/v4${path}`;

            const queryParams = {
                ...params,
                forceUpdate: true,
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

            const response = await axios.patch(fullUrl, data, {
                params: queryParams,
                headers: headers
            });

            return response.data;

        } catch (error) {
            console.error('FSMService: PATCH Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Update Expense in FSM.
     * @param {string} expenseId - Expense ID
     * @param {Object} expenseData - Expense update payload
     * @returns {Promise<Object>} Updated expense data
     */
    async updateExpense(expenseId, expenseData) {
        return this.patchRequest(`/Expense/${expenseId}`, expenseData, { dtos: 'Expense.17' });
    }

    /**
     * Create Expense in FSM.
     * @param {Object} expenseData - Expense payload
     * @returns {Promise<Object>} Created expense data
     */
    async createExpense(expenseData) {
        return this.postRequest('/Expense', expenseData, { dtos: 'Expense.17' });
    }

    /**
     * Create Mileage in FSM.
     * @param {Object} mileageData - Mileage payload
     * @returns {Promise<Object>} Created mileage data
     */
    async createMileage(mileageData) {
        return this.postRequest('/Mileage', mileageData, { dtos: 'Mileage.19' });
    }

    /**
     * Update Mileage in FSM.
     * @param {string} mileageId - Mileage ID
     * @param {Object} mileageData - Mileage update payload
     * @returns {Promise<Object>} Updated mileage data
     */
    async updateMileage(mileageId, mileageData) {
        return this.patchRequest(`/Mileage/${mileageId}`, mileageData, { dtos: 'Mileage.19' });
    }

    /**
     * Create Material in FSM.
     * @param {Object} materialData - Material payload
     * @returns {Promise<Object>} Created material data
     */
    async createMaterial(materialData) {
        return this.postRequest('/Material', materialData, { dtos: 'Material.22' });
    }

    /**
     * Create TimeEffort in FSM.
     * @param {Object} timeEffortData - TimeEffort payload
     * @returns {Promise<Object>} Created time effort data
     */
    async createTimeEffort(timeEffortData) {
        return this.postRequest('/TimeEffort', timeEffortData, { dtos: 'TimeEffort.17' });
    }

    /**
     * Update Material in FSM.
     * @param {string} materialId - Material ID
     * @param {Object} materialData - Material update payload
     * @returns {Promise<Object>} Updated material data
     */
    async updateMaterial(materialId, materialData) {
        return this.patchRequest(`/Material/${materialId}`, materialData, { dtos: 'Material.22' });
    }

    /**
     * Update TimeEffort in FSM.
     * @param {string} timeEffortId - TimeEffort ID
     * @param {Object} timeEffortData - TimeEffort update payload
     * @returns {Promise<Object>} Updated time effort data
     */
    async updateTimeEffort(timeEffortId, timeEffortData) {
        return this.patchRequest(`/TimeEffort/${timeEffortId}`, timeEffortData, { dtos: 'TimeEffort.17' });
    }

    /**
     * Get activity by ID.
     * @param {string} activityId - Activity ID
     * @returns {Promise<Object>} Activity data
     */
    async getActivityById(activityId) {
        return this.makeRequest(`/Activity/${activityId}`, { dtos: 'Activity.40' });
    }

    /**
     * Get activity by code (external ID).
     * @param {string} activityCode - Activity external code
     * @returns {Promise<Object>} Activity data
     */
    async getActivityByCode(activityCode) {
        return this.makeRequest(`/Activity/externalId/${activityCode}`, { dtos: 'Activity.40' });
    }

    /**
     * Get activities for service call using composite-tree API.
     * @param {string} serviceCallId - Service call ID
     * @returns {Promise<Object>} Service call with nested activities
     */
    async getActivitiesForServiceCall(serviceCallId) {
        try {
            const destination = await DestinationService.getDestination('FSM_S4E');
            const token = await TokenCache.getToken(destination);

            const baseUrl = destination.destinationConfiguration.URL;
            const fullUrl = `${baseUrl}/api/service-management/v2/composite-tree/service-calls/${serviceCallId}`;

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Client-ID': 'FSM_EXTENSION',
                'X-Client-Version': '1.0.0',
                'X-Account-ID': destination.destinationConfiguration['URL.headers.X-Account-ID'],
                'X-Company-ID': destination.destinationConfiguration['URL.headers.X-Company-ID']
            };

            const response = await axios.get(fullUrl, { headers });
            return response.data;

        } catch (error) {
            console.error('FSMService: Composite-tree API Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Update activity.
     * @param {string} activityId - Activity ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated activity data
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
     * Make Query API request (/api/query/v1 endpoints).
     * @param {string} query - FSQL query string
     * @param {string} dtos - DTO version string
     * @returns {Promise<Object>} Query response data
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
            console.error('FSMService: Query API Error:', error.response?.data || error.message);
            throw error;
        }
    }

    // ========================================
    // T&M ENTRY RETRIEVAL
    // ========================================

    /**
     * Get Time Efforts for activity.
     * @param {string} activityId - Activity ID
     * @returns {Promise<Array>} Array of Time Effort objects
     */
    async getTimeEffortsForActivity(activityId) {
        try {
            const query = `SELECT timeEffort FROM TimeEffort timeEffort WHERE timeEffort.object.objectId = '${activityId}'`;
            const data = await this.makeQueryRequest(query, 'TimeEffort.17');

            if (!data.data || data.data.length === 0) {
                return [];
            }

            return data.data.map(item => {
                const timeEffort = item.timeEffort;

                const udfValues = timeEffort.udfValues || [];
                const udfValuesText = udfValues.map(udf => `${udf.meta}: ${udf.value}`).join(', ') || 'N/A';

                let durationMinutes = 'N/A';
                if (timeEffort.startDateTime && timeEffort.endDateTime) {
                    const startTime = new Date(timeEffort.startDateTime);
                    const endTime = new Date(timeEffort.endDateTime);
                    durationMinutes = Math.round((endTime - startTime) / (1000 * 60));
                }

                const remarks = timeEffort.internalRemarks || timeEffort.remarks || 'N/A';

                return {
                    id: timeEffort.id,
                    createDateTime: timeEffort.createDateTime,
                    createPerson: timeEffort.createPerson || 'N/A',
                    orgLevel: timeEffort.orgLevel || 'N/A',
                    chargeOption: timeEffort.chargeOption || 'N/A',
                    internalRemarksText: timeEffort.internalRemarks || 'N/A',
                    remarksText: remarks,
                    task: timeEffort.task || 'N/A',
                    startDateTime: timeEffort.startDateTime || null,
                    endDateTime: timeEffort.endDateTime || null,
                    udfValues: udfValues,
                    udfValuesText: udfValuesText,
                    durationMinutes: durationMinutes,
                    syncStatus: timeEffort.syncStatus || 'N/A',
                    type: 'Time Effort',
                    durationText: typeof durationMinutes === 'number' ? `${durationMinutes} min` : 'N/A',
                    fullData: timeEffort
                };
            });
        } catch (error) {
            console.error("FSMService: Error fetching time efforts:", error.message);
            return [];
        }
    }

    /**
     * Get Materials for activity.
     * @param {string} activityId - Activity ID
     * @returns {Promise<Array>} Array of Material objects
     */
    async getMaterialsForActivity(activityId) {
        try {
            const query = `SELECT w FROM Material w WHERE w.object.objectId = '${activityId}'`;
            const data = await this.makeQueryRequest(query, 'Material.22');

            if (!data.data || data.data.length === 0) {
                return [];
            }

            return data.data.map(item => {
                const material = item.w;

                return {
                    id: material.id,
                    createDateTime: material.createDateTime,
                    createPerson: material.createPerson || 'N/A',
                    orgLevel: material.orgLevel || 'N/A',
                    chargeOption: material.chargeOption || 'N/A',
                    syncStatus: material.syncStatus || 'N/A',
                    date: material.date || null,
                    quantity: material.quantity || 0,
                    remarks: material.remarks || null,
                    itemDisplayText: material.item || 'N/A',
                    type: 'Material',
                    quantityText: material.quantity ? `${material.quantity}` : 'N/A',
                    dateText: material.date || 'N/A',
                    remarksText: material.remarks || 'N/A',
                    fullData: material
                };
            });
        } catch (error) {
            console.error("FSMService: Error fetching materials:", error.message);
            return [];
        }
    }

    /**
     * Get Expenses for activity.
     * @param {string} activityId - Activity ID
     * @returns {Promise<Array>} Array of Expense objects
     */
    async getExpensesForActivity(activityId) {
        try {
            const query = `SELECT w FROM Expense w WHERE w.object.objectId = '${activityId}'`;
            const data = await this.makeQueryRequest(query, 'Expense.17');

            if (!data.data || data.data.length === 0) {
                return [];
            }

            return data.data.map(item => {
                const expense = item.w;

                const udfValues = expense.udfValues || [];
                const udfValuesText = udfValues.map(udf => `${udf.meta}: ${udf.value}`).join(', ') || 'N/A';

                const externalAmount = expense.externalAmount ?
                    `${expense.externalAmount.amount} ${expense.externalAmount.currency}` : 'N/A';
                const internalAmount = expense.internalAmount ?
                    `${expense.internalAmount.amount} ${expense.internalAmount.currency}` : 'N/A';

                return {
                    id: expense.id,
                    createDateTime: expense.createDateTime,
                    createPerson: expense.createPerson || 'N/A',
                    orgLevel: expense.orgLevel || 'N/A',
                    chargeOption: expense.chargeOption || 'N/A',
                    syncStatus: expense.syncStatus || 'N/A',
                    date: expense.date || null,
                    externalAmount: expense.externalAmount,
                    internalAmount: expense.internalAmount,
                    remarks: expense.remarks || null,
                    udfValues: udfValues,
                    udfValuesText: udfValuesText,
                    type: 'Expense',
                    dateText: expense.date || 'N/A',
                    expenseTypeText: expense.type || 'N/A',
                    externalAmountText: externalAmount,
                    internalAmountText: internalAmount,
                    remarksText: expense.remarks || 'N/A',
                    fullData: expense
                };
            });
        } catch (error) {
            console.error("FSMService: Error fetching expenses:", error.message);
            return [];
        }
    }

    /**
     * Get Mileages for activity.
     * @param {string} activityId - Activity ID
     * @returns {Promise<Array>} Array of Mileage objects
     */
    async getMileagesForActivity(activityId) {
        try {
            const query = `SELECT w FROM Mileage w WHERE w.object.objectId = '${activityId}'`;
            const data = await this.makeQueryRequest(query, 'Mileage.19');

            if (!data.data || data.data.length === 0) {
                return [];
            }

            return data.data.map(item => {
                const mileage = item.w;

                const udfValues = mileage.udfValues || [];
                const udfValuesText = udfValues.map(udf => `${udf.meta}: ${udf.value}`).join(', ') || 'N/A';

                const distanceText = mileage.distance && mileage.distanceUnit ?
                    `${mileage.distance} ${mileage.distanceUnit}` : 'N/A';

                const routeText = mileage.source && mileage.destination ?
                    `${mileage.source} â†’ ${mileage.destination}` : 'N/A';

                // Calculate travel duration in minutes
                let travelDurationMinutes = 'N/A';
                if (mileage.travelStartDateTime && mileage.travelEndDateTime) {
                    const startTime = new Date(mileage.travelStartDateTime);
                    const endTime = new Date(mileage.travelEndDateTime);
                    travelDurationMinutes = Math.round((endTime - startTime) / (1000 * 60));
                }

                return {
                    id: mileage.id,
                    createDateTime: mileage.createDateTime,
                    createPerson: mileage.createPerson || 'N/A',
                    orgLevel: mileage.orgLevel || 'N/A',
                    chargeOption: mileage.chargeOption || 'N/A',
                    syncStatus: mileage.syncStatus || 'N/A',
                    date: mileage.date || null,
                    source: mileage.source || 'N/A',
                    destination: mileage.destination || 'N/A',
                    distance: mileage.distance || 0,
                    distanceUnit: mileage.distanceUnit || 'KM',
                    driver: mileage.driver || false,
                    privateCar: mileage.privateCar || false,
                    travelStartDateTime: mileage.travelStartDateTime || null,
                    travelEndDateTime: mileage.travelEndDateTime || null,
                    travelDurationMinutes: travelDurationMinutes,
                    remarks: mileage.remarks || null,
                    udfValues: udfValues,
                    udfValuesText: udfValuesText,
                    type: 'Mileage',
                    dateText: mileage.date || 'N/A',
                    distanceText: distanceText,
                    routeText: routeText,
                    travelDurationText: typeof travelDurationMinutes === 'number' ? `${travelDurationMinutes} min` : 'N/A',
                    driverText: mileage.driver ? 'Yes' : 'No',
                    privateCarText: mileage.privateCar ? 'Yes' : 'No',
                    remarksText: mileage.remarks || 'N/A',
                    fullData: mileage
                };
            });
        } catch (error) {
            console.error("FSMService: Error fetching mileages:", error.message);
            return [];
        }
    }

    // ========================================
    // LOOKUP DATA
    // ========================================

    /**
     * Get all Time Tasks for lookup/dropdown.
     * @returns {Promise<Array<{id: string, code: string, name: string}>>}
     */
    async getTimeTasks() {
        try {
            const data = await this.makeRequest('/TimeTask', {
                dtos: 'TimeTask.18',
                fields: 'name,id,code'
            });

            if (!data.data || data.data.length === 0) {
                return [];
            }

            return data.data.map(item => ({
                id: item.timeTask.id,
                code: item.timeTask.code,
                name: item.timeTask.name
            }));

        } catch (error) {
            console.error("FSMService: Error fetching time tasks:", error.message);
            return [];
        }
    }

    /**
     * Get all Items for lookup/dropdown.
     * Excludes tools and Z11% items.
     * @returns {Promise<Array<{id: string, externalId: string, name: string}>>}
     */
    async getItems() {
        try {
            const query = `SELECT DISTINCT w.name, w.externalId, w.id 
                           FROM Item w 
                           WHERE w.tool = false 
                           AND w.externalId NOT LIKE 'Z11%'`;
            
            const data = await this.makeQueryRequest(query, 'Item.24');

            if (!data.data || data.data.length === 0) {
                return [];
            }

            return data.data.map(item => ({
                id: item.w.id,
                externalId: item.w.externalId,
                name: item.w.name
            }));

        } catch (error) {
            console.error("FSMService: Error fetching items:", error.message);
            return [];
        }
    }

    /**
     * Get all Expense Types for lookup/dropdown.
     * @returns {Promise<Array<{id: string, code: string, name: string}>>}
     */
    async getExpenseTypes() {
        try {
            const data = await this.makeRequest('/ExpenseType', {
                dtos: 'ExpenseType.17',
                fields: 'name,id,code'
            });

            if (!data.data || data.data.length === 0) {
                return [];
            }

            return data.data.map(item => ({
                id: item.expenseType.id,
                code: item.expenseType.code,
                name: item.expenseType.name
            }));

        } catch (error) {
            console.error("FSMService: Error fetching expense types:", error.message);
            return [];
        }
    }

    /**
     * Get UDF Meta externalId by ID.
     * @param {string} udfMetaId - UDF Meta ID
     * @returns {Promise<string|null>} externalId or null if not found
     */
    async getUdfMetaById(udfMetaId) {
        try {
            const query = `SELECT w.externalId FROM UdfMeta w WHERE w.id = '${udfMetaId}'`;
            const data = await this.makeQueryRequest(query, 'UdfMeta.20');

            if (!data.data || data.data.length === 0) {
                return null;
            }

            return data.data[0]?.w?.externalId || null;

        } catch (error) {
            console.error("FSMService: Error fetching UDF Meta:", error.message);
            return null;
        }
    }

    // ========================================
    // APPROVAL STATUS
    // ========================================

    /**
     * Get Approval Decision Status for a T&M entry.
     * @param {string} objectId - The T&M entry ID
     * @returns {Promise<string|null>} Decision status or null
     */
    async getApprovalStatus(objectId) {
        try {
            const query = `SELECT w.decisionStatus FROM Approval w WHERE w.object.objectId = '${objectId}'`;
            const data = await this.makeQueryRequest(query, 'Approval.15');

            if (!data.data || data.data.length === 0) {
                return null;
            }

            return data.data[0]?.w?.decisionStatus || null;

        } catch (error) {
            console.error("FSMService: Error fetching Approval status:", error.message);
            return null;
        }
    }

    /**
     * Get Approval Decision Status for multiple T&M entries.
     * @param {string[]} objectIds - Array of T&M entry IDs
     * @returns {Promise<Object>} Map of objectId to decisionStatus
     */
    async getApprovalStatusBatch(objectIds) {
        try {
            if (!objectIds || objectIds.length === 0) {
                return {};
            }

            const statusMap = {};
            
            const promises = objectIds.map(async (objectId) => {
                try {
                    const query = `SELECT w.decisionStatus FROM Approval w WHERE w.object.objectId = '${objectId}'`;
                    const data = await this.makeQueryRequest(query, 'Approval.15');
                    
                    if (data.data && data.data.length > 0) {
                        const decisionStatus = data.data[0]?.w?.decisionStatus;
                        if (decisionStatus) {
                            statusMap[objectId] = decisionStatus;
                        }
                    }
                } catch (err) {
                    console.error('FSMService: Error fetching approval for', objectId, ':', err.message);
                }
            });
            
            await Promise.all(promises);
            return statusMap;

        } catch (error) {
            console.error("FSMService: Error fetching Approval statuses batch:", error.message);
            return {};
        }
    }

    // ========================================
    // PERSON/TECHNICIAN DATA
    // ========================================

    /**
     * Get all Persons (Technicians).
     * @returns {Promise<Array<{id: string, externalId: string, firstName: string, lastName: string}>>}
     */
    async getPersons() {
        try {
            const query = `SELECT w.id, w.externalId, w.firstName, w.lastName FROM Person w WHERE w.externalId IS NOT NULL`;
            const data = await this.makeQueryRequest(query, 'Person.25');

            if (!data.data || data.data.length === 0) {
                return [];
            }

            return data.data.map(item => ({
                id: item.w.id,
                externalId: item.w.externalId,
                firstName: item.w.firstName || '',
                lastName: item.w.lastName || ''
            }));

        } catch (error) {
            console.error("FSMService: Error fetching persons:", error.message);
            return [];
        }
    }

    /**
     * Get Person by ID.
     * @param {string} personId - Person ID
     * @returns {Promise<Object|null>} Person object or null
     */
    async getPersonById(personId) {
        try {
            if (!personId) return null;

            const query = `SELECT w.id, w.externalId, w.firstName, w.lastName FROM Person w WHERE w.id = '${personId}'`;
            const data = await this.makeQueryRequest(query, 'Person.25');

            if (!data.data || data.data.length === 0) {
                return null;
            }

            return {
                id: data.data[0].w.id,
                externalId: data.data[0].w.externalId,
                firstName: data.data[0].w.firstName || '',
                lastName: data.data[0].w.lastName || ''
            };

        } catch (error) {
            console.error("FSMService: Error fetching person by ID:", error.message);
            return null;
        }
    }

    /**
     * Get Person by External ID.
     * @param {string} externalId - Person External ID
     * @returns {Promise<Object|null>} Person object or null
     */
    async getPersonByExternalId(externalId) {
        try {
            if (!externalId) return null;

            const query = `SELECT w.id, w.externalId, w.firstName, w.lastName FROM Person w WHERE w.externalId = '${externalId}'`;
            const data = await this.makeQueryRequest(query, 'Person.25');

            if (!data.data || data.data.length === 0) {
                return null;
            }

            return {
                id: data.data[0].w.id,
                externalId: data.data[0].w.externalId,
                firstName: data.data[0].w.firstName || '',
                lastName: data.data[0].w.lastName || ''
            };

        } catch (error) {
            console.error("FSMService: Error fetching person by externalId:", error.message);
            return null;
        }
    }

    /**
     * Get Business Partner by External ID.
     * @param {string} externalId - Business Partner External ID
     * @returns {Promise<Object|null>} Business Partner object or null
     */
    async getBusinessPartnerByExternalId(externalId) {
        try {
            if (!externalId) return null;

            const query = `SELECT w.name FROM BusinessPartner w WHERE w.externalId = '${externalId}'`;
            const data = await this.makeQueryRequest(query, 'BusinessPartner.25');

            if (!data.data || data.data.length === 0) {
                return null;
            }

            return {
                externalId: externalId,
                name: data.data[0].w.name || ''
            };

        } catch (error) {
            console.error("FSMService: Error fetching business partner:", error.message);
            return null;
        }
    }

    // ========================================
    // ORGANIZATION LEVEL
    // ========================================

    /**
     * Get Organization Levels hierarchy.
     * @returns {Promise<Object>} Organization level hierarchy
     */
    async getOrganizationLevels() {
        try {
            const destination = await DestinationService.getDestination('FSM_S4E');
            const token = await TokenCache.getToken(destination);

            const baseUrl = destination.destinationConfiguration.URL;
            const fullUrl = `${baseUrl}/cloud-org-level-service/api/v1/levels`;

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Account-ID': destination.destinationConfiguration['URL.headers.X-Account-ID'],
                'X-Company-ID': destination.destinationConfiguration['URL.headers.X-Company-ID']
            };

            const response = await axios.get(fullUrl, { headers });
            return response.data;

        } catch (error) {
            console.error('FSMService: Organizational-levels API Error:', error.response?.data || error.message);
            throw error;
        }
    }

    // ========================================
    // USER API
    // ========================================

    /**
     * Get User by username from User API.
     * @param {string} username - Username (e.g., "EGLEIZDS")
     * @returns {Promise<Object|null>} User object or null
     */
    async getUserByUsername(username) {
        try {
            if (!username) return null;

            const destination = await DestinationService.getDestination('FSM_S4E');
            const token = await TokenCache.getToken(destination);

            const baseUrl = destination.destinationConfiguration.URL;
            const account = destination.destinationConfiguration.account || this.config.account;
            const fullUrl = `${baseUrl}/api/user/v1/users`;

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-Account-ID': destination.destinationConfiguration['URL.headers.X-Account-ID'],
                'X-Company-ID': destination.destinationConfiguration['URL.headers.X-Company-ID'],
                'X-Client-ID': destination.destinationConfiguration['URL.headers.X-Client-ID'],
                'X-Client-Version': destination.destinationConfiguration['URL.headers.X-Client-Version']
            };

            const response = await axios.get(fullUrl, {
                params: {
                    name: username,
                    account: account
                },
                headers: headers
            });

            if (response.data && response.data.content && response.data.content.length > 0) {
                const user = response.data.content[0];
                return {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    name: user.name,
                    companies: user.companies || []
                };
            }

            return null;

        } catch (error) {
            console.error('FSMService: User API Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get Person's orgLevel by user ID.
     * @param {string} userId - User ID from User API
     * @returns {Promise<Object|null>} Object with orgLevel and orgLevelIds
     */
    async getPersonOrgLevelByUserId(userId) {
        try {
            if (!userId) return null;

            const query = `SELECT w.orgLevel, w.orgLevelIds FROM Person w WHERE w.userName = '${userId}'`;
            const data = await this.makeQueryRequest(query, 'Person.25');

            if (!data.data || data.data.length === 0) {
                return null;
            }

            const personData = data.data[0].w;
            return {
                orgLevel: personData.orgLevel || null,
                orgLevelIds: personData.orgLevelIds || null
            };

        } catch (error) {
            console.error('FSMService: Person orgLevel query Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get User's Organization Level (combined flow).
     * 1. Get user by username -> get user ID
     * 2. Query Person table with user ID -> get orgLevel/orgLevelIds
     * @param {string} username - Username from FSM Mobile context
     * @returns {Promise<Object|null>} Object with orgLevel info
     */
    async getUserOrgLevel(username) {
        try {
            const user = await this.getUserByUsername(username);
            if (!user || !user.id) {
                return null;
            }

            const orgLevelData = await this.getPersonOrgLevelByUserId(user.id);
            if (!orgLevelData) {
                return null;
            }

            return {
                userId: user.id,
                userName: username,
                userFirstName: user.firstName,
                userLastName: user.lastName,
                orgLevel: orgLevelData.orgLevel,
                orgLevelIds: orgLevelData.orgLevelIds
            };

        } catch (error) {
            console.error('FSMService: getUserOrgLevel Error:', error.message);
            throw error;
        }
    }
}

module.exports = new FSMService();