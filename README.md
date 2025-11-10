# FSM Mobile Integration App

A SAP Fiori mobile application for SAP Field Service Management (FSM), designed to be opened from FSM Mobile as an External App or Workflow.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup & Deployment](#setup--deployment)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Development Guide](#development-guide)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This application provides a mobile-optimized interface for viewing and managing FSM activities. It integrates seamlessly with FSM Mobile through External Apps and Workflows.

**Key Features:**
- ✅ Auto-loads activity data from FSM Mobile context
- ✅ Displays activity details, service call information
- ✅ Mobile-first responsive design
- ✅ Secure authentication via SAP BTP Destination Service
- ✅ Direct FSM API integration

**Technology Stack:**
- **Frontend:** SAP UI5 (Fiori)
- **Backend:** Node.js + Express
- **Deployment:** SAP Business Technology Platform (Cloud Foundry)
- **Authentication:** OAuth 2.0 via BTP Destination Service

---

## 🏗️ Architecture

```
┌─────────────────┐
│   FSM Mobile    │  (Opens External App with activityId)
└────────┬────────┘
         │ URL: https://app.cfapps.../activityId=123
         ▼
┌─────────────────┐
│  SAP BTP (CF)   │  (Cloud Foundry App)
│  ┌───────────┐  │
│  │ UI5 App   │  │  (Frontend - Fiori)
│  │ (webapp/) │  │
│  └─────┬─────┘  │
│        │         │
│  ┌─────▼─────┐  │
│  │ Express   │  │  (Backend - index.js)
│  │ Server    │  │
│  └─────┬─────┘  │
└────────┼────────┘
         │ OAuth Token
         ▼
┌─────────────────┐
│ BTP Destination │  (FSM_API destination)
│    Service      │
└────────┬────────┘
         │ Authenticated Request
         ▼
┌─────────────────┐
│   FSM API       │  (SAP Field Service Management)
└─────────────────┘
```

---

## ✅ Prerequisites

### Required:
1. **Node.js** - LTS version (v18+ recommended)
2. **npm** - Version 9+
3. **Cloud Foundry CLI** - `cf` command line tool
4. **SAP BTP Account** - Cloud Foundry space with quota
5. **FSM Instance** - Access to SAP Field Service Management

### SAP BTP Services:
- **Destination Service** - Bound to the application
- **Destination Configuration** - FSM_API destination configured

---

## 🚀 Setup & Deployment

### 1. Clone & Install

```bash
git clone <repository-url>
cd mobileappsc
npm install
```

### 2. Configure BTP Destination

Create a destination named **FSM_API** in SAP BTP Cockpit:

```
Name: FSM_API
Type: HTTP
URL: https://de.fsm.cloud.sap/api/data/v4
Authentication: OAuth2ClientCredentials
Token Service URL: https://de.fsm.cloud.sap/api/oauth2/v1/token
Client ID: <your-fsm-client-id>
Client Secret: <your-fsm-client-secret>

Additional Properties:
  account: tuev-nord_t1
  company: TUEV-NORD_S4E
  URL.headers.X-Account-ID: 94854
  URL.headers.X-Company-ID: 109220
  URL.headers.X-Client-ID: FSM_Extension
  URL.headers.X-Client-Version: 0.0.1
```

### 3. Create Destination Service Instance

```bash
cf create-service destination lite mobileappsc-destination
```

### 4. Deploy to Cloud Foundry

```bash
cf push
```

### 5. Get Application URL

```bash
cf app mobileappsc
```

Copy the URL (e.g., `https://mobileappsc-xxx.cfapps.eu10.hana.ondemand.com`)

### 6. Configure FSM External App

In FSM Admin → Configuration → External Apps:

```json
{
  "android": {
    "url": "https://mobileappsc-xxx.cfapps.eu10.hana.ondemand.com/?activityId=${activity.id}&activityCode=${activity.code}&activitySubject=${activity.subject}"
  },
  "ios": {
    "url": "https://mobileappsc-xxx.cfapps.eu10.hana.ondemand.com/?activityId=${activity.id}&activityCode=${activity.code}&activitySubject=${activity.subject}"
  }
}
```

### 7. Create Workflow (Optional)

Add a workflow button to activities that opens the External App.

---

## 🔄 How It Works

### User Flow:

1. **Technician opens FSM Mobile** → Navigates to an Activity
2. **Clicks "External App" button** → FSM Mobile opens the app in Chrome Custom Tabs
3. **App receives URL parameters** → `?activityId=123&activityCode=456`
4. **Backend authenticates** → Gets OAuth token from BTP Destination Service
5. **Fetches activity data** → Calls FSM API with authentication
6. **Displays activity** → Shows activity details, service call info
7. **User can refresh** → Reload button fetches latest data

### URL Parameters:

The app receives context from FSM Mobile via URL:

```
https://app.cfapps.eu10.../
  ?activityId=9D92E0B18FDC4A27A213401FEEA89FDA    # Activity UUID
  &activityCode=19687                             # Activity Code
  &activitySubject=TEST%20APP%20#17              # Activity Subject
```

### Authentication Flow:

```
1. App starts → Reads VCAP_SERVICES for Destination credentials
2. Gets OAuth token → Calls BTP Destination Service
3. Retrieves FSM destination → Gets FSM API URL + credentials
4. Gets FSM OAuth token → Authenticates with FSM
5. Makes API call → Fetches activity data
6. Token cached → Reused for 55 minutes (with 5min buffer)
```

---

## 📁 Project Structure

```
mobileappsc/
├── webapp/                          # Frontend (UI5 Fiori app)
│   ├── controller/
│   │   ├── App.controller.js        # Root controller
│   │   └── View1.controller.js      # Main view controller (activity display)
│   ├── view/
│   │   ├── App.view.xml             # Root view (router container)
│   │   ├── View1.view.xml           # Main view (activity details)
│   │   └── fragments/
│   │       ├── ServiceCall.fragment.xml       # Service call panel
│   │       ├── ActivityDetails.fragment.xml   # Activity details panel
│   │       └── ActivitySelection.fragment.xml # Activity picker (future use)
│   ├── utils/
│   │   └── formatter.js             # Data formatting utilities
│   ├── model/
│   │   └── models.js                # Device model initialization
│   ├── css/
│   │   └── style.css                # Custom styles
│   ├── i18n/
│   │   └── i18n.properties          # Internationalization texts
│   ├── index.html                   # App entry point
│   ├── manifest.json                # App descriptor (UI5 manifest)
│   └── Component.js                 # UI5 Component (with mobile router fix)
│
├── index.js                         # Express server + FSM API integration
├── package.json                     # Node.js dependencies
├── manifest.yaml                    # Cloud Foundry deployment config
└── README.md                        # This file
```

### Key Files Explained:

#### **Backend:**

- **`index.js`** - Express server that:
  - Serves static UI5 files
  - Provides REST API endpoints (`/api/get-activity-by-id`, etc.)
  - Handles FSM API authentication via BTP Destination Service
  - Caches OAuth tokens for performance

#### **Frontend:**

- **`webapp/Component.js`** - UI5 component with **mobile router fix**
  - Fixes routing issues in mobile Chrome Custom Tabs
  - Forces navigation to View1 if route bypassed

- **`webapp/controller/View1.controller.js`** - Main controller
  - Reads URL parameters (activityId)
  - Fetches activity data from backend API
  - Updates view model with activity details

- **`webapp/view/View1.view.xml`** - Main view
  - Displays activity information
  - Uses fragments for modular UI
  - Responsive design for mobile

- **`webapp/manifest.json`** - UI5 app descriptor
  - Defines routing configuration
  - Specifies models and dependencies

---

## 💻 Development Guide

### Local Development

```bash
# Install dependencies
npm install

# Start local server
npm start

# App runs on http://localhost:3000
```

**Note:** Local development requires BTP Destination Service. Use `cf push` for testing.

### Testing in Browser

Open the app with test parameters:

```
http://localhost:3000/?activityId=YOUR_ACTIVITY_ID
```

### Making Changes

#### 1. **Add a new UI field:**

Edit `webapp/view/fragments/ActivityDetails.fragment.xml`:

```xml
<Label text="New Field" design="Bold" class="sapUiTinyMarginTop" />
<Text text="{view>/selectedActivity/newField}" />
```

#### 2. **Add a new API endpoint:**

Edit `index.js`:

```javascript
app.post("/api/your-endpoint", async (req, res) => {
    try {
        const data = await makeFSMRequest('/YourPath', { params });
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});
```

#### 3. **Add a formatter:**

Edit `webapp/utils/formatter.js`:

```javascript
formatYourData(value) {
    if (!value) return "";
    return value.toUpperCase();
}
```

### Deploy Changes

```bash
cf push
```

App updates automatically. **No need to reconfigure FSM External App!**

---

## 🔌 API Reference

### Backend Endpoints:

#### **POST /api/get-activity-by-id**

Fetch activity by ID.

**Request:**
```json
{
  "activityId": "9D92E0B18FDC4A27A213401FEEA89FDA"
}
```

**Response:**
```json
{
  "data": [{
    "activity": {
      "id": "9D92E0B18FDC4A27A213401FEEA89FDA",
      "code": "19687",
      "subject": "TEST APP #17",
      "status": "IN_PROGRESS",
      "type": "INSTALLATION",
      ...
    }
  }]
}
```

#### **POST /api/get-activity-by-code**

Fetch activity by external code.

**Request:**
```json
{
  "activityCode": "19687"
}
```

#### **PUT /api/update-activity**

Update activity fields.

**Request:**
```json
{
  "activityId": "9D92E0B18FDC4A27A213401FEEA89FDA",
  "startDateTime": "2025-11-07T10:00:00Z",
  "endDateTime": "2025-11-07T12:00:00Z",
  "remarks": "Work completed",
  "status": "COMPLETED"
}
```

---

## 🐛 Troubleshooting

### Issue: Blank screen on mobile

**Cause:** Mobile Chrome Custom Tabs don't initialize router properly.

**Solution:** Already fixed in `Component.js` with mobile router fix:
```javascript
router.attachBypassed(function() {
    router.navTo("RouteView1", {}, true);
});
```

### Issue: "Destination service not bound"

**Cause:** Destination service not bound to app.

**Solution:**
```bash
cf bind-service mobileappsc mobileappsc-destination
cf restage mobileappsc
```

### Issue: "Activity not found (404)"

**Cause:** FSM API credentials or destination config incorrect.

**Solution:** Check BTP Destination configuration (FSM_API).

### Issue: Token expired

**Cause:** FSM OAuth token expired (cached for 55 min).

**Solution:** Token auto-refreshes. If issue persists, restart app:
```bash
cf restart mobileappsc
```

### View Logs:

```bash
cf logs mobileappsc --recent
```

---

## 📊 Monitoring

### View App Status:

```bash
cf app mobileappsc
```

### View Recent Logs:

```bash
cf logs mobileappsc --recent
```

### Stream Live Logs:

```bash
cf logs mobileappsc
```

---

## 🔐 Security Notes

- OAuth tokens are **cached in memory** (not persisted)
- Destination credentials stored in **VCAP_SERVICES** (secure)
- **No sensitive data** logged to console
- App uses **HTTPS only** (enforced by Cloud Foundry)

---

## 📝 Application Details

|                                    |                                                          |
|------------------------------------|----------------------------------------------------------|
| **App Name**                       | FSM Mobile Integration                                   |
| **Module Name**                    | mobileappsc                                              |
| **Framework**                      | SAP UI5 (Fiori) + Node.js Express                        |
| **UI5 Theme**                      | sap_horizon                                              |
| **UI5 Version**                    | Latest (loaded from CDN)                                 |
| **Deployment Platform**            | SAP Business Technology Platform (Cloud Foundry)         |
| **Development Platform**           | SAP Business Application Studio                          |
| **TypeScript**                     | No                                                       |
| **Target Device**                  | Mobile (FSM Mobile - iOS/Android)                        |

---

## 🚀 Future Enhancements

Planned features (not yet implemented):

- [ ] Activity list selection dialog
- [ ] Service confirmation creation
- [ ] Materials tracking
- [ ] Time entry logging
- [ ] Expense tracking
- [ ] Photo upload
- [ ] Signature capture

---

## 📞 Support

For issues or questions:
1. Check logs: `cf logs mobileappsc --recent`
2. Verify BTP Destination configuration
3. Test in desktop browser first (easier debugging)
4. Contact your SAP BTP administrator

---

## 📄 License

Internal use only - Company proprietary.

---

**Last Updated:** November 2025