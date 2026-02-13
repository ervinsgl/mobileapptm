/**
 * activityRoutes.js
 * 
 * Express Router for Activity and Reported Items endpoints.
 * Mounted at /api in index.js.
 * 
 * Endpoints:
 * - POST /api/get-activity-by-id            - Get single activity by ID
 * - POST /api/get-activity-by-code          - Get activity by external code
 * - POST /api/get-activities-by-service-call - Get composite tree for service call
 * - PUT  /api/update-activity               - Update activity fields
 * - POST /api/get-reported-items            - Get all T&M reports for activity
 * 
 * @file routes/activityRoutes.js
 * @requires ../utils/FSMService
 */

const express = require('express');
const router = express.Router();
const FSMService = require('../utils/FSMService');

// Get Activity by ID
router.post("/get-activity-by-id", async (req, res) => {
    const { activityId } = req.body;

    if (!activityId) {
        return res.status(400).json({ message: 'Activity ID is required' });
    }

    try {
        const data = await FSMService.getActivityById(activityId);
        res.json(data);
    } catch (error) {
        console.error("Error fetching activity by ID:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Activity not found',
            error: error.response?.data || error.message
        });
    }
});

// Get Activity by Code
router.post("/get-activity-by-code", async (req, res) => {
    const { activityCode } = req.body;

    if (!activityCode) {
        return res.status(400).json({ message: 'Activity Code is required' });
    }

    try {
        const data = await FSMService.getActivityByCode(activityCode);
        res.json(data);
    } catch (error) {
        console.error("Error fetching activity by code:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Activity not found',
            error: error.response?.data || error.message
        });
    }
});

// Get Activities by Service Call ID (Composite Tree)
router.post("/get-activities-by-service-call", async (req, res) => {
    const { serviceCallId } = req.body;

    if (!serviceCallId) {
        return res.status(400).json({ message: 'Service Call ID is required' });
    }

    try {
        // Return the COMPLETE composite-tree response
        const data = await FSMService.getActivitiesForServiceCall(serviceCallId);
        res.json(data);
    } catch (error) {
        console.error("Error fetching activities by service call:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to fetch activities',
            error: error.response?.data || error.message
        });
    }
});

// Update Activity
router.put("/update-activity", async (req, res) => {
    const { activityId, startDateTime, endDateTime, remarks, status } = req.body;

    if (!activityId) {
        return res.status(400).json({ message: 'Activity ID is required' });
    }

    try {
        const updatePayload = { activity: {} };
        if (startDateTime) updatePayload.activity.startDateTime = startDateTime;
        if (endDateTime) updatePayload.activity.endDateTime = endDateTime;
        if (remarks) updatePayload.activity.remarks = remarks;
        if (status) updatePayload.activity.status = status;

        const data = await FSMService.updateActivity(activityId, updatePayload);
        res.json(data);
    } catch (error) {
        console.error("Error updating activity:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to update activity',
            error: error.response?.data || error.message
        });
    }
});

// Get Reported Items (T&M) for Activity
router.post("/get-reported-items", async (req, res) => {
    const { activityId } = req.body;

    if (!activityId) {
        return res.status(400).json({ message: 'Activity ID is required' });
    }

    try {
        // Fetch all 4 types in parallel
        const [timeEfforts, materials, expenses, mileages] = await Promise.all([
            FSMService.getTimeEffortsForActivity(activityId),
            FSMService.getMaterialsForActivity(activityId),
            FSMService.getExpensesForActivity(activityId),
            FSMService.getMileagesForActivity(activityId)
        ]);

        const allItems = [
            ...timeEfforts,
            ...materials,
            ...expenses,
            ...mileages
        ];

        res.json({
            items: allItems,     // Full data including all fields
            count: allItems.length,
            breakdown: {
                timeEfforts: timeEfforts.length,
                materials: materials.length,
                expenses: expenses.length,
                mileages: mileages.length
            }
        });

    } catch (error) {
        console.error("Error fetching reported items:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to fetch reported items',
            error: error.response?.data || error.message
        });
    }
});

module.exports = router;