/**
 * Google Apps Script - Quick Ticket System
 *
 * Sheets used:
 * - QuickTickets
 * - Agents
 */

function createJsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(sheetName, headers) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    var existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    var needsHeaderReset = headers.some(function(header, index) {
      return existingHeaders[index] !== header;
    });

    if (needsHeaderReset) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }

  return sheet;
}

function getOrCreateQuickTicketsSheet() {
  return getOrCreateSheet('QuickTickets', [
    'TicketID',
    'Mobile',
    'Product',
    'Language',
    'Query',
    'Priority',
    'Status',
    'AssignedTo',
    'CreatedTime',
    'CreatorEmail'
  ]);
}

function getOrCreateAgentsSheet() {
  return getOrCreateSheet('Agents', [
    'AgentID',
    'Name',
    'Email',
    'Language',
    'Status',
    'AssignedCount',
    'AddedAt',
    'UpdatedAt',
    'StatusChangedAt',
    'RemovedAt'
  ]);
}

function buildAssignmentEmailSubject(ticketId) {
  return 'Ticket Assigned - ' + ticketId;
}

function buildAssignmentEmailBody(data, ticketId) {
  return [
    'Dear Support Team,',
    '',
    'You have been assigned a new trainer quick query.',
    '',
    'TICKET DETAILS',
    '----------------------------------------',
    'Ticket ID: ' + ticketId,
    'Assigned To: ' + (data.assignedTo || ''),
    'Agent Name: ' + (data.assignedAgentName || ''),
    'Mobile Number: ' + (data.mobileNumber || data.mobile || ''),
    'Product: ' + (data.product || ''),
    'Language: ' + (data.language || ''),
    'Priority: ' + (data.priority || ''),
    'Status: ' + (data.status || 'Open'),
    'Created Time: ' + (data.timestamp || new Date().toISOString()),
    'Creator Email: ' + (data.creatorEmail || ''),
    '',
    'QUERY',
    '----------------------------------------',
    (data.queryDescription || data.query || ''),
    '',
    'Please address this ticket promptly.',
    '',
    'Self-Ticket Support System'
  ].join('\n');
}

function getMailjetConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    apiKey: props.getProperty('MAILJET_API_KEY') || '',
    secretKey: props.getProperty('MAILJET_SECRET_KEY') || '',
    senderEmail: props.getProperty('MAILJET_SENDER_EMAIL') || '',
    senderName: props.getProperty('MAILJET_SENDER_NAME') || 'Self-Ticket Support System'
  };
}

function sendMailjetAssignmentEmail(data, ticketId) {
  var config = getMailjetConfig();

  if (!config.apiKey || !config.secretKey || !config.senderEmail) {
    return {
      status: 'failed',
      message: 'Mailjet is not configured. Set MAILJET_API_KEY, MAILJET_SECRET_KEY, and MAILJET_SENDER_EMAIL in Script Properties.'
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
        Cc: data.creatorEmail ? [
          {
            Email: data.creatorEmail,
            Name: data.creatorEmail
          }
        ] : [],
        Subject: buildAssignmentEmailSubject(ticketId),
        TextPart: buildAssignmentEmailBody(data, ticketId)
      }
    ]
  };

  var auth = Utilities.base64Encode(config.apiKey + ':' + config.secretKey);
  var response = UrlFetchApp.fetch('https://api.mailjet.com/v3.1/send', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Basic ' + auth
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var statusCode = response.getResponseCode();
  var responseText = response.getContentText();

  if (statusCode >= 200 && statusCode < 300) {
    return {
      status: 'sent',
      message: 'Assignment email sent via Mailjet.'
    };
  }

  return {
    status: 'failed',
    message: 'Mailjet error ' + statusCode + ': ' + responseText
  };
}

function sendMailAppAssignmentEmail(data, ticketId) {
  try {
    MailApp.sendEmail({
      to: data.assignedTo,
      cc: data.creatorEmail || '',
      subject: buildAssignmentEmailSubject(ticketId),
      body: buildAssignmentEmailBody(data, ticketId)
    });

    return {
      status: 'sent',
      message: 'Assignment email sent via Google MailApp fallback.'
    };
  } catch (error) {
    return {
      status: 'failed',
      message: 'MailApp fallback failed: ' + error.toString()
    };
  }
}

function authorizeMailServices() {
  MailApp.getRemainingDailyQuota();
  UrlFetchApp.fetch('https://example.com', {
    method: 'get',
    muteHttpExceptions: true
  });

  return 'MailApp and UrlFetchApp authorization completed.';
}

function normalizeAgentPayload(agent) {
  var now = new Date().toISOString();
  var assignedCount = Number(agent.assignedCount);

  return {
    id: String(agent.id || Date.now()),
    name: agent.name || '',
    email: (agent.email || '').toLowerCase(),
    language: agent.language || '',
    status: agent.status === 'Inactive' ? 'Inactive' : 'Active',
    assignedCount: Number.isNaN(assignedCount) ? 0 : assignedCount,
    addedAt: agent.addedAt || now,
    updatedAt: agent.updatedAt || now,
    statusChangedAt: agent.statusChangedAt || '',
    removedAt: agent.removedAt || ''
  };
}

function findAgentRowIndex(sheet, agent) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return -1;
  }

  var values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  var targetId = String(agent.id || '');
  var targetEmail = String(agent.email || '').toLowerCase();

  for (var i = 0; i < values.length; i++) {
    var rowId = String(values[i][0] || '');
    var rowEmail = String(values[i][2] || '').toLowerCase();

    if ((targetId && rowId === targetId) || (targetEmail && rowEmail === targetEmail)) {
      return i + 2;
    }
  }

  return -1;
}

function upsertAgent(agentInput) {
  var sheet = getOrCreateAgentsSheet();
  var agent = normalizeAgentPayload(agentInput || {});
  var rowValues = [[
    agent.id,
    agent.name,
    agent.email,
    agent.language,
    agent.status,
    agent.assignedCount,
    agent.addedAt,
    agent.updatedAt,
    agent.statusChangedAt,
    agent.removedAt
  ]];
  var rowIndex = findAgentRowIndex(sheet, agent);

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues[0].length).setValues(rowValues);
  } else {
    sheet.appendRow(rowValues[0]);
  }

  return agent;
}

function deleteAgentRecord(agentInput) {
  var sheet = getOrCreateAgentsSheet();
  var agent = normalizeAgentPayload(agentInput || {});
  var rowIndex = findAgentRowIndex(sheet, agent);

  if (rowIndex > 0) {
    sheet.deleteRow(rowIndex);
  }

  return {
    id: agent.id,
    email: agent.email,
    deleted: rowIndex > 0
  };
}

function listAgents() {
  var sheet = getOrCreateAgentsSheet();
  var data = sheet.getDataRange().getValues();

  if (data.length <= 1) {
    return [];
  }

  var headers = data.shift();
  return data
    .filter(function(row) {
      return row[0] || row[2];
    })
    .map(function(row) {
      var item = {};

      headers.forEach(function(header, index) {
        item[header] = row[index];
      });

      return {
        id: item.AgentID,
        name: item.Name || '',
        email: item.Email || '',
        language: item.Language || '',
        status: item.Status || 'Active',
        assignedCount: Number(item.AssignedCount) || 0,
        addedAt: item.AddedAt || '',
        updatedAt: item.UpdatedAt || '',
        statusChangedAt: item.StatusChangedAt || '',
        removedAt: item.RemovedAt || ''
      };
    });
}

function handleTicketPost(data) {
  var sheet = getOrCreateQuickTicketsSheet();
  var ticketId = data.ticketId || 'TKT-' + Date.now();
  var rowValues = [
    ticketId,
    data.mobileNumber || data.mobile || '',
    data.product || '',
    data.language || '',
    data.queryDescription || data.query || '',
    data.priority || 'Medium',
    data.status || 'Open',
    data.assignedTo || 'Unassigned',
    data.timestamp || data.createdTime || data.CreatedTime || new Date().toISOString(),
    data.creatorEmail || ''
  ];

  var lastRow = sheet.getLastRow();
  var idValues = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues() : [];
  var existingRowIndex = idValues.findIndex(function(row) {
    return row[0] === ticketId;
  });

  if (existingRowIndex >= 0) {
    sheet.getRange(existingRowIndex + 2, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  var emailStatus = 'skipped';
  var emailMessage = 'No assignment email requested.';

  if (data.sendAssignmentEmail === true && data.assignedTo) {
    try {
      var emailResult = sendMailAppAssignmentEmail(data, ticketId);
      emailStatus = emailResult.status;
      emailMessage = emailResult.message;
    } catch (mailError) {
      emailStatus = 'failed';
      emailMessage = mailError.toString();
    }
  }

  return createJsonResponse({
    status: 'success',
    ticketId: ticketId,
    assignedTo: data.assignedTo || 'Unassigned',
    emailStatus: emailStatus,
    emailMessage: emailMessage
  });
}

function handleAgentPost(data) {
  var action = data.action || 'upsert';

  if (action === 'delete') {
    return createJsonResponse({
      status: 'success',
      action: action,
      agent: deleteAgentRecord(data.agent || {})
    });
  }

  return createJsonResponse({
    status: 'success',
    action: 'upsert',
    agent: upsertAgent(data.agent || {})
  });
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents || '{}');

    if (data.resource === 'agents') {
      return handleAgentPost(data);
    }

    return handleTicketPost(data);
  } catch (error) {
    return createJsonResponse({
      status: 'error',
      message: error.toString()
    });
  }
}

function doGet(e) {
  var resource = e && e.parameter ? e.parameter.resource : '';

  if (resource === 'agents') {
    return createJsonResponse({
      status: 'success',
      agents: listAgents()
    });
  }

  var sheet = getOrCreateQuickTicketsSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data.shift();

  var tickets = data.map(function(row) {
    var ticket = {};
    headers.forEach(function(header, index) {
      ticket[header] = row[index];
    });
    return ticket;
  });

  return createJsonResponse({
    status: 'success',
    tickets: tickets
  });
}
