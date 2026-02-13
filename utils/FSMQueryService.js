/**
 * FSMQueryService.js
 * 
 * T&M entry retrieval methods for FSM API integration.
 * Provides query-based data fetching for TimeEffort, Material, Expense, and Mileage entries.
 * 
 * These methods are mixed into the FSMService class prototype at startup,
 * so they have access to FSMService's HTTP methods via `this`.
 * 
 * Methods:
 * - getTimeEffortsForActivity(activityId) - Fetch time efforts with duration calculation
 * - getMaterialsForActivity(activityId) - Fetch materials with quantity data
 * - getExpensesForActivity(activityId) - Fetch expenses with amount formatting
 * - getMileagesForActivity(activityId) - Fetch mileages with travel duration
 * 
 * @file FSMQueryService.js
 * @module utils/FSMQueryService
 */

module.exports = {

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
    },

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
    },

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
    },

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
                    `${mileage.source} \u2192 ${mileage.destination}` : 'N/A';

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
};