/**
 * TMEditService.js
 * 
 * Frontend service for T&M entry edit mode logic.
 * Handles initialization, extraction, and update of editable fields.
 * 
 * Key Features:
 * - Initialize edit field values from existing report data
 * - Extract edited values from model for API submission
 * - Build update payloads for PATCH API calls
 * - Generate display value updates after save
 * - Handle duration/datetime calculations during edit
 * 
 * Supported Entry Types:
 * - Time Effort: Duration, remarks, start/end datetime
 * - Material: Date, quantity, remarks
 * - Expense: Date, external/internal amounts, remarks
 * - Mileage: Date, distance, source, destination, travel duration, remarks
 * 
 * @file TMEditService.js
 * @module mobileappsc/utils/TMEditService
 * @requires mobileappsc/utils/DateTimeService
 */
sap.ui.define([
    "mobileappsc/utils/DateTimeService"
], (DateTimeService) => {
    "use strict";

    return {
        /**
         * Initialize edit mode fields for a report.
         * Copies current values to edit fields.
         * @param {string} type - Report type (Time Effort, Material, Expense, Mileage)
         * @param {Object} report - Report data object
         * @returns {Object} Edit field values to set on model
         */
        initEditMode(type, report) {
            const cleanRemarks = (val) => (val === "N/A" || !val) ? "" : val;
            const cleanText = (val) => (val === "N/A" || !val) ? "" : val;

            switch (type) {
                case "Time Effort":
                    return {
                        editDurationMinutes: report.durationMinutes || 0,
                        editRemarks: cleanRemarks(report.remarksText),
                        editStartDateTime: report.startDateTime || "",
                        editEndDateTime: report.endDateTime || ""
                    };

                case "Material":
                    return {
                        editDate: report.fullData?.date || "",
                        editQuantity: report.fullData?.quantity || 0,
                        editRemarks: cleanRemarks(report.remarksText)
                    };

                case "Expense":
                    return {
                        editDate: report.fullData?.date || "",
                        editExternalAmount: report.fullData?.externalAmount?.amount || 0,
                        editInternalAmount: report.fullData?.internalAmount?.amount || 0,
                        editRemarks: cleanRemarks(report.remarksText)
                    };

                case "Mileage":
                    return {
                        editDate: report.fullData?.date || "",
                        editDistance: report.fullData?.distance || 0,
                        editSource: cleanText(report.source),
                        editDestination: cleanText(report.destination),
                        editTravelDuration: report.travelDurationMinutes || 0,
                        editTravelEnd: report.travelEndDateTime || "",
                        editRemarks: cleanRemarks(report.remarksText)
                    };

                default:
                    return {};
            }
        },

        /**
         * Get edited values from model.
         * @param {string} type - Report type
         * @param {sap.ui.model.json.JSONModel} model - Dialog model
         * @param {string} path - Path to report in model
         * @returns {Object} Edited values
         */
        getEditedValues(type, model, path) {
            const get = (prop) => model.getProperty(path + "/" + prop);

            switch (type) {
                case "Time Effort":
                    return {
                        durationMinutes: get("editDurationMinutes"),
                        remarks: get("editRemarks"),
                        startDateTime: get("startDateTime"),
                        endDateTime: get("editEndDateTime")
                    };

                case "Material":
                    return {
                        date: get("editDate"),
                        quantity: get("editQuantity"),
                        remarks: get("editRemarks")
                    };

                case "Expense":
                    return {
                        date: get("editDate"),
                        externalAmount: get("editExternalAmount"),
                        internalAmount: get("editInternalAmount"),
                        remarks: get("editRemarks")
                    };

                case "Mileage":
                    return {
                        date: get("editDate"),
                        distance: get("editDistance"),
                        source: get("editSource"),
                        destination: get("editDestination"),
                        travelDuration: get("editTravelDuration"),
                        travelStartDateTime: get("travelStartDateTime"),
                        travelEndDateTime: get("editTravelEnd"),
                        remarks: get("editRemarks")
                    };

                default:
                    return {};
            }
        },

        /**
         * Build update payload for API.
         * @param {string} type - Report type
         * @param {string} id - Report ID
         * @param {Object} values - Edited values
         * @returns {Object} API payload
         */
        buildUpdatePayload(type, id, values) {
            const payload = { id };

            switch (type) {
                case "Time Effort":
                    payload.endDateTime = values.endDateTime;
                    payload.remarks = values.remarks;
                    payload.durationMinutes = values.durationMinutes;
                    break;

                case "Material":
                    payload.date = values.date;
                    payload.quantity = values.quantity;
                    payload.remarks = values.remarks;
                    break;

                case "Expense":
                    payload.date = values.date;
                    payload.externalAmount = { amount: values.externalAmount, currency: "EUR" };
                    payload.internalAmount = { amount: values.internalAmount, currency: "EUR" };
                    payload.remarks = values.remarks;
                    break;

                case "Mileage":
                    payload.date = values.date;
                    payload.distance = values.distance;
                    payload.distanceUnit = "KM";
                    payload.source = values.source;
                    payload.destination = values.destination;
                    payload.travelStartDateTime = values.travelStartDateTime;
                    payload.travelEndDateTime = values.travelEndDateTime;
                    payload.remarks = values.remarks;
                    break;
            }

            return payload;
        },

        /**
         * Get display value updates after save.
         * @param {string} type - Report type
         * @param {Object} values - Edited values
         * @returns {Object} Display updates as {path: value} pairs
         */
        getDisplayUpdates(type, values) {
            const orNA = (val) => val || "N/A";

            switch (type) {
                case "Time Effort":
                    return {
                        "endDateTime": values.endDateTime,
                        "remarksText": orNA(values.remarks),
                        "durationMinutes": values.durationMinutes,
                        "durationText": values.durationMinutes + " min"
                    };

                case "Material":
                    return {
                        "fullData/date": values.date,
                        "fullData/quantity": values.quantity,
                        "dateText": orNA(values.date),
                        "quantityText": values.quantity ? String(values.quantity) : "N/A",
                        "remarksText": orNA(values.remarks)
                    };

                case "Expense":
                    return {
                        "fullData/date": values.date,
                        "fullData/externalAmount/amount": values.externalAmount,
                        "fullData/internalAmount/amount": values.internalAmount,
                        "dateText": orNA(values.date),
                        "externalAmountText": values.externalAmount + " EUR",
                        "internalAmountText": values.internalAmount + " EUR",
                        "remarksText": orNA(values.remarks)
                    };

                case "Mileage":
                    const routeText = (values.source && values.destination) 
                        ? values.source + " → " + values.destination 
                        : "N/A";
                    return {
                        "fullData/date": values.date,
                        "fullData/distance": values.distance,
                        "source": values.source,
                        "destination": values.destination,
                        "travelEndDateTime": values.travelEndDateTime,
                        "travelDurationMinutes": values.travelDuration,
                        "travelDurationText": values.travelDuration + " min",
                        "dateText": orNA(values.date),
                        "distanceText": values.distance + " KM",
                        "routeText": routeText,
                        "remarksText": orNA(values.remarks)
                    };

                default:
                    return {};
            }
        },

        /**
         * Apply edit values to model.
         * @param {sap.ui.model.json.JSONModel} model - Dialog model
         * @param {string} path - Path to report in model
         * @param {Object} editValues - Values from initEditMode
         */
        applyEditValues(model, path, editValues) {
            Object.keys(editValues).forEach(key => {
                model.setProperty(path + "/" + key, editValues[key]);
            });
        },

        /**
         * Apply display updates to model.
         * @param {sap.ui.model.json.JSONModel} model - Dialog model
         * @param {string} path - Path to report in model
         * @param {Object} displayUpdates - Values from getDisplayUpdates
         */
        applyDisplayUpdates(model, path, displayUpdates) {
            Object.keys(displayUpdates).forEach(key => {
                model.setProperty(path + "/" + key, displayUpdates[key]);
            });
        },

        /**
         * Calculate end datetime based on start and duration.
         * @param {string} startDateTime - ISO datetime string
         * @param {number} durationMinutes - Duration in minutes
         * @returns {string} Calculated end datetime
         */
        calculateEndDateTime(startDateTime, durationMinutes) {
            return DateTimeService.calculateEndDateTime(startDateTime, durationMinutes);
        },

        /**
         * Handle duration change - recalculate end datetime.
         * @param {sap.ui.model.json.JSONModel} model - Dialog model
         * @param {string} path - Path to report in model
         * @param {string} type - Report type (Time Effort or Mileage)
         * @param {number} newDuration - New duration value
         */
        handleDurationChange(model, path, type, newDuration) {
            let startDateTime, endProperty;

            if (type === "Time Effort") {
                startDateTime = model.getProperty(path + "/startDateTime");
                endProperty = "/editEndDateTime";
            } else if (type === "Mileage") {
                startDateTime = model.getProperty(path + "/travelStartDateTime");
                endProperty = "/editTravelEnd";
            } else {
                return;
            }

            if (startDateTime && newDuration >= 0) {
                const newEndDateTime = this.calculateEndDateTime(startDateTime, newDuration);
                model.setProperty(path + endProperty, newEndDateTime);
            }
        },

        /**
         * Format payload as JSON string for display.
         * @param {Object} payload - Payload object
         * @returns {string} Formatted JSON
         */
        formatPayloadJSON(payload) {
            return JSON.stringify(payload, null, 2);
        }
    };
});