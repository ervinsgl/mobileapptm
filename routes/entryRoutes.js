/**
 * entryRoutes.js
 * 
 * Express Router for T&M entry CRUD endpoints (batch and individual).
 * Mounted at /api in index.js.
 * 
 * Batch Endpoints:
 * - POST   /api/batch-create     - Create multiple entries in one request
 * - PATCH  /api/batch-update     - Update multiple entries in one request
 * - DELETE /api/batch-delete     - Delete multiple entries in one request
 * 
 * Individual Endpoints:
 * - POST  /api/create-expense       - Create single expense
 * - PATCH /api/update-expense/:id   - Update single expense
 * - POST  /api/create-mileage       - Create single mileage
 * - PATCH /api/update-mileage/:id   - Update single mileage
 * - POST  /api/create-material      - Create single material
 * - PATCH /api/update-material/:id  - Update single material
 * - POST  /api/create-time-effort   - Create single time effort
 * - PATCH /api/update-time-effort/:id - Update single time effort
 * 
 * @file routes/entryRoutes.js
 * @requires ../utils/FSMService
 */

const express = require('express');
const router = express.Router();
const FSMService = require('../utils/FSMService');

// ===========================
// BATCH ENDPOINTS
// ===========================

/**
 * POST /api/batch-create
 * Create multiple entries in a single batch request.
 * Body: {
 *   entries: [
 *     { type: 'Expense'|'Mileage'|'Material'|'TimeEffort', payload: {...} },
 *     ...
 *   ],
 *   transactional: false (optional, default false - partial success allowed)
 * }
 */
router.post("/batch-create", async (req, res) => {
    const { entries, transactional = false } = req.body;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ 
            success: false,
            message: 'Entries array is required and must not be empty' 
        });
    }

    // Validate entries
    const validTypes = ['Expense', 'Mileage', 'Material', 'TimeEffort'];
    const invalidEntries = entries.filter(e => !validTypes.includes(e.type) || !e.payload);
    if (invalidEntries.length > 0) {
        return res.status(400).json({ 
            success: false,
            message: 'All entries must have valid type (Expense, Mileage, Material, TimeEffort) and payload' 
        });
    }

    try {
        console.log(`Batch create: ${entries.length} entries (transactional: ${transactional})`);
        
        const result = await FSMService.batchCreateEntries(entries, transactional);
        
        res.json({
            success: result.success,
            successCount: result.successCount,
            errorCount: result.errorCount,
            totalCount: result.totalCount,
            results: result.results,
            message: result.success 
                ? `Successfully created ${result.successCount} entries`
                : `Created ${result.successCount} of ${result.totalCount} entries (${result.errorCount} failed)`
        });

    } catch (error) {
        console.error("Error in batch create:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Batch create failed',
            error: error.response?.data || error.message
        });
    }
});

/**
 * PATCH /api/batch-update
 * Update multiple entries in a single batch request.
 * Body: {
 *   entries: [
 *     { type: 'Expense'|'Mileage'|'Material'|'TimeEffort', id: '...', payload: {...} },
 *     ...
 *   ],
 *   transactional: false (optional, default false - partial success allowed)
 * }
 */
router.patch("/batch-update", async (req, res) => {
    const { entries, transactional = false } = req.body;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ 
            success: false,
            message: 'Entries array is required and must not be empty' 
        });
    }

    // Validate entries
    const validTypes = ['Expense', 'Mileage', 'Material', 'TimeEffort'];
    const invalidEntries = entries.filter(e => !validTypes.includes(e.type) || !e.id || !e.payload);
    if (invalidEntries.length > 0) {
        return res.status(400).json({ 
            success: false,
            message: 'All entries must have valid type (Expense, Mileage, Material, TimeEffort), id, and payload' 
        });
    }

    try {
        console.log(`Batch update: ${entries.length} entries (transactional: ${transactional})`);
        
        const result = await FSMService.batchUpdateEntries(entries, transactional);
        
        res.json({
            success: result.success,
            successCount: result.successCount,
            errorCount: result.errorCount,
            totalCount: result.totalCount,
            results: result.results,
            message: result.success 
                ? `Successfully updated ${result.successCount} entries`
                : `Updated ${result.successCount} of ${result.totalCount} entries (${result.errorCount} failed)`
        });

    } catch (error) {
        console.error("Error in batch update:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Batch update failed',
            error: error.response?.data || error.message
        });
    }
});

/**
 * DELETE /api/batch-delete
 * Delete multiple entries in a single batch request.
 * Body: {
 *   entries: [
 *     { type: 'Expense'|'Mileage'|'Material'|'TimeEffort', id: '...', lastChanged: 1234567890 },
 *     ...
 *   ],
 *   transactional: false (optional, default false - partial success allowed)
 * }
 */
router.delete("/batch-delete", async (req, res) => {
    const { entries, transactional = false } = req.body;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ 
            success: false,
            message: 'Entries array is required and must not be empty' 
        });
    }

    // Validate entries
    const validTypes = ['Expense', 'Mileage', 'Material', 'TimeEffort'];
    const invalidEntries = entries.filter(e => !validTypes.includes(e.type) || !e.id || !e.lastChanged);
    if (invalidEntries.length > 0) {
        return res.status(400).json({ 
            success: false,
            message: 'All entries must have valid type (Expense, Mileage, Material, TimeEffort), id, and lastChanged' 
        });
    }

    try {
        console.log(`Batch delete: ${entries.length} entries (transactional: ${transactional})`);
        
        const result = await FSMService.batchDeleteEntries(entries, transactional);
        
        res.json({
            success: result.success,
            successCount: result.successCount,
            errorCount: result.errorCount,
            totalCount: result.totalCount,
            results: result.results,
            message: result.success 
                ? `Successfully deleted ${result.successCount} entries`
                : `Deleted ${result.successCount} of ${result.totalCount} entries (${result.errorCount} failed)`
        });

    } catch (error) {
        console.error("Error in batch delete:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Batch delete failed',
            error: error.response?.data || error.message
        });
    }
});

// ===========================
// INDIVIDUAL CRUD ENDPOINTS
// ===========================

// Create Expense Report
router.post("/create-expense", async (req, res) => {
    const expenseData = req.body;

    if (!expenseData || !expenseData.object) {
        return res.status(400).json({ message: 'Expense data is required' });
    }

    try {
        const result = await FSMService.createExpense(expenseData);
        
        res.json({
            success: true,
            data: result,
            message: 'Expense created successfully'
        });

    } catch (error) {
        console.error("Error creating expense:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Failed to create expense',
            error: error.response?.data || error.message
        });
    }
});

// Update Expense Report
router.patch("/update-expense/:id", async (req, res) => {
    const expenseId = req.params.id;
    const expenseData = req.body;

    if (!expenseId) {
        return res.status(400).json({ message: 'Expense ID is required' });
    }

    try {
        const result = await FSMService.updateExpense(expenseId, expenseData);
        
        res.json({
            success: true,
            data: result,
            message: 'Expense updated successfully'
        });

    } catch (error) {
        console.error("Error updating expense:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Failed to update expense',
            error: error.response?.data || error.message
        });
    }
});

// Create Mileage Report
router.post("/create-mileage", async (req, res) => {
    const mileageData = req.body;

    if (!mileageData || !mileageData.object) {
        return res.status(400).json({ message: 'Mileage data is required' });
    }

    try {
        const result = await FSMService.createMileage(mileageData);
        
        res.json({
            success: true,
            data: result,
            message: 'Mileage created successfully'
        });

    } catch (error) {
        console.error("Error creating mileage:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Failed to create mileage',
            error: error.response?.data || error.message
        });
    }
});

// Update Mileage Report
router.patch("/update-mileage/:id", async (req, res) => {
    const mileageId = req.params.id;
    const mileageData = req.body;

    if (!mileageId) {
        return res.status(400).json({ message: 'Mileage ID is required' });
    }

    try {
        const result = await FSMService.updateMileage(mileageId, mileageData);
        
        res.json({
            success: true,
            data: result,
            message: 'Mileage updated successfully'
        });

    } catch (error) {
        console.error("Error updating mileage:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Failed to update mileage',
            error: error.response?.data || error.message
        });
    }
});

// Create Material
router.post("/create-material", async (req, res) => {
    const materialData = req.body;

    if (!materialData || !materialData.object) {
        return res.status(400).json({ message: 'Material data is required' });
    }

    try {
        const result = await FSMService.createMaterial(materialData);
        
        res.json({
            success: true,
            data: result,
            message: 'Material created successfully'
        });

    } catch (error) {
        console.error("Error creating material:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Failed to create material',
            error: error.response?.data || error.message
        });
    }
});

// Create TimeEffort
router.post("/create-time-effort", async (req, res) => {
    const timeEffortData = req.body;

    if (!timeEffortData || !timeEffortData.object) {
        return res.status(400).json({ message: 'TimeEffort data is required' });
    }

    try {
        const result = await FSMService.createTimeEffort(timeEffortData);
        
        res.json({
            success: true,
            data: result,
            message: 'TimeEffort created successfully'
        });

    } catch (error) {
        console.error("Error creating time effort:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Failed to create time effort',
            error: error.response?.data || error.message
        });
    }
});

// Update Material
router.patch("/update-material/:id", async (req, res) => {
    const materialId = req.params.id;
    const materialData = req.body;

    if (!materialId) {
        return res.status(400).json({ message: 'Material ID is required' });
    }

    try {
        const result = await FSMService.updateMaterial(materialId, materialData);
        
        res.json({
            success: true,
            data: result,
            message: 'Material updated successfully'
        });

    } catch (error) {
        console.error("Error updating material:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Failed to update material',
            error: error.response?.data || error.message
        });
    }
});

// Update TimeEffort
router.patch("/update-time-effort/:id", async (req, res) => {
    const timeEffortId = req.params.id;
    const timeEffortData = req.body;

    if (!timeEffortId) {
        return res.status(400).json({ message: 'TimeEffort ID is required' });
    }

    try {
        const result = await FSMService.updateTimeEffort(timeEffortId, timeEffortData);
        
        res.json({
            success: true,
            data: result,
            message: 'TimeEffort updated successfully'
        });

    } catch (error) {
        console.error("Error updating time effort:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Failed to update time effort',
            error: error.response?.data || error.message
        });
    }
});

module.exports = router;