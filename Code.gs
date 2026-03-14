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

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("QuickTickets");
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Sheet 'QuickTickets' not found"
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    const data = JSON.parse(e.postData.contents);
    
    const ticketId = data.ticketId || "TKT-" + Date.now();
    
    sheet.appendRow([
      ticketId,
      data.mobileNumber || data.mobile || "",
      data.product || "",
      data.language || "",
      data.queryDescription || data.query || "",
      data.priority || "Medium",
      data.status || "Open",
      data.assignedTo || "Unassigned",
      data.timestamp || data.CreatedTime || new Date().toISOString()
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      ticketId: ticketId,
      assignedTo: data.assignedTo
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
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("QuickTickets");
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Sheet not found"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
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
