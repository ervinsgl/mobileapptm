const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();

app.use((req, res, next) => {
    res.removeHeader('X-Frame-Options');
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.enable('trust proxy');

// FSM Configuration (fallback values)
const FSM_CONFIG = {
    account: 'tuev-nord_t1',
    company: 'TUEV-NORD_S4E'
};

/**
 * Get Destination Service credentials from VCAP_SERVICES
 */
function getDestinationServiceCredentials() {
    const vcapServices = JSON.parse(process.env.VCAP_SERVICES || '{}');
    const destinationService = vcapServices.destination?.[0];

    if (!destinationService) {
        throw new Error('Destination service not bound to application');
    }

    return destinationService.credentials;
}

/**
 * Get destination configuration from BTP Destination Service
 */
async function getDestinationConfig(destinationName) {
    try {
        const credentials = getDestinationServiceCredentials();

        // Get OAuth token for Destination Service
        const tokenResponse = await axios.post(
            credentials.url + '/oauth/token',
            new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: credentials.clientid,
                client_secret: credentials.clientsecret
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;

        // Get destination configuration
        const destinationResponse = await axios.get(
            `${credentials.uri}/destination-configuration/v1/destinations/${destinationName}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        return destinationResponse.data;

    } catch (error) {
        console.error('Error loading destination:', error.response?.data || error.message);
        throw new Error('Failed to load FSM destination');
    }
}

// Token cache
let cachedFSMToken = null;
let tokenExpiry = null;

/**
 * Get OAuth token for FSM API (with caching)
 */
async function getFSMToken(destination) {
    try {
        // Return cached token if still valid (with 5 minute buffer)
        if (cachedFSMToken && tokenExpiry && Date.now() < tokenExpiry - 300000) {
            return cachedFSMToken;
        }

        const config = destination.destinationConfiguration;
        const tokenServiceUrl = config.tokenServiceURL;
        const clientId = config.clientId;
        const clientSecret = config.clientSecret;

        if (!clientId || !clientSecret) {
            throw new Error('Client credentials not found in destination configuration');
        }

        // FSM OAuth: Basic Authentication with client credentials
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const authHeader = `Basic ${credentials}`;

        const response = await axios.post(
            tokenServiceUrl,
            'grant_type=client_credentials',
            {
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        cachedFSMToken = response.data.access_token;
        const expiresIn = response.data.expires_in || 3600;
        tokenExpiry = Date.now() + (expiresIn * 1000);

        return cachedFSMToken;

    } catch (error) {
        if (error.response?.data?.error === 'too_many_requests') {
            const retryAfter = error.response.headers['retry-after'] || 900;
            throw new Error(`Rate limited by FSM. Please wait ${Math.ceil(retryAfter / 60)} minutes before retrying.`);
        }
        throw error;
    }
}

/**
 * Make authenticated request to FSM API
 */
async function makeFSMRequest(path, params = {}) {
    try {
        const destination = await getDestinationConfig('FSM_API');
        const fsmToken = await getFSMToken(destination);

        const baseUrl = destination.destinationConfiguration.URL;
        const fullUrl = `${baseUrl}${path}`;

        const queryParams = {
            ...params,
            account: destination.destinationConfiguration.account || FSM_CONFIG.account,
            company: destination.destinationConfiguration.company || FSM_CONFIG.company
        };

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fsmToken}`,
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
        console.error('FSM API Error:', error.response?.data || error.message);
        throw error;
    }
}

// ===========================
// ROUTES
// ===========================

// Serve static files (Fiori app)
app.use(express.static(path.join(__dirname, 'webapp')));

// Get Activity by ID
app.post("/api/get-activity-by-id", async (req, res) => {
    const { activityId } = req.body;

    if (!activityId) {
        return res.status(400).json({
            message: 'Activity ID is required'
        });
    }

    try {
        const data = await makeFSMRequest(
            `/Activity/${activityId}`,
            { dtos: 'Activity.40' }
        );

        res.json(data);

    } catch (error) {
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
        return res.status(400).json({
            message: 'Activity Code is required'
        });
    }

    try {
        const data = await makeFSMRequest(
            `/Activity/externalId/${activityCode}`,
            { dtos: 'Activity.40' }
        );

        res.json(data);

    } catch (error) {
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Activity not found',
            error: error.response?.data || error.message
        });
    }
});

// Update Activity
app.put("/api/update-activity", async (req, res) => {
    const { activityId, startDateTime, endDateTime, remarks, status } = req.body;

    if (!activityId) {
        return res.status(400).json({
            message: 'Activity ID is required'
        });
    }

    try {
        const destination = await getDestinationConfig('FSM_API');
        const fsmToken = await getFSMToken(destination);

        const baseUrl = destination.destinationConfiguration.URL;
        const fullUrl = `${baseUrl}/Activity/${activityId}`;

        const queryParams = {
            dtos: 'Activity.40',
            account: destination.destinationConfiguration.account || FSM_CONFIG.account,
            company: destination.destinationConfiguration.company || FSM_CONFIG.company
        };

        // Build update payload
        const updatePayload = {
            activity: {}
        };

        if (startDateTime) updatePayload.activity.startDateTime = startDateTime;
        if (endDateTime) updatePayload.activity.endDateTime = endDateTime;
        if (remarks) updatePayload.activity.remarks = remarks;
        if (status) updatePayload.activity.status = status;

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${fsmToken}`,
            'X-Account-ID': destination.destinationConfiguration['URL.headers.X-Account-ID'],
            'X-Company-ID': destination.destinationConfiguration['URL.headers.X-Company-ID'],
            'X-Client-ID': destination.destinationConfiguration['URL.headers.X-Client-ID'],
            'X-Client-Version': destination.destinationConfiguration['URL.headers.X-Client-Version']
        };

        const response = await axios.put(fullUrl, updatePayload, {
            params: queryParams,
            headers: headers
        });

        res.json(response.data);

    } catch (error) {
        res.status(error.response?.status || 500).json({
            message: error.response?.data?.message || 'Failed to update activity',
            error: error.response?.data || error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});