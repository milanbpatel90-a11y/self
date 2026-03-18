# Quick Ticket System Troubleshooting Guide

## Overview
This guide helps diagnose and resolve two primary issues with the Quick Ticket system:
1. **Google Sheet Integration**: No data is populated in the connected Google Sheet when tickets are submitted
2. **Email Notifications**: No confirmation or notification emails are being received

## Preliminary Checks
Before diving into specific troubleshooting steps, verify these basic requirements:

### 1. Google Apps Script Deployment
- ✅ **Google Apps Script is deployed as a Web App**
- ✅ **Deployment settings are set to "Anyone" has access**
- ✅ **Script is owned by an active Google Account with necessary permissions**
- ✅ **API URL in `quick-ticket-api.js` matches the deployed Web App URL**

### 2. Google Sheets Configuration
- ✅ **Google Sheet exists and has the correct name ("QuickTickets")**
- ✅ **Sheet has the required headers in row 1**
- ✅ **Script owner has edit permissions to the Google Sheet**
- ✅ **Sheet is not in read-only mode**

### 3. EmailJS Configuration
- ✅ **EmailJS library is properly loaded in HTML files**
- ✅ **EmailJS credentials (publicKey, serviceId, templateId) are configured**
- ✅ **Email template parameters match the data being sent**
- ✅ **Receiver email address is valid and accessible**

---

## Step-by-Step Troubleshooting

### Issue 1: Google Sheet Not Receiving Data

#### Check 1: API Connection Test
Use the [simple-api-test.html](simple-api-test.html) or [detailed-api-test.html](detailed-api-test.html) to test the API connection directly:

1. Open the test file in a browser
2. Click "POST Test" to send a test ticket
3. Check the browser console for errors

