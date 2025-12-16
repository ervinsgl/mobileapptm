/**
 * TMPayloadService.js
 * 
 * Frontend service for building T&M API payloads.
 * Centralizes all payload formatting logic for FSM API submissions.
 * 
 * Key Features:
 * - Build payloads for all T&M entry types
 * - Handle UDF values for custom fields
 * - Extract external IDs from display text
 * - Format combined Time & Material payloads
 * 
 * Payload Types:
 * - Time Effort: Task-based time entries
 * - Material: Item-based material entries
 * - Expense: Amount-based expense entries
 * - Mileage: Distance-based travel entries
 * - Time & Material: Combined (1 Material + up to 3 Time Efforts)
 * 
 * Common Fields:
 * - orgLevel: Organization level ID
 * - createPerson: Technician external ID
 * - syncStatus: "REQUIRES_APPROVAL"
 * - object: Activity reference
 * 
 * @file TMPayloadService.js
 * @module mobileappsc/utils/tm/TMPayloadService
 * @requires mobileappsc/utils/tm/TMCreationService
 */
sap.ui.define([
    "mobileappsc/utils/tm/TMCreationService"
], (TMCreationService) => {
    "use strict";

    return {
        /**
         * Build payload based on entry type.
         * @param {Object} oEntry - Entry data object
         * @param {string} activityId - Activity ID
         * @param {string} orgLevelId - Organization Level ID
         * @returns {Object} Formatted payload for API
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
         * Build Time Effort API payload.
         * chargeOption is always "CHARGEABLE".
         * endDateTime is calculated from startDateTime + duration.
         * @param {Object} oEntry - Time Effort entry data
         * @param {string} activityId - Activity ID
         * @param {string} orgLevelId - Organization Level ID
         * @returns {Object} Time Effort payload
         */
        buildTimeEffortPayload(oEntry, activityId, orgLevelId) {
            // Calculate endDateTime from startDateTime + duration
            let endDateTime = oEntry.endDateTime || "";
            if (oEntry.startDateTime && oEntry.duration) {
                const startDate = new Date(oEntry.startDateTime);
                if (!isNaN(startDate.getTime())) {
                    const endDate = new Date(startDate.getTime() + (oEntry.duration * 60 * 1000));
                    endDateTime = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
                }
            }

            return {
                chargeOption: "CHARGEABLE",
                inactive: false,
                startDateTimeTimeZoneId: "Europe/Berlin",
                endDateTimeTimeZoneId: "Europe/Berlin",
                orgLevel: orgLevelId || "",
                breakInMinutes: 0,
                unitPrice: null,
                timeZoneId: "UTC+02:00",
                endDateTime: endDateTime,
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
         * Build Material API payload.
         * Date is derived from Activity Planned Start.
         * chargeOption is always "CHARGEABLE".
         * @param {Object} oEntry - Material entry data
         * @param {string} activityId - Activity ID
         * @param {string} orgLevelId - Organization Level ID
         * @returns {Object} Material payload
         */
        buildMaterialPayload(oEntry, activityId, orgLevelId) {
            let itemExternalId = "";
            if (oEntry.itemDisplay) {
                itemExternalId = oEntry.itemDisplay.split(' - ')[0];
            }

            // Get activity planned start date and extract date portion
            const activityPlannedStart = TMCreationService.getActivityPlannedStartDate();
            const materialDate = activityPlannedStart 
                ? activityPlannedStart.split('T')[0] 
                : new Date().toISOString().split('T')[0];

            return {
                chargeOption: "CHARGEABLE",
                inactive: false,
                orgLevel: orgLevelId || "",
                date: materialDate,
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
         * Build Expense API payload.
         * Date is derived from Activity Planned Start.
         * chargeOption is always "CHARGEABLE".
         * @param {Object} oEntry - Expense entry data
         * @param {string} activityId - Activity ID
         * @param {string} orgLevelId - Organization Level ID
         * @returns {Object} Expense payload
         */
        buildExpensePayload(oEntry, activityId, orgLevelId) {
            // Get item externalId from Service Product
            let itemExternalId = "";
            if (oEntry.itemDisplay) {
                itemExternalId = oEntry.itemDisplay.split(' - ')[0];
            }

            // Get activity planned start date and extract date portion
            const activityPlannedStart = TMCreationService.getActivityPlannedStartDate();
            const expenseDate = activityPlannedStart 
                ? activityPlannedStart.split('T')[0] 
                : new Date().toISOString().split('T')[0];

            return {
                chargeOption: "CHARGEABLE",
                inactive: false,
                orgLevel: orgLevelId || "",
                date: expenseDate,
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
                type: itemExternalId ? { externalId: itemExternalId } : null,
                remarks: oEntry.remarks || "",
                syncStatus: "REQUIRES_APPROVAL",
                object: {
                    objectId: activityId || "",
                    objectType: "ACTIVITY"
                }
            };
        },

        /**
         * Build Mileage API payload.
         * Type (Item) externalId goes to UDF value for Z_Mileage_MatID.
         * Source/Destination are blank.
         * travelStartDateTime from Activity Planned Start.
         * travelEndDateTime = travelStartDateTime + Duration.
         * Driver/Private Car default to false.
         * chargeOption is always "CHARGEABLE".
         * @param {Object} oEntry - Mileage entry data
         * @param {string} activityId - Activity ID
         * @param {string} orgLevelId - Organization Level ID
         * @returns {Object} Mileage payload
         */
        buildMileagePayload(oEntry, activityId, orgLevelId) {
            // Get activity planned start date for travel times
            const activityPlannedStart = TMCreationService.getActivityPlannedStartDate();
            const baseStartDateTime = activityPlannedStart || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
            
            // Calculate travel end time: start + duration
            const startDate = new Date(baseStartDateTime);
            const endDate = new Date(startDate.getTime() + (oEntry.travelDuration || 0) * 60 * 1000);
            
            const formatDateTime = (date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');
            
            // Extract date portion for date field
            const dateValue = baseStartDateTime.split('T')[0];
            
            // Get item externalId for UDF value
            let itemExternalId = "";
            if (oEntry.itemDisplay) {
                itemExternalId = oEntry.itemDisplay.split(' - ')[0];
            }

            return {
                date: dateValue,
                orgLevel: orgLevelId || "",
                distanceUnit: "KM",
                distance: oEntry.distance || 0,
                destination: "",
                source: "",
                type: null,
                travelEndDateTime: formatDateTime(endDate),
                chargeOption: "CHARGEABLE",
                travelEndDateTimeTimeZoneId: "Europe/Berlin",
                inactive: false,
                travelStartDateTime: formatDateTime(startDate),
                travelStartDateTimeTimeZoneId: "Europe/Berlin",
                createPerson: {
                    externalId: oEntry.technicianExternalId || ""
                },
                driver: false,
                privateCar: false,
                udfValues: [{
                    udfMeta: {
                        externalId: "Z_Mileage_MatID"
                    },
                    value: itemExternalId || ""
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
         * Build Time & Material API payload.
         * Returns combined structure for multiple API calls (1 Material + up to 3 Time Efforts).
         * Times are calculated sequentially:
         * - Arbeitszeit: starts at Activity Planned Start
         * - Fahrzeit: starts at Arbeitszeit end
         * - Wartezeit: starts at Fahrzeit end
         * chargeOption is always "CHARGEABLE".
         * @param {Object} oEntry - Time & Material entry data
         * @param {string} activityId - Activity ID
         * @param {string} orgLevelId - Organization Level ID
         * @returns {Object} Combined T&M payload structure
         */
        buildTimeAndMaterialPayload(oEntry, activityId, orgLevelId) {
            let itemExternalId = "";
            if (oEntry.itemDisplay) {
                itemExternalId = oEntry.itemDisplay.split(' - ')[0];
            }

            const technicianExternalId = oEntry.technicianExternalId || "";

            const objectRef = {
                objectId: activityId || "",
                objectType: "ACTIVITY"
            };

            const timeEffortConstants = {
                inactive: false,
                startDateTimeTimeZoneId: "Europe/Berlin",
                endDateTimeTimeZoneId: "Europe/Berlin",
                breakInMinutes: 0,
                unitPrice: null,
                timeZoneId: "UTC+02:00",
                internalRemarks: null,
                breakStartDateTime: null,
                udfValues: [{
                    udfMeta: {
                        externalId: "Z_TimeEffort_MatID"
                    },
                    value: "Z13000000"
                }],
                syncStatus: "REQUIRES_APPROVAL"
            };

            // Get activity planned start date for sequential time calculation
            const activityPlannedStart = TMCreationService.getActivityPlannedStartDate();
            const baseStartDateTime = activityPlannedStart || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

            // Extract date portion for Material (yyyy-MM-dd format)
            const materialDate = baseStartDateTime.split('T')[0];

            // Calculate sequential times
            // Arbeitszeit: starts at Activity Planned Start
            const start1 = new Date(baseStartDateTime);
            const end1 = new Date(start1.getTime() + (oEntry.duration1 || 0) * 60 * 1000);
            
            // Fahrzeit: starts at Arbeitszeit end
            const start2 = new Date(end1.getTime());
            const end2 = new Date(start2.getTime() + (oEntry.duration2 || 0) * 60 * 1000);
            
            // Wartezeit: starts at Fahrzeit end
            const start3 = new Date(end2.getTime());
            const end3 = new Date(start3.getTime() + (oEntry.duration3 || 0) * 60 * 1000);

            // Format dates as ISO strings without milliseconds
            const formatDateTime = (date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

            return {
                note: "Time & Material creates multiple API calls",
                material: {
                    chargeOption: "CHARGEABLE",
                    inactive: false,
                    orgLevel: orgLevelId || "",
                    item: itemExternalId ? { externalId: itemExternalId } : null,
                    quantity: oEntry.quantity || 0,
                    createPerson: {
                        externalId: technicianExternalId
                    },
                    date: materialDate,
                    remarks: oEntry.remarksMaterial || "",
                    syncStatus: "REQUIRES_APPROVAL",
                    object: objectRef
                },
                timeEffort1: oEntry.task1Code ? {
                    chargeOption: "CHARGEABLE",
                    ...timeEffortConstants,
                    orgLevel: orgLevelId || "",
                    task: { code: oEntry.task1Code },
                    startDateTime: formatDateTime(start1),
                    endDateTime: formatDateTime(end1),
                    remarks: oEntry.remarks1 || "",
                    createPerson: {
                        externalId: technicianExternalId
                    },
                    object: objectRef
                } : null,
                timeEffort2: oEntry.task2Code ? {
                    chargeOption: "CHARGEABLE",
                    ...timeEffortConstants,
                    orgLevel: orgLevelId || "",
                    task: { code: oEntry.task2Code },
                    startDateTime: formatDateTime(start2),
                    endDateTime: formatDateTime(end2),
                    remarks: oEntry.remarks2 || "",
                    createPerson: {
                        externalId: technicianExternalId
                    },
                    object: objectRef
                } : null,
                timeEffort3: oEntry.task3Code ? {
                    chargeOption: "CHARGEABLE",
                    ...timeEffortConstants,
                    orgLevel: orgLevelId || "",
                    task: { code: oEntry.task3Code },
                    startDateTime: formatDateTime(start3),
                    endDateTime: formatDateTime(end3),
                    remarks: oEntry.remarks3 || "",
                    createPerson: {
                        externalId: technicianExternalId
                    },
                    object: objectRef
                } : null
            };
        },

        /**
         * Format payload as JSON string for display.
         * @param {Object} payload - Payload object
         * @returns {string} Formatted JSON string
         */
        formatPayloadJSON(payload) {
            return JSON.stringify(payload, null, 2);
        }
    };
});