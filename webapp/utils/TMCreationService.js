sap.ui.define([
    "sap/m/MessageToast"
], (MessageToast) => {
    "use strict";

    return {
        /**
         * Create Time Effort entry template
         * @returns {object} Empty Time Effort entry
         */
        createTimeEffortEntry() {
            return {
                type: "Time Effort",
                icon: "sap-icon://time-entry-request",
                expanded: true,
                // Button state properties
                saveButtonText: "Save",
                saveButtonIcon: "sap-icon://save",
                saveButtonType: "Emphasized",
                saveButtonState: "unsaved",
                // Empty fields - to be filled by user
                task: "",
                technician: "",
                duration: "",
                start: "",
                end: "",
                chargeOption: "",
                remarks: ""
            };
        },

        /**
         * Create Material entry template
         * @returns {object} Empty Material entry
         */
        createMaterialEntry() {
            return {
                type: "Material",
                icon: "sap-icon://product",
                expanded: true,
                // Button state properties
                saveButtonText: "Save",
                saveButtonIcon: "sap-icon://save",
                saveButtonType: "Emphasized",
                saveButtonState: "unsaved",
                // Empty fields - to be filled by user
                item: "",
                technician: "",
                date: "",
                quantity: "",
                chargeOption: "",
                remarks: ""
            };
        },

        /**
         * Create Expense entry template
         * @returns {object} Empty Expense entry
         */
        createExpenseEntry() {
            return {
                type: "Expense",
                icon: "sap-icon://money-bills",
                expanded: true,
                // Button state properties
                saveButtonText: "Save",
                saveButtonIcon: "sap-icon://save",
                saveButtonType: "Emphasized",
                saveButtonState: "unsaved",
                // Empty fields - to be filled by user
                expenseType: "",
                technician: "",
                date: "",
                externalAmount: "",
                internalAmount: "",
                chargeOption: "",
                remarks: ""
            };
        },

        /**
         * Create Mileage entry template
         * @returns {object} Empty Mileage entry
         */
        createMileageEntry() {
            return {
                type: "Mileage",
                icon: "sap-icon://car-rental",
                expanded: true,
                // Button state properties
                saveButtonText: "Save",
                saveButtonIcon: "sap-icon://save",
                saveButtonType: "Emphasized",
                saveButtonState: "unsaved",
                // Empty fields - to be filled by user
                route: "",
                technician: "",
                distance: "",
                date: "",
                travelStart: "",
                travelEnd: "",
                driver: "",
                privateCar: "",
                chargeOption: "",
                remarks: ""
            };
        },

        /**
         * Add entry to model
         * @param {sap.ui.model.json.JSONModel} oModel - Dialog model
         * @param {object} entry - Entry object to add
         * @param {string} entryType - Type name for toast message
         */
        addEntryToModel(oModel, entry, entryType) {
            const aEntries = oModel.getProperty("/entries");
            aEntries.push(entry);
            oModel.setProperty("/entries", aEntries);
            MessageToast.show(`${entryType} entry added`);
        },

        /**
         * Validate all entries before save
         * @param {array} entries - Array of entries to validate
         * @returns {object} Validation result {valid: boolean, errors: array}
         */
        validateEntries(entries) {
            const errors = [];

            if (!entries || entries.length === 0) {
                errors.push("No entries to save");
                return { valid: false, errors };
            }

            entries.forEach((entry, index) => {
                switch (entry.type) {
                    case "Time Effort":
                        if (!entry.task) errors.push(`Entry ${index + 1}: Task is required`);
                        if (!entry.duration) errors.push(`Entry ${index + 1}: Duration is required`);
                        break;
                    case "Material":
                        if (!entry.item) errors.push(`Entry ${index + 1}: Item is required`);
                        if (!entry.quantity) errors.push(`Entry ${index + 1}: Quantity is required`);
                        break;
                    case "Expense":
                        if (!entry.expenseType) errors.push(`Entry ${index + 1}: Expense Type is required`);
                        break;
                    case "Mileage":
                        if (!entry.distance) errors.push(`Entry ${index + 1}: Distance is required`);
                        break;
                }
            });

            return {
                valid: errors.length === 0,
                errors
            };
        },

        /**
         * Save all entries (placeholder for actual FSM API call)
         * @param {array} entries - Array of entries to save
         * @param {string} activityId - Activity ID to save entries for
         * @returns {Promise} Save operation promise
         */
        async saveAllEntries(entries, activityId) {
            console.log('Saving T&M entries for activity:', activityId);
            console.log('Entries:', entries);

            // Validate entries
            const validation = this.validateEntries(entries);
            if (!validation.valid) {
                throw new Error(validation.errors.join("\n"));
            }

            // TODO: Implement actual FSM API calls
            // For each entry:
            //   - Call appropriate endpoint (TimeEffort, Material, Expense, Mileage)
            //   - Handle success/error responses

            // Placeholder for now
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({
                        success: true,
                        savedCount: entries.length
                    });
                }, 500);
            });
        }
    };
});