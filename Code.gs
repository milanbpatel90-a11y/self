/**
 * Google Apps Script - Quick Ticket System
 * 
 * INSTRUCTIONS:
 * 1. Open Google Sheets
 * 2. Create a new sheet named "QuickTickets"
 * 3. Add these headers in row 1:
 *    A1: TicketID | B1: Mobile | C1: Product | D1: Language | 
 *    E1: Query | F1: Priority | G1: Status | H1: AssignedTo | I1: CreatedTime
 * 4. Extensions → Apps Script
 * 5. Paste this code
 * 6. Deploy → New Deployment
 * 7. Select: Web app
 * 8. Execute as: Me
 * 9. Who has access: Anyone
 * 10. Deploy and copy the URL
 */

function getOrCreateQuickTicketsSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName("QuickTickets");

  if (!sheet) {
    sheet = spreadsheet.insertSheet("QuickTickets");
    sheet.appendRow([
      "TicketID",
      "Mobile",
      "Product",
      "Language",
      "Query",
      "Priority",
      "Status",
      "AssignedTo",
      "CreatedTime"
    ]);
  }

  return sheet;
}

function buildAssignmentEmailSubject(ticketId) {
  return "Ticket Assigned - " + ticketId;
}

function buildAssignmentEmailBody(data, ticketId) {
  return [
    "Dear Support Team,",
    "",
    "You have been assigned a new trainer quick query.",
    "",
    "TICKET DETAILS",
    "----------------------------------------",
    "Ticket ID: " + ticketId,
    "Assigned To: " + (data.assignedTo || ""),
    "Agent Name: " + (data.assignedAgentName || ""),
    "Mobile Number: " + (data.mobileNumber || data.mobile || ""),
    "Product: " + (data.product || ""),
    "Language: " + (data.language || ""),
    "Priority: " + (data.priority || ""),
    "Status: " + (data.status || "Open"),
    "Created Time: " + (data.timestamp || new Date().toISOString()),
    "",
    "QUERY",
    "----------------------------------------",
    (data.queryDescription || data.query || ""),
    "",
    "Please address this ticket promptly.",
    "",
    "Self-Ticket Support System"
  ].join("\n");
}

function getMailjetConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    apiKey: props.getProperty("MAILJET_API_KEY") || "",
    secretKey: props.getProperty("MAILJET_SECRET_KEY") || "",
    senderEmail: props.getProperty("MAILJET_SENDER_EMAIL") || "",
    senderName: props.getProperty("MAILJET_SENDER_NAME") || "Self-Ticket Support System"
  };
}

function sendMailjetAssignmentEmail(data, ticketId) {
  var config = getMailjetConfig();

  if (!config.apiKey || !config.secretKey || !config.senderEmail) {
    return {
      status: "failed",
      message: "Mailjet is not configured. Set MAILJET_API_KEY, MAILJET_SECRET_KEY, and MAILJET_SENDER_EMAIL in Script Properties."
    };
  }

  var payload = {
    Messages: [
      {
        From: {
          Email: config.senderEmail,
          Name: config.senderName
        },
        To: [
          {
            Email: data.assignedTo,
            Name: data.assignedAgentName || data.assignedTo
          }
        ],
        Subject: buildAssignmentEmailSubject(ticketId),
        TextPart: buildAssignmentEmailBody(data, ticketId)
      }
    ]
  };

  var auth = Utilities.base64Encode(config.apiKey + ":" + config.secretKey);
  var response = UrlFetchApp.fetch("https://api.mailjet.com/v3.1/send", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Basic " + auth
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var statusCode = response.getResponseCode();
  var responseText = response.getContentText();

  if (statusCode >= 200 && statusCode < 300) {
    return {
      status: "sent",
      message: "Assignment email sent via Mailjet."
    };
  }

  return {
    status: "failed",
    message: "Mailjet error " + statusCode + ": " + responseText
  };
}

function sendMailAppAssignmentEmail(data, ticketId) {
  try {
    MailApp.sendEmail({
      to: data.assignedTo,
      subject: buildAssignmentEmailSubject(ticketId),
      body: buildAssignmentEmailBody(data, ticketId)
    });

    return {
      status: "sent",
      message: "Assignment email sent via Google MailApp fallback."
    };
  } catch (error) {
    return {
      status: "failed",
      message: "MailApp fallback failed: " + error.toString()
    };
  }
}

function authorizeMailServices() {
  MailApp.getRemainingDailyQuota();
  UrlFetchApp.fetch("https://example.com", {
    method: "get",
    muteHttpExceptions: true
  });

  return "MailApp and UrlFetchApp authorization completed.";
}

function doPost(e) {
  const sheet = getOrCreateQuickTicketsSheet();

  try {
    const data = JSON.parse(e.postData.contents);
    const ticketId = data.ticketId || "TKT-" + Date.now();
    const rowValues = [
      ticketId,
      data.mobileNumber || data.mobile || "",
      data.product || "",
      data.language || "",
      data.queryDescription || data.query || "",
      data.priority || "Medium",
      data.status || "Open",
      data.assignedTo || "Unassigned",
      data.timestamp || data.createdTime || data.CreatedTime || new Date().toISOString()
    ];

    const lastRow = sheet.getLastRow();
    const idValues = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues() : [];
    const existingRowIndex = idValues.findIndex(function(row) {
      return row[0] === ticketId;
    });

    if (existingRowIndex >= 0) {
      sheet.getRange(existingRowIndex + 2, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    var emailStatus = "skipped";
    var emailMessage = "No assignment email requested.";

    if (data.sendAssignmentEmail === true && data.assignedTo) {
      try {
        var emailResult = sendMailAppAssignmentEmail(data, ticketId);
        emailStatus = emailResult.status;
        emailMessage = emailResult.message;
      } catch (mailError) {
        emailStatus = "failed";
        emailMessage = mailError.toString();
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      ticketId: ticketId,
      assignedTo: data.assignedTo || "Unassigned",
      emailStatus: emailStatus,
      emailMessage: emailMessage
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// For testing - fetch all tickets
function doGet() {
  const sheet = getOrCreateQuickTicketsSheet();
  
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const tickets = data.map(row => {
    let ticket = {};
    headers.forEach((header, index) => {
      ticket[header] = row[index];
    });
    return ticket;
  });
  
  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    tickets: tickets
  })).setMimeType(ContentService.MimeType.JSON);
}
