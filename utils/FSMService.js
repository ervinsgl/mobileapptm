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
     * Make batch request to FSM Batch API.
     * Combines multiple API calls into a single HTTP request.
     * @param {Array} requests - Array of request objects with structure:
     *   { method: 'POST', path: '/Expense', data: {...}, params: { dtos: '...' } }
     * @param {boolean} transactional - If true, all requests succeed or all rollback (default: true)
     * @returns {Promise<Array>} Array of response objects matching request order
     */
    async makeBatchRequest(requests, transactional = true) {
        try {
            if (!requests || requests.length === 0) {
                return [];
            }

            const destination = await DestinationService.getDestination('FSM_S4E');
            const token = await TokenCache.getToken(destination);

            const baseUrl = destination.destinationConfiguration.URL;
            const account = destination.destinationConfiguration.account || this.config.account;
            const company = destination.destinationConfiguration.company || this.config.company;

            // Create unique boundary
            const boundary = `======batch_${Date.now()}======`;

            // Build multipart body
            let batchBody = '';
            requests.forEach((req, index) => {
                const contentId = `req${index + 1}`;
                
                // Build query string for this request
                const queryParams = new URLSearchParams({
                    ...req.params,
                    account,
                    company
                }).toString();

                const requestPath = `/api/data/v4${req.path}?${queryParams}`;

                batchBody += `--${boundary}\r\n`;
                batchBody += `Content-Type: application/http\r\n`;
                batchBody += `Content-ID: ${contentId}\r\n`;
                batchBody += `\r\n`;
                batchBody += `${req.method} ${requestPath} HTTP/1.1\r\n`;
                batchBody += `Content-Type: application/json\r\n`;
                batchBody += `\r\n`;
                
                if (req.data) {
                    batchBody += JSON.stringify(req.data);
                }
                batchBody += `\r\n`;
            });
            batchBody += `--${boundary}--\r\n`;

            // Make batch request
            const batchUrl = `${baseUrl}/api/data/batch/v1?account=${account}&company=${company}&transactional=${transactional}`;

            const headers = {
                'Content-Type': `multipart/mixed; boundary="${boundary}"`,
                'Authorization': `Bearer ${token}`,
                'X-Account-ID': destination.destinationConfiguration['URL.headers.X-Account-ID'],
                'X-Company-ID': destination.destinationConfiguration['URL.headers.X-Company-ID'],
                'X-Client-ID': destination.destinationConfiguration['URL.headers.X-Client-ID'],
                'X-Client-Version': destination.destinationConfiguration['URL.headers.X-Client-Version']
            };

            const response = await axios.post(batchUrl, batchBody, { headers });

            // Parse multipart response
            return this._parseBatchResponse(response.data, response.headers['content-type']);

        } catch (error) {
            console.error('FSMService: Batch Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Parse multipart batch response.
     * @private
     * @param {string} responseBody - Raw multipart response body
     * @param {string} contentType - Content-Type header with boundary
     * @returns {Array} Array of parsed response objects
     */
    _parseBatchResponse(responseBody, contentType) {
        const results = [];

        try {
            // Extract boundary from content-type
            const boundaryMatch = contentType.match(/boundary=([^;]+)/);
            if (!boundaryMatch) {
                console.error('Could not extract boundary from response');
                return results;
            }
            
            const boundary = boundaryMatch[1].replace(/"/g, '');
            const parts = responseBody.split(`--${boundary}`);

            for (const part of parts) {
                // Skip empty parts and closing boundary
                if (!part.trim() || part.trim() === '--') continue;

                // Find the JSON body in the response part
                const jsonMatch = part.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        const jsonData = JSON.parse(jsonMatch[0]);
                        
                        // Extract HTTP status from the part
                        const statusMatch = part.match(/HTTP\/1\.1 (\d+)/);
                        const status = statusMatch ? parseInt(statusMatch[1]) : 200;
                        
                        // Extract Content-ID
                        const contentIdMatch = part.match(/Content-ID:\s*(\w+)/i);
                        const contentId = contentIdMatch ? contentIdMatch[1] : null;

                        results.push({
                            success: status >= 200 && status < 300,
                            status,
                            contentId,
                            data: jsonData
                        });
                    } catch (parseError) {
                        console.error('Error parsing batch response part:', parseError);
                        results.push({
                            success: false,
                            status: 500,
                            error: 'Failed to parse response'
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error parsing batch response:', error);
        }

        return results;
    }

    /**
     * Batch create multiple entries of different types.
     * @param {Array} entries - Array of entry objects with structure:
     *   { type: 'Expense'|'Mileage'|'Material'|'TimeEffort', payload: {...} }
     * @param {boolean} transactional - If true, all succeed or all rollback
     * @returns {Promise<Object>} Results object with successCount, errorCount, results
     */
    async batchCreateEntries(entries, transactional = false) {
        // Map entry types to API paths and DTOs
        const typeConfig = {
            'Expense': { path: '/Expense', dtos: 'Expense.17' },
            'Mileage': { path: '/Mileage', dtos: 'Mileage.19' },
            'Material': { path: '/Material', dtos: 'Material.22' },
            'TimeEffort': { path: '/TimeEffort', dtos: 'TimeEffort.17' }
        };

        // Build batch requests array
        const requests = entries.map(entry => {
            const config = typeConfig[entry.type];
            if (!config) {
                throw new Error(`Unknown entry type: ${entry.type}`);
            }
            return {
                method: 'POST',
                path: config.path,
                params: { dtos: config.dtos },
                data: entry.payload
            };
        });

        // Execute batch request
        const results = await this.makeBatchRequest(requests, transactional);

        // Summarize results
        const successCount = results.filter(r => r.success).length;
        const errorCount = results.filter(r => !r.success).length;

        return {
            success: errorCount === 0,
            successCount,
            errorCount,
            totalCount: entries.length,
            results
        };
    }

    /**
     * Batch update multiple entries of different types.
     * @param {Array} entries - Array of entry objects with structure:
     *   { type: 'Expense'|'Mileage'|'Material'|'TimeEffort', id: '...', payload: {...} }
     * @param {boolean} transactional - If true, all succeed or all rollback
     * @returns {Promise<Object>} Results object with successCount, errorCount, results
     */
    async batchUpdateEntries(entries, transactional = false) {
        // Map entry types to API paths and DTOs
        const typeConfig = {
            'Expense': { path: '/Expense', dtos: 'Expense.17' },
            'Mileage': { path: '/Mileage', dtos: 'Mileage.19' },
            'Material': { path: '/Material', dtos: 'Material.22' },
            'TimeEffort': { path: '/TimeEffort', dtos: 'TimeEffort.17' }
        };

        // Build batch requests array
        const requests = entries.map(entry => {
            const config = typeConfig[entry.type];
            if (!config) {
                throw new Error(`Unknown entry type: ${entry.type}`);
            }
            if (!entry.id) {
                throw new Error(`Entry ID is required for update`);
            }
            return {
                method: 'PATCH',
                path: `${config.path}/${entry.id}`,
                params: { dtos: config.dtos, forceUpdate: true },
                data: entry.payload
            };
        });

        // Execute batch request
        const results = await this.makeBatchRequest(requests, transactional);

        // Summarize results
        const successCount = results.filter(r => r.success).length;
        const errorCount = results.filter(r => !r.success).length;

        return {
            success: errorCount === 0,
            successCount,
            errorCount,
            totalCount: entries.length,
            results
        };
    }

    /**
     * Batch delete multiple T&M entries using FSM Batch API.
     * Uses DELETE method for each entry in a single batch request.
     * FSM DELETE requires lastChanged for optimistic locking.
     * @param {Array<Object>} entries - Array of entries to delete
     * @param {string} entries[].type - Entry type: 'Expense', 'Mileage', 'Material', 'TimeEffort'
     * @param {string} entries[].id - Entry ID to delete
     * @param {number} entries[].lastChanged - Last changed timestamp for optimistic locking
     * @param {boolean} [transactional=false] - If true, all-or-nothing; if false, partial success allowed
     * @returns {Promise<Object>} Batch result summary
     */
    async batchDeleteEntries(entries, transactional = false) {
        // Map entry types to API paths
        const typeConfig = {
            'Expense': { path: '/Expense' },
            'Mileage': { path: '/Mileage' },
            'Material': { path: '/Material' },
            'TimeEffort': { path: '/TimeEffort' }
        };

        // Build batch requests array
        const requests = entries.map(entry => {
            const config = typeConfig[entry.type];
            if (!config) {
                throw new Error(`Unknown entry type: ${entry.type}`);
            }
            if (!entry.id) {
                throw new Error(`Entry ID is required for delete`);
            }
            if (!entry.lastChanged) {
                throw new Error(`lastChanged is required for delete`);
            }
            return {
                method: 'DELETE',
                path: `${config.path}/${entry.id}`,
                params: { lastChanged: entry.lastChanged }
            };
        });

        // Execute batch request
        const results = await this.makeBatchRequest(requests, transactional);

        // Summarize results
        const deleteSuccessCount = results.filter(r => r.success).length;
        const deleteErrorCount = results.filter(r => !r.success).length;

        return {
            success: deleteErrorCount === 0,
            successCount: deleteSuccessCount,
            errorCount: deleteErrorCount,
            totalCount: entries.length,
            results
        };
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
                let durationHrs = 0;
                if (timeEffort.startDateTime && timeEffort.endDateTime) {
                    const startTime = new Date(timeEffort.startDateTime);
                    const endTime = new Date(timeEffort.endDateTime);
                    durationMinutes = Math.round((endTime - startTime) / (1000 * 60));
                    durationHrs = Math.round((durationMinutes / 60) * 100) / 100; // Round to 2 decimal places
                }

                const remarks = timeEffort.internalRemarks || timeEffort.remarks || 'N/A';

                return {
                    id: timeEffort.id,
                    lastChanged: timeEffort.lastChanged,
                    createDateTime: timeEffort.createDateTime,
                    createPerson: timeEffort.createPerson || 'N/A',
                    orgLevel: timeEffort.orgLevel || 'N/A',
                    chargeOption: timeEffort.chargeOption || 'N/A',
                    internalRemarksText: timeEffort.internalRemarks || 'N/A',
                    remarksText: remarks,
                    task: timeEffort.task || 'N/A',
                    startDateTime: timeEffort.startDateTime || null,
                    endDateTime: timeEffort.endDateTime || null,
                    // Unified sort date field (use startDateTime for Time Effort)
                    sortDate: timeEffort.startDateTime || timeEffort.createDateTime || null,
                    udfValues: udfValues,
                    udfValuesText: udfValuesText,
                    durationMinutes: durationMinutes,
                    durationHrs: durationHrs,
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
                    lastChanged: material.lastChanged,
                    createDateTime: material.createDateTime,
                    createPerson: material.createPerson || 'N/A',
                    orgLevel: material.orgLevel || 'N/A',
                    chargeOption: material.chargeOption || 'N/A',
                    syncStatus: material.syncStatus || 'N/A',
                    date: material.date || null,
                    // Unified sort date field (use date for Material, fallback to createDateTime)
                    sortDate: material.date ? `${material.date}T00:00:00Z` : (material.createDateTime || null),
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
                    lastChanged: expense.lastChanged,
                    createDateTime: expense.createDateTime,
                    createPerson: expense.createPerson || 'N/A',
                    orgLevel: expense.orgLevel || 'N/A',
                    chargeOption: expense.chargeOption || 'N/A',
                    syncStatus: expense.syncStatus || 'N/A',
                    date: expense.date || null,
                    // Unified sort date field
                    sortDate: expense.date ? `${expense.date}T00:00:00Z` : (expense.createDateTime || null),
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
                    `${mileage.source} ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ ${mileage.destination}` : 'N/A';

                // Calculate travel duration in minutes
                let travelDurationMinutes = 'N/A';
                if (mileage.travelStartDateTime && mileage.travelEndDateTime) {
                    const startTime = new Date(mileage.travelStartDateTime);
                    const endTime = new Date(mileage.travelEndDateTime);
                    travelDurationMinutes = Math.round((endTime - startTime) / (1000 * 60));
                }

                return {
                    id: mileage.id,
                    lastChanged: mileage.lastChanged,
                    createDateTime: mileage.createDateTime,
                    createPerson: mileage.createPerson || 'N/A',
                    orgLevel: mileage.orgLevel || 'N/A',
                    chargeOption: mileage.chargeOption || 'N/A',
                    syncStatus: mileage.syncStatus || 'N/A',
                    date: mileage.date || null,
                    // Unified sort date field
                    sortDate: mileage.date ? `${mileage.date}T00:00:00Z` : (mileage.createDateTime || null),
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
            const query = `SELECT w.decisionStatus, w.decisionRemarks FROM Approval w WHERE w.object.objectId = '${objectId}'`;
            const data = await this.makeQueryRequest(query, 'Approval.15');

            if (!data.data || data.data.length === 0) {
                return null;
            }

            return {
                decisionStatus: data.data[0]?.w?.decisionStatus || null,
                decisionRemarks: data.data[0]?.w?.decisionRemarks || null
            };

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
                    const query = `SELECT w.decisionStatus, w.decisionRemarks FROM Approval w WHERE w.object.objectId = '${objectId}'`;
                    const data = await this.makeQueryRequest(query, 'Approval.15');
                    
                    if (data.data && data.data.length > 0) {
                        const approval = data.data[0]?.w;
                        if (approval?.decisionStatus) {
                            statusMap[objectId] = {
                                decisionStatus: approval.decisionStatus,
                                decisionRemarks: approval.decisionRemarks || null
                            };
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

            const query = `SELECT w.orgLevel, w.orgLevelIds, w.id, w.externalId FROM Person w WHERE w.userName = '${userId}'`;
            const data = await this.makeQueryRequest(query, 'Person.25');

            if (!data.data || data.data.length === 0) {
                return null;
            }

            const personData = data.data;
            
            // Collect all person IDs and externalIds (multiple Person records possible per user)
            const personIds = [];
            const personExternalIds = [];
            let orgLevel = null;
            let orgLevelIds = null;

            personData.forEach(item => {
                const w = item.w;
                if (w.id) personIds.push(w.id);
                if (w.externalId) personExternalIds.push(w.externalId);
                // Use first non-null orgLevel found
                if (!orgLevel && w.orgLevel) orgLevel = w.orgLevel;
                if (!orgLevelIds && w.orgLevelIds) orgLevelIds = w.orgLevelIds;
            });

            return {
                orgLevel: orgLevel,
                orgLevelIds: orgLevelIds,
                personIds: personIds,
                personExternalIds: personExternalIds
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
                orgLevelIds: orgLevelData.orgLevelIds,
                personIds: orgLevelData.personIds,
                personExternalIds: orgLevelData.personExternalIds
            };

        } catch (error) {
            console.error('FSMService: getUserOrgLevel Error:', error.message);
            throw error;
        }
    }
}

module.exports = new FSMService();