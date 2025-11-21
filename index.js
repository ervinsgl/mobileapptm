const express = require('express');
const path = require('path');
const FSMService = require('./utils/FSMService');

const app = express();

// Middleware
app.use((req, res, next) => {
    res.removeHeader('X-Frame-Options');
    next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.enable('trust proxy');

// Serve static files (Fiori app)
app.use(express.static(path.join(__dirname, 'webapp')));

// ===========================
// API ROUTES
// ===========================

// Get Activity by ID
app.post("/api/get-activity-by-id", async (req, res) => {
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
app.post("/api/get-activity-by-code", async (req, res) => {
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
app.post("/api/get-activities-by-service-call", async (req, res) => {
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

// Get Organizational Levels
app.get("/api/get-organizational-levels", async (req, res) => {
    try {
        const data = await FSMService.getOrganizationalLevels();

        // Extract subLevels
        const subLevels = [];
        if (data.level && data.level.subLevels && Array.isArray(data.level.subLevels)) {
            data.level.subLevels.forEach((subLevel) => {
                subLevels.push({
                    id: subLevel.id,
                    name: subLevel.name,
                    shortDescription: subLevel.shortDescription || subLevel.name,
                    longDescription: subLevel.longDescription || subLevel.name
                });
            });
        }

        // Verify no duplicate IDs
        const ids = subLevels.map(s => s.id);
        const uniqueIds = [...new Set(ids)];
        if (ids.length !== uniqueIds.length) {
            console.error("Backend: DUPLICATE IDs DETECTED in organizational levels!", ids);
        }

        res.json({
            levels: subLevels
        });

    } catch (error) {
        console.error("Error fetching organizational levels:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to fetch organizational levels',
            error: error.response?.data || error.message
        });
    }
});

// Update Activity
app.put("/api/update-activity", async (req, res) => {
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
app.post("/api/get-reported-items", async (req, res) => {
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
            ...materials.map(item => ({
                ...item, // Keep all fields
                type: "Material" // Ensure type is set
            })),
            ...expenses.map(item => ({
                ...item, // Keep all fields  
                type: "Expense" // Ensure type is set
            })),
            ...mileages.map(item => ({
                ...item, // Keep all fields
                type: "Mileage" // Ensure type is set
            }))
        ];

        console.log('Backend: Sending enhanced T&M data:', allItems);

        res.json({
            items: allItems,
            count: allItems.length
        });

    } catch (error) {
        console.error("Error fetching reported items:", error.message);
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to fetch reported items',
            error: error.response?.data || error.message
        });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});