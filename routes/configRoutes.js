/**
 * configRoutes.js
 * 
 * Express Router for Expense/Mileage type configuration endpoints.
 * Mounted at /api in index.js.
 * 
 * Endpoints:
 * - GET  /api/get-type-config     - Get current type configuration
 * - POST /api/save-type-config    - Save full type configuration
 * - POST /api/add-expense-type    - Add single expense type ID
 * - POST /api/remove-expense-type - Remove single expense type ID
 * - POST /api/add-mileage-type    - Add single mileage type ID
 * - POST /api/remove-mileage-type - Remove single mileage type ID
 * - POST /api/reset-type-config   - Reset to defaults
 * 
 * @file routes/configRoutes.js
 * @requires ../TypeConfigStore
 */

const express = require('express');
const router = express.Router();
const TypeConfigStore = require('../config/TypeConfigStore');

/**
 * GET /api/get-type-config
 * Returns current type configuration (expense and mileage types)
 */
router.get("/get-type-config", (req, res) => {
    try {
        const config = TypeConfigStore.getConfig();
        res.json({
            success: true,
            data: config
        });
    } catch (error) {
        console.error("Error getting type config:", error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to get type configuration',
            error: error.message
        });
    }
});

/**
 * POST /api/save-type-config
 * Save full type configuration
 * Body: { expenseTypes: [...], mileageTypes: [...], modifiedBy: "username" }
 */
router.post("/save-type-config", (req, res) => {
    try {
        const { expenseTypes, mileageTypes, modifiedBy } = req.body;
        
        const result = TypeConfigStore.updateConfig(
            { expenseTypes, mileageTypes },
            modifiedBy
        );
        
        if (result.success) {
            res.json({
                success: true,
                data: result.config,
                message: 'Configuration saved successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to save configuration'
            });
        }
    } catch (error) {
        console.error("Error saving type config:", error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to save type configuration',
            error: error.message
        });
    }
});

/**
 * POST /api/add-expense-type
 * Add a single expense type ID
 * Body: { typeId: "Z...", modifiedBy: "username" }
 */
router.post("/add-expense-type", (req, res) => {
    try {
        const { typeId, modifiedBy } = req.body;
        const result = TypeConfigStore.addExpenseType(typeId, modifiedBy);
        
        if (result.success) {
            res.json({
                success: true,
                data: result.config,
                message: `Added expense type: ${typeId}`
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        console.error("Error adding expense type:", error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to add expense type',
            error: error.message
        });
    }
});

/**
 * POST /api/remove-expense-type
 * Remove a single expense type ID
 * Body: { typeId: "Z...", modifiedBy: "username" }
 */
router.post("/remove-expense-type", (req, res) => {
    try {
        const { typeId, modifiedBy } = req.body;
        const result = TypeConfigStore.removeExpenseType(typeId, modifiedBy);
        
        if (result.success) {
            res.json({
                success: true,
                data: result.config,
                message: `Removed expense type: ${typeId}`
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        console.error("Error removing expense type:", error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to remove expense type',
            error: error.message
        });
    }
});

/**
 * POST /api/add-mileage-type
 * Add a single mileage type ID
 * Body: { typeId: "Z...", modifiedBy: "username" }
 */
router.post("/add-mileage-type", (req, res) => {
    try {
        const { typeId, modifiedBy } = req.body;
        const result = TypeConfigStore.addMileageType(typeId, modifiedBy);
        
        if (result.success) {
            res.json({
                success: true,
                data: result.config,
                message: `Added mileage type: ${typeId}`
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        console.error("Error adding mileage type:", error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to add mileage type',
            error: error.message
        });
    }
});

/**
 * POST /api/remove-mileage-type
 * Remove a single mileage type ID
 * Body: { typeId: "Z...", modifiedBy: "username" }
 */
router.post("/remove-mileage-type", (req, res) => {
    try {
        const { typeId, modifiedBy } = req.body;
        const result = TypeConfigStore.removeMileageType(typeId, modifiedBy);
        
        if (result.success) {
            res.json({
                success: true,
                data: result.config,
                message: `Removed mileage type: ${typeId}`
            });
        } else {
            res.status(400).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        console.error("Error removing mileage type:", error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to remove mileage type',
            error: error.message
        });
    }
});

/**
 * POST /api/reset-type-config
 * Reset type configuration to defaults
 * Body: { modifiedBy: "username" }
 */
router.post("/reset-type-config", (req, res) => {
    try {
        const { modifiedBy } = req.body;
        const result = TypeConfigStore.resetToDefaults(modifiedBy);
        
        if (result.success) {
            res.json({
                success: true,
                data: result.config,
                message: 'Configuration reset to defaults'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to reset configuration'
            });
        }
    } catch (error) {
        console.error("Error resetting type config:", error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to reset type configuration',
            error: error.message
        });
    }
});

module.exports = router;