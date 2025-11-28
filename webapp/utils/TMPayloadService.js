sap.ui.define([], () => {
    "use strict";

    /**
     * TMPayloadService - Builds JSON payloads for T&M API submissions
     * Centralizes all payload formatting logic for Time Effort, Material, Expense, Mileage entries
     */
    return {
        /**
         * Build payload based on entry type
         * @param {object} oEntry - Entry data object
         * @param {string} activityId - Activity ID
         * @param {string} orgLevelId - Organization Level ID
         * @returns {object} Formatted payload for API
         */
        buildPayload(oEntry, activityId, orgLevelId) {
            switch (oEntry.type) {
                case "Time Effort":
                    return this.buildTimeEffortPayload(oEntry, activityId, orgLevelId);
                case "Material":
                    return this.buildMaterialPayload(oEntry, activityId, orgLevelId);
                case "Expense":
                    return this.buildExpensePayload(oEntry, activityId, orgLevelId);
                case "Mileage":
                    return this.buildMileagePayload(oEntry, activityId, orgLevelId);
                case "Time & Material":
                    return this.buildTimeAndMaterialPayload(oEntry, activityId, orgLevelId);
                default:
                    return { error: "Unknown entry type: " + oEntry.type };
            }
        },

        /**
         * Build Time Effort API payload
         * @param {object} oEntry - Time Effort entry data
         * @param {string} activityId - Activity ID
         * @param {string} orgLevelId - Organization Level ID
         * @returns {object} Time Effort payload
         */
        buildTimeEffortPayload(oEntry, activityId, orgLevelId) {
            return {
                chargeOption: oEntry.chargeOption || "",
                inactive: false,
                startDateTimeTimeZoneId: "Europe/Berlin",
                endDateTimeTimeZoneId: "Europe/Berlin",
                orgLevel: orgLevelId || "",
                breakInMinutes: 0,
                unitPrice: null,
                timeZoneId: "UTC+02:00",
                endDateTime: oEntry.endDateTime || "",
                internalRemarks: null,
                breakStartDateTime: null,
                startDateTime: oEntry.startDateTime || "",
                createPerson: {
                    externalId: oEntry.technicianExternalId || ""
                },
                task: oEntry.taskCode ? { code: oEntry.taskCode } : null,
                udfValues: [{
                    udfMeta: {
                        externalId: "Z_TimeEffort_MatID"
                    },
                    value: "Z13000000"
                }],
                remarks: oEntry.remarks || "",
                syncStatus: "REQUIRES_APPROVAL",
                object: {
                    objectId: activityId || "",
                    objectType: "ACTIVITY"
                }
            };
        },

        /**
         * Build Material API payload
         * @param {object} oEntry - Material entry data
         * @param {string} activityId - Activity ID
         * @param {string} orgLevelId - Organization Level ID
         * @returns {object} Material payload
         */
        buildMaterialPayload(oEntry, activityId, orgLevelId) {
            // Extract item externalId from itemDisplay
            let itemExternalId = "";
            if (oEntry.itemDisplay) {
                itemExternalId = oEntry.itemDisplay.split(' - ')[0];
            }

            return {
                chargeOption: oEntry.chargeOption || "",
                inactive: false,
                orgLevel: orgLevelId || "",
                date: oEntry.date || "",
                quantity: oEntry.quantity || 0,
                createPerson: {
                    externalId: oEntry.technicianExternalId || ""
                },
                item: itemExternalId ? { externalId: itemExternalId } : null,
                remarks: oEntry.remarks || "",
                syncStatus: "REQUIRES_APPROVAL",
                object: {
                    objectId: activityId || "",
                    objectType: "ACTIVITY"
                }
            };
        },

        /**
         * Build Expense API payload
         * @param {object} oEntry - Expense entry data
         * @param {string} activityId - Activity ID
         * @param {string} orgLevelId - Organization Level ID
         * @returns {object} Expense payload
         */
        buildExpensePayload(oEntry, activityId, orgLevelId) {
            // Extract expense type code from expenseTypeDisplay
            let expenseTypeCode = "";
            if (oEntry.expenseTypeDisplay) {
                expenseTypeCode = oEntry.expenseTypeDisplay.split(' - ')[0];
            }

            return {
                chargeOption: oEntry.chargeOption || "",
                inactive: false,
                orgLevel: orgLevelId || "",
                date: oEntry.date || "",
                externalAmount: {
                    amount: oEntry.externalAmountValue || 0,
                    currency: "EUR"
                },
                internalAmount: {
                    amount: oEntry.internalAmountValue || 0,
                    currency: "EUR"
                },
                createPerson: {
                    externalId: oEntry.technicianExternalId || ""
                },
                type: expenseTypeCode ? { code: expenseTypeCode } : null,
                remarks: oEntry.remarks || "",
                syncStatus: "REQUIRES_APPROVAL",
                object: {
                    objectId: activityId || "",
                    objectType: "ACTIVITY"
                }
            };
        },

        /**
         * Build Mileage API payload
         * @param {object} oEntry - Mileage entry data
         * @param {string} activityId - Activity ID
         * @param {string} orgLevelId - Organization Level ID
         * @returns {object} Mileage payload
         */
        buildMileagePayload(oEntry, activityId, orgLevelId) {
            // Derive date from travelEndDateTime (format: YYYY-MM-DD)
            let dateValue = "";
            if (oEntry.travelEndDateTime) {
                dateValue = oEntry.travelEndDateTime.split('T')[0];
            }

            return {
                date: dateValue,
                orgLevel: orgLevelId || "",
                distanceUnit: "KM",
                distance: oEntry.distance || 0,
                destination: oEntry.destination || "",
                source: oEntry.source || "",
                type: null,
                travelEndDateTime: oEntry.travelEndDateTime || "",
                chargeOption: oEntry.chargeOption || "",
                travelEndDateTimeTimeZoneId: "Europe/Berlin",
                inactive: false,
                travelStartDateTime: oEntry.travelStartDateTime || "",
                travelStartDateTimeTimeZoneId: "Europe/Berlin",
                createPerson: {
                    externalId: oEntry.technicianExternalId || ""
                },
                driver: oEntry.driver || false,
                privateCar: oEntry.privateCar || false,
                udfValues: [{
                    udfMeta: {
                        externalId: "Z_Mileage_MatID"
                    },
                    value: "Z40000008"
                }],
                remarks: oEntry.remarks || "",
                syncStatus: "REQUIRES_APPROVAL",
                object: {
                    objectId: activityId || "",
                    objectType: "ACTIVITY"
                }
            };
        },

        /**
         * Build Time & Material API payload
         * Returns combined structure for multiple API calls
         * @param {object} oEntry - Time & Material entry data
         * @param {string} activityId - Activity ID
         * @param {string} orgLevelId - Organization Level ID
         * @returns {object} Combined T&M payload structure
         */
        buildTimeAndMaterialPayload(oEntry, activityId, orgLevelId) {
            return {
                note: "Time & Material creates multiple API calls",
                activityId: activityId,
                orgLevelId: orgLevelId,
                // Material part
                material: {
                    item: oEntry.itemDisplay ? { externalId: oEntry.itemDisplay.split(' - ')[0] } : null,
                    quantity: oEntry.quantity || 0,
                    date: oEntry.date || "",
                    remarks: oEntry.remarksMaterial || ""
                },
                // Time Effort parts (3 columns)
                timeEffort1: oEntry.task1Code ? {
                    task: { code: oEntry.task1Code },
                    startDateTime: oEntry.startDateTime1,
                    endDateTime: oEntry.endDateTime1,
                    remarks: oEntry.remarksTime || ""
                } : null,
                timeEffort2: oEntry.task2Code ? {
                    task: { code: oEntry.task2Code },
                    startDateTime: oEntry.startDateTime2,
                    endDateTime: oEntry.endDateTime2,
                    remarks: oEntry.remarksTime || ""
                } : null,
                timeEffort3: oEntry.task3Code ? {
                    task: { code: oEntry.task3Code },
                    startDateTime: oEntry.startDateTime3,
                    endDateTime: oEntry.endDateTime3,
                    remarks: oEntry.remarksTime || ""
                } : null,
                chargeOption: oEntry.chargeOption || ""
            };
        },

        /**
         * Format payload as JSON string for display
         * @param {object} payload - Payload object
         * @returns {string} Formatted JSON string
         */
        formatPayloadJSON(payload) {
            return JSON.stringify(payload, null, 2);
        }
    };
});