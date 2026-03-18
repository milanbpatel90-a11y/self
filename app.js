// ===== Self-Ticket Dashboard Application =====

const DB_KEYS = {
  TICKETS: 'selfTicket_tickets',
  TRAINERS: 'selfTicket_trainers',
  TICKET_COUNTER: 'selfTicket_counter',
  ASSIGNMENT_HISTORY: 'selfTicket_assignment_history',
  AGENT_ROTATION: 'selfTicket_agent_rotation',
  AVAILABLE_AGENTS: 'selfTicket_available_agents',
  GOOGLE_SCRIPT_URL: 'selfTicket_google_script_url',
  LAST_QUICK_QUERY_RESPONSE: 'selfTicket_last_quick_query_response'
};

const DEFAULT_GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwbDf1n2vQ57ybTAt2QAvTJFHhr4XCmT0DTejbDYKBvrmt8Tz9ZNYAsjnIY6AMGB6A/exec';
const LEGACY_GOOGLE_SCRIPT_URLS = [
  'https://script.google.com/macros/s/AKfycbyqC6442w0hqOQga0vTOeO7BnoShm4j7DEPg-oxoo3lHtkdMEk03yHGePQbz7fkv_M/exec',
  'https://script.google.com/macros/s/AKfycbyM_0PLWNX4OupfzWS5bONAuHVZNBUapIz-DSti9zNa51IpFKD-WnnX_zh9Z2lqf8A/exec',
  'https://script.google.com/macros/s/AKfycbwC-YDLimZYxK51V_HqFtk32V64mGt6rVEE9IMUvqImsh9SQHEMlmUZfYhAV1nLaEU/exec'
];

let ticketsArray = [];
let trainersArray = [
  { id: 1, name: 'Alice Johnson', email: 'alice@company.com', status: 'Available', load: 0 },
  { id: 2, name: 'Bob Smith', email: 'bob@company.com', status: 'Available', load: 0 },
  { id: 3, name: 'Carol Williams', email: 'carol@company.com', status: 'Available', load: 0 }
];

// ===== Round-Robin Agent System =====
// Available agents for round-robin assignment
let availableAgents = [];

// Current position in the rotation, tracked per language pool
let rotationState = {};

// Assignment history for reporting
let assignmentHistory = [];

// Initialize the round-robin system
function initializeRoundRobinSystem() {
  // Load available agents from localStorage or use defaults
  const savedAgents = localStorage.getItem(DB_KEYS.AVAILABLE_AGENTS);
  if (savedAgents) {
    availableAgents = JSON.parse(savedAgents);
  } else {
    // Default agents - these will be replaced when user adds their own
    availableAgents = [];
    saveAvailableAgents();
  }

  loadRotationState();

  // Load assignment history
  const savedHistory = localStorage.getItem(DB_KEYS.ASSIGNMENT_HISTORY);
  if (savedHistory) {
    assignmentHistory = JSON.parse(savedHistory);
  }

  console.log('âœ… Round-Robin System initialized with', availableAgents.length, 'agents');
  console.log('ðŸ“‹ Current rotation state:', rotationState);
}

// Save available agents to localStorage
function saveAvailableAgents() {
  localStorage.setItem(DB_KEYS.AVAILABLE_AGENTS, JSON.stringify(availableAgents));
}

function loadRotationState() {
  const savedRotation = localStorage.getItem(DB_KEYS.AGENT_ROTATION);
  if (!savedRotation) {
    rotationState = {};
    return;
  }

  try {
    const parsed = JSON.parse(savedRotation);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      rotationState = parsed;
      return;
    }
  } catch (error) {
    const legacyIndex = parseInt(savedRotation, 10);
    if (!Number.isNaN(legacyIndex)) {
      rotationState = { all: legacyIndex };
      return;
    }
  }

  rotationState = {};
}

// Save rotation state to localStorage
function saveRotationState() {
  localStorage.setItem(DB_KEYS.AGENT_ROTATION, JSON.stringify(rotationState));
}

// Save assignment history to localStorage
function saveAssignmentHistory() {
  localStorage.setItem(DB_KEYS.ASSIGNMENT_HISTORY, JSON.stringify(assignmentHistory));
}

function normalizeLanguageList(value) {
  if (!value) return [];
  return value
    .split(/[,&/|]+/)
    .map(item => normalizeLanguageKey(item))
    .filter(Boolean);
}

function normalizeLanguageKey(value) {
  if (!value) return '';

  const normalized = value.toString().trim().toLowerCase();
  const aliases = {
    en: 'english',
    eng: 'english',
    english: 'english',
    hi: 'hindi',
    hindi: 'hindi',
    ta: 'tamil',
    tamil: 'tamil',
    bn: 'bengali',
    bengali: 'bengali',
    bangla: 'bengali',
    gu: 'gujarati',
    gujarati: 'gujarati',
    mr: 'marathi',
    marathi: 'marathi',
    te: 'telugu',
    telugu: 'telugu',
    kn: 'kannada',
    kannada: 'kannada',
    ml: 'malayalam',
    malayalam: 'malayalam',
    pa: 'punjabi',
    punjabi: 'punjabi'
  };

  return aliases[normalized] || normalized;
}

function agentSupportsLanguage(agent, language) {
  const normalizedLanguage = normalizeLanguageKey(language);
  if (!normalizedLanguage) return true;
  const agentLanguages = normalizeLanguageList(agent.language || '');
  if (agentLanguages.length === 0) return false;
  return agentLanguages.includes(normalizedLanguage);
}

// Get the next agent in round-robin rotation
function getNextAgent(preferredLanguage = '') {
  // Reload agents from localStorage to ensure we have latest
  const savedAgents = localStorage.getItem(DB_KEYS.AVAILABLE_AGENTS);
  if (savedAgents) {
    availableAgents = JSON.parse(savedAgents);
  }
  
  console.log('Available agents:', availableAgents);
  loadRotationState();
  
  // Filter only active agents
  const activeAgents = availableAgents.filter(agent => agent.status === 'Active');
  
  if (activeAgents.length === 0) {
    console.warn('âš ï¸ No active agents available for assignment');
    console.warn('Available agents count:', availableAgents.length);
    return null;
  }

  const normalizedLanguage = normalizeLanguageKey(preferredLanguage);
  const rotationPool = normalizedLanguage
    ? activeAgents.filter(agent => agentSupportsLanguage(agent, normalizedLanguage))
    : activeAgents;

  if (rotationPool.length === 0) {
    console.warn('Ã¢Å¡Â Ã¯Â¸Â No active agents available for language:', preferredLanguage);
    return null;
  }

  const rotationKey = normalizedLanguage || 'all';
  const currentIndex = rotationState[rotationKey] || 0;

  // Get the next agent in rotation
  const agent = rotationPool[currentIndex % rotationPool.length];
  
  // Increment rotation index for next assignment
  rotationState[rotationKey] = (currentIndex + 1) % rotationPool.length;
  saveRotationState();

  return agent;
}

// Add a new agent to the round-robin pool
function addAgent(name, email, language) {
  const newAgent = {
    id: Date.now(),
    email: email,
    name: name,
    language: language,
    status: 'Active',
    assignedCount: 0,
    addedAt: new Date().toISOString()
  };
  availableAgents.push(newAgent);
  saveAvailableAgents();
  console.log('âœ… Agent added:', newAgent);
  return newAgent;
}

// Remove an agent from the round-robin pool (set as inactive)
function removeAgent(agentId) {
  const agent = availableAgents.find(a => a.id === agentId);
  if (agent) {
    agent.status = 'Inactive';
    agent.removedAt = new Date().toISOString();
    saveAvailableAgents();
    console.log('âœ… Agent removed:', agent.email);
    return true;
  }
  return false;
}

// Set agent availability status
function setAgentStatus(agentId, status) {
  const agent = availableAgents.find(a => a.id === agentId);
  if (agent) {
    agent.status = status;
    agent.statusChangedAt = new Date().toISOString();
    saveAvailableAgents();
    console.log('âœ… Agent status changed:', agent.email, '->', status);
    return true;
  }
  return false;
}

// Reorder agents in rotation (move agent to front)
function reorderRotation(agentId) {
  const agentIndex = availableAgents.findIndex(a => a.id === agentId);
  if (agentIndex > 0) {
    const agent = availableAgents.splice(agentIndex, 1)[0];
    availableAgents.unshift(agent);
    rotationState = {};
    saveAvailableAgents();
    saveRotationState();
    console.log('âœ… Rotation reordered, agent moved to front:', agent.email);
    return true;
  }
  return false;
}

// Reset the rotation to start from the beginning
function resetRotation() {
  rotationState = {};
  saveRotationState();
  console.log('âœ… Rotation reset to beginning');
}

// Record an assignment in history
function recordAssignment(ticket, agent) {
  const record = {
    id: Date.now(),
    ticketId: ticket.id,
    ticketDetails: {
      mobileNumber: ticket.mobileNumber,
      product: ticket.product,
      priority: ticket.priority,
      queryDescription: ticket.queryDescription
    },
    agentEmail: agent.email,
    agentName: agent.name,
    agentLanguage: agent.language || '',
    agentId: agent.id,
    assignedAt: new Date().toISOString(),
    method: 'Round-Robin'
  };
  assignmentHistory.push(record);
  saveAssignmentHistory();

  // Update agent's assigned count
  agent.assignedCount++;
  saveAvailableAgents();

  console.log('âœ… Assignment recorded:', record);
  return record;
}

// Get assignment history with optional filters
function getAssignmentHistory(filters = {}) {
  let history = [...assignmentHistory];

  if (filters.agentEmail) {
    history = history.filter(r => r.agentEmail === filters.agentEmail);
  }

  if (filters.dateFrom) {
    history = history.filter(r => new Date(r.assignedAt) >= new Date(filters.dateFrom));
  }

  if (filters.dateTo) {
    history = history.filter(r => new Date(r.assignedAt) <= new Date(filters.dateTo));
  }

  // Sort by most recent first
  history.sort((a, b) => new Date(b.assignedAt) - new Date(a.assignedAt));

  return history;
}

// Get agent statistics
function getAgentStats() {
  return availableAgents.map(agent => ({
    ...agent,
    totalAssigned: agent.assignedCount || 0,
    isActive: agent.status === 'Active'
  }));
}

// Auto-assign ticket using round-robin
function autoAssignTicket(ticket) {
  const agent = getNextAgent(ticket.language || '');
  
  if (!agent) {
    console.error('âŒ Cannot assign ticket - no active agents available for language:', ticket.language || 'Any');
    return null;
  }

  // Update ticket with assignment
  ticket.assignedTrainer = agent.email;
  ticket.assignedAgentName = agent.name;
  ticket.assignedAgentId = agent.id;
  ticket.assignedAt = new Date().toISOString();
  ticket.assignmentMethod = 'Round-Robin';

  // Record the assignment
  recordAssignment(ticket, agent);

  console.log('âœ… Ticket auto-assigned:', ticket.id, '->', agent.email);
  return agent;
}

// ===== Initialize Application =====
document.addEventListener('DOMContentLoaded', () => {
  loadFromLocalStorage();
  
  // Initialize round-robin system
  initializeRoundRobinSystem();
  
  // Update agent list in UI
  updateAvailableAgentsList();
  renderQuickQueryResponse();
  
  // Create a test ticket creation button for debugging
  const testButton = document.createElement('button');
  testButton.textContent = 'Create Test Ticket';
  testButton.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 1000; background: red; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;';
  testButton.addEventListener('click', () => {
    ticketsArray = [
      {
        id: 'TKT-1001',
        timestamp: new Date().toISOString(),
        mobileNumber: '1234567890',
        product: 'Test Product',
        queryDescription: 'This is a test ticket for email functionality',
        priority: 'High',
        category: 'Test',
        status: 'Open',
        assignedTrainer: null
      }
    ];
    updateDashboardQueue();
    console.log('âœ… Test ticket created');
    showToast('âœ… Test ticket created!', 'success');
  });
  document.body.appendChild(testButton);

  updateDashboardQueue();
  updateArchiveList();
  updateTrainerList();
  setupQuickTicketForm();
  setupGoogleSheetsConfigForm();
  setupEmailJSConfigForm();
  setupAgentManagementForm();
  updateCloudSyncUI();
  checkEmailJSConfiguration();
  
  // Setup tab switching
  setupTabSwitching();
  
  // Initialize tab display
  const defaultTab = document.querySelector('.tab-btn[data-tab="queue"]');
  if (defaultTab) {
    const tabId = defaultTab.getAttribute('data-tab');
    document.querySelectorAll('.tab-content').forEach(content => {
      content.style.display = 'none';
      content.classList.remove('active');
    });
    const activeContent = document.getElementById(tabId);
    if (activeContent) {
      activeContent.style.display = 'block';
      activeContent.classList.add('active');
    }
  }

  // Add test ticket creation function to window for testing purposes
  window.createTestTicket = function() {
    const testTicket = {
      id: 'TKT-1001',
      timestamp: new Date().toISOString(),
      mobileNumber: '1234567890',
      product: 'Test Product',
      language: 'English',
      queryDescription: 'This is a test ticket for email functionality',
      priority: 'High',
      category: 'Test',
      status: 'Open',
      assignedTrainer: null
    };

    ticketsArray = [testTicket]; // Replace any existing tickets
    updateDashboardQueue();
    console.log('âœ… Test ticket created');
    showToast('âœ… Test ticket created!', 'success');
  };

   // Auto-refresh queue every 2 seconds (disabled for debugging)
  /*
  setInterval(() => {
    loadFromLocalStorage();
    updateDashboardQueue();
  }, 2000);
  */

  // Refresh when page becomes visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      console.log('ðŸ“Š Dashboard is now visible - refreshing');
      loadFromLocalStorage();
      updateDashboardQueue();
      showToast('âœ… Dashboard synced', 'success');
    }
  });
});

// ===== Local Storage Functions =====
function saveToLocalStorage() {
  localStorage.setItem(DB_KEYS.TICKETS, JSON.stringify(ticketsArray));
  localStorage.setItem(DB_KEYS.TRAINERS, JSON.stringify(trainersArray));
}

function loadFromLocalStorage() {
  const savedTickets = localStorage.getItem(DB_KEYS.TICKETS);
  const savedTrainers = localStorage.getItem(DB_KEYS.TRAINERS);

  // Load tickets from localStorage
  if (savedTickets) {
    ticketsArray = JSON.parse(savedTickets);
    console.log('âœ… Loaded ' + ticketsArray.length + ' tickets from localStorage');
  } else {
    ticketsArray = [];
    console.log('âš ï¸ No tickets in localStorage');
  }

  if (savedTrainers) {
    trainersArray = JSON.parse(savedTrainers);
  } else {
    trainersArray = [
      { id: 1, name: 'Alice Johnson', status: 'Available', load: 0 },
      { id: 2, name: 'Bob Smith', status: 'Available', load: 0 },
      { id: 3, name: 'Carol Williams', status: 'Available', load: 0 }
    ];
  }
}

// ===== Create Ticket Row =====
function createTicketRow(ticket) {
  const priorityColors = {
    'High': '#ef4444',
    'Medium': '#f59e0b',
    'Low': '#10b981'
  };

  const priorityColor = priorityColors[ticket.priority] || '#6b7280';
  const timestamp = new Date(ticket.timestamp);
  const timeAgo = getTimeAgo(timestamp);

  // Show assignment info if ticket is assigned
  const assignmentInfo = ticket.assignedTrainer ? `
    <div style="margin-top: 0.5rem; padding: 0.5rem; background: #d1fae5; border-radius: 4px; font-size: 0.85rem; color: #065f46;">
      <i class="fas fa-user-check"></i> Assigned to: ${escapeHtml(ticket.assignedTrainer)}
      ${ticket.assignmentMethod ? `<span style="color: #6b7280;">(${ticket.assignmentMethod})</span>` : ''}
    </div>
  ` : `
    <div style="margin-top: 0.5rem; padding: 0.5rem; background: #fef3c7; border-radius: 4px; font-size: 0.85rem; color: #92400e;">
      <i class="fas fa-clock"></i> Awaiting assignment
    </div>
  `;

  return `
    <div class="ticket-card" style="border: 1px solid ${priorityColor}; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; background-color: #f9fafb;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: bold; color: ${priorityColor}; font-size: 1.2rem;">${ticket.priority} Priority</div>
          <div style="font-size: 0.9rem; color: #6b7280;">${timeAgo}</div>
        </div>
        <button class="claim-btn" onclick="claimTicket('${ticket.id}')" style="background: #4f46e5; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
          Claim/Assign
        </button>
      </div>
      <div style="margin-top: 1rem;">
        <div style="font-weight: 600; font-size: 1rem;">Mobile: ${escapeHtml(ticket.mobileNumber)}</div>
        <div style="font-size: 0.9rem; color: #374151;">Product: ${escapeHtml(ticket.product)}</div>
        ${ticket.language ? `<div style="font-size: 0.9rem; color: #374151;"><i class="fas fa-language"></i> Language: ${escapeHtml(ticket.language)}</div>` : ''}
        <div style="margin-top: 0.5rem; color: #374151;">Query: ${escapeHtml(ticket.queryDescription)}</div>
        ${assignmentInfo}
      </div>
    </div>
  `;
}

// ===== Mobile Number Validation =====
function validateMobileNumber(mobileNumber) {
  // Remove any whitespace or special characters
  const cleaned = mobileNumber.replace(/\s/g, '');
  
  // Check if empty
  if (!cleaned || cleaned.length === 0) {
    return { valid: false, message: 'Mobile number is required' };
  }
  
  // Check if contains only digits
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, message: 'Mobile number must contain only digits (0-9)' };
  }
  
  // Check if exactly 10 digits
  if (cleaned.length !== 10) {
    return { valid: false, message: 'Mobile number must be exactly 10 digits' };
  }
  
  // Check if first digit is not 0 (no leading zeros)
  if (cleaned.charAt(0) === '0') {
    return { valid: false, message: 'Mobile number cannot start with 0' };
  }
  
  // Check if first digit is valid (1-9 for Indian mobile numbers)
  const firstDigit = parseInt(cleaned.charAt(0), 10);
  if (firstDigit < 1 || firstDigit > 9) {
    return { valid: false, message: 'Mobile number must start with a digit between 1-9' };
  }
  
  // All checks passed
  return { valid: true, message: 'Valid', cleanedNumber: cleaned };
}

function validateEmailAddress(email) {
  const trimmed = (email || '').trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!trimmed) {
    return { valid: false, message: 'Email address is required' };
  }

  if (!emailRegex.test(trimmed)) {
    return { valid: false, message: 'Please enter a valid email address' };
  }

  return { valid: true, email: trimmed };
}

// ===== Setup Quick Ticket Form =====
function setupQuickTicketForm() {
  const form = document.getElementById('quickTicketForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const mobileNumber = document.getElementById('mobile').value.trim();
    const creatorEmail = document.getElementById('creatorEmail')?.value.trim() || '';
    const product = document.getElementById('product').value;
    const language = document.getElementById('language').value.trim();
    const queryDescription = document.getElementById('queries').value.trim();
    const priority = document.querySelector('input[name="priority"]:checked').value;

    // Validate mobile number
    const mobileValidation = validateMobileNumber(mobileNumber);
    if (!mobileValidation.valid) {
      showToast('âŒ ' + mobileValidation.message, 'error');
      return;
    }

    const emailValidation = validateEmailAddress(creatorEmail);
    if (!emailValidation.valid) {
      showToast('âŒ ' + emailValidation.message, 'error');
      return;
    }

    if (!product || !language || !queryDescription || !priority) {
      showToast('âŒ Please fill in all fields', 'error');
      return;
    }

    const newTicket = {
      id: generateTicketId(),
      timestamp: new Date().toISOString(),
      mobileNumber: mobileValidation.cleanedNumber,
      creatorEmail: emailValidation.email,
      product: product,
      language: language,
      queryDescription: queryDescription,
      priority: priority,
      category: product,
      status: 'Open',
      assignedTrainer: null
    };

    // Auto-assign ticket using round-robin
    const assignedAgent = autoAssignTicket(newTicket);
    let emailResult = { success: false, message: 'No assignment email requested.' };
    
    if (assignedAgent) {
      emailResult = { success: true, message: 'Assignment email requested via Google Apps Script.' };
      showToast('âœ… Ticket submitted and auto-assigned to ' + assignedAgent.email, 'success');
    } else {
      showToast('âš ï¸ Ticket submitted but no agents available for assignment', 'error');
    }

    ticketsArray.push(newTicket);
    form.reset();
    updateDashboardQueue();
    saveToLocalStorage();

    const cloudResult = await submitTicketToGoogleSheet(newTicket);
    if (cloudResult.success) {
      showCloudSyncStatus('Cloud sync is active. Ticket saved to Google Sheets.', 'success');
    } else if (getGoogleScriptUrl()) {
      showCloudSyncStatus(cloudResult.message, 'error');
    }

    saveQuickQueryResponse({
      ticketId: newTicket.id,
      mobileNumber: newTicket.mobileNumber,
      product: newTicket.product,
      language: newTicket.language,
      priority: newTicket.priority,
      queryDescription: newTicket.queryDescription,
      assignedAgentName: assignedAgent ? assignedAgent.name : null,
      assignedTrainer: assignedAgent ? assignedAgent.email : null,
      assignmentMethod: assignedAgent ? 'Round-Robin' : 'Unassigned',
      cloudStatus: cloudResult.success ? 'success' : 'error',
      cloudMessage: cloudResult.message,
      emailStatus: emailResult.success ? 'success' : 'error',
      emailMessage: emailResult.message,
      submittedAt: newTicket.timestamp
    });
  });
}

function getGoogleScriptUrl() {
  const savedUrl = localStorage.getItem(DB_KEYS.GOOGLE_SCRIPT_URL);
  if (savedUrl && LEGACY_GOOGLE_SCRIPT_URLS.includes(savedUrl)) {
    localStorage.setItem(DB_KEYS.GOOGLE_SCRIPT_URL, DEFAULT_GOOGLE_SCRIPT_URL);
    return DEFAULT_GOOGLE_SCRIPT_URL;
  }
  return savedUrl || DEFAULT_GOOGLE_SCRIPT_URL;
}

function saveQuickQueryResponse(response) {
  localStorage.setItem(DB_KEYS.LAST_QUICK_QUERY_RESPONSE, JSON.stringify(response));
  renderQuickQueryResponse();
}

function renderQuickQueryResponse() {
  const container = document.getElementById('quickQueryResponse');
  if (!container) return;

  const savedResponse = localStorage.getItem(DB_KEYS.LAST_QUICK_QUERY_RESPONSE);
  if (!savedResponse) {
    container.innerHTML = `
      <div class="response-badge"><i class="fas fa-clock"></i> Waiting for first submission</div>
      <div class="helper-text">Submit a trainer quick query to see the response received here.</div>
    `;
    return;
  }

  const response = JSON.parse(savedResponse);
  const syncOkay = response.cloudStatus === 'success';

  container.innerHTML = `
    <div class="response-badge" style="background:${syncOkay ? '#dcfce7' : '#fee2e2'}; color:${syncOkay ? '#166534' : '#991b1b'};">
      <i class="fas ${syncOkay ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
      ${syncOkay ? 'Response received successfully' : 'Response received with sync issue'}
    </div>
    <div class="response-grid">
      <div class="response-item">
        <span>Ticket ID</span>
        <strong>${escapeHtml(response.ticketId || '-')}</strong>
      </div>
      <div class="response-item">
        <span>Submitted At</span>
        <strong>${response.submittedAt ? new Date(response.submittedAt).toLocaleString() : '-'}</strong>
      </div>
      <div class="response-item">
        <span>Assigned Agent</span>
        <strong>${escapeHtml(response.assignedAgentName || 'No active agent')}</strong>
      </div>
      <div class="response-item">
        <span>Assigned Email</span>
        <strong>${escapeHtml(response.assignedTrainer || 'Unassigned')}</strong>
      </div>
      <div class="response-item">
        <span>Product / Priority</span>
        <strong>${escapeHtml(response.product || '-')} / ${escapeHtml(response.priority || '-')}</strong>
      </div>
      <div class="response-item">
        <span>Language / Mobile</span>
        <strong>${escapeHtml(response.language || '-')} / ${escapeHtml(response.mobileNumber || '-')}</strong>
      </div>
    </div>
    <div class="response-item">
      <span>Query</span>
      <strong>${escapeHtml(response.queryDescription || '-')}</strong>
    </div>
    <div class="response-item">
      <span>Google Sheets Response</span>
      <strong>${escapeHtml(response.cloudMessage || 'No response message')}</strong>
    </div>
    <div class="response-item">
      <span>Email Response</span>
      <strong>${escapeHtml(response.emailMessage || 'No email response captured')}</strong>
    </div>
  `;
}

function showCloudSyncStatus(message, type = 'success') {
  const statusDiv = document.getElementById('cloudSyncStatus');
  if (!statusDiv) return;

  statusDiv.style.display = 'block';
  statusDiv.style.background = type === 'error' ? '#fee2e2' : '#dbeafe';
  statusDiv.style.borderLeft = type === 'error' ? '4px solid #ef4444' : '4px solid #3b82f6';
  statusDiv.style.color = type === 'error' ? '#991b1b' : '#1d4ed8';
  statusDiv.innerHTML = `${type === 'error' ? '<i class="fas fa-exclamation-circle"></i>' : '<i class="fas fa-cloud-check"></i>'} ${escapeHtml(message)}`;
}

function updateCloudSyncUI() {
  const input = document.getElementById('googleScriptUrl');
  const syncButton = document.getElementById('googleSyncBtn');
  const scriptUrl = getGoogleScriptUrl();

  if (input) {
    input.value = scriptUrl;
  }

  if (syncButton) {
    syncButton.style.display = scriptUrl ? 'inline-flex' : 'none';
  }

  if (scriptUrl) {
    showCloudSyncStatus('Google Sheets cloud sync is configured: ' + scriptUrl, 'success');
  }
}

function setupGoogleSheetsConfigForm() {
  const form = document.getElementById('googleSheetsConfigForm');
  if (!form) return;

  const input = document.getElementById('googleScriptUrl');
  if (input) {
    input.value = getGoogleScriptUrl();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const scriptUrl = input ? input.value.trim() : '';
    if (!scriptUrl) {
      showCloudSyncStatus('Enter your deployed Google Apps Script web app URL.', 'error');
      return;
    }

    localStorage.setItem(DB_KEYS.GOOGLE_SCRIPT_URL, scriptUrl);
    updateCloudSyncUI();
    showToast('Cloud sync enabled', 'success');
  });
}

function buildGoogleSheetPayload(ticket) {
  return {
    ticketId: ticket.id,
    mobile: ticket.mobileNumber,
    creatorEmail: ticket.creatorEmail || '',
    product: ticket.product,
    language: ticket.language || '',
    query: ticket.queryDescription,
    priority: ticket.priority,
    status: ticket.status || 'Open',
    assignedTo: ticket.assignedTrainer || 'Unassigned',
    assignedAgentName: ticket.assignedAgentName || '',
    sendAssignmentEmail: Boolean(ticket.assignedTrainer),
    timestamp: ticket.timestamp || new Date().toISOString()
  };
}

async function submitTicketToGoogleSheet(ticket) {
  const scriptUrl = getGoogleScriptUrl();
  if (!scriptUrl) {
    return { success: false, message: 'Cloud sync URL is not configured.' };
  }

  try {
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(buildGoogleSheetPayload(ticket))
    });

    if (!response.ok) {
      return { success: false, message: `Cloud sync failed with status ${response.status}.` };
    }

    const result = await response.json();
    if (result.status !== 'success') {
      return { success: false, message: result.message || 'Cloud sync failed.' };
    }

    const messageParts = ['Ticket synced to Google Sheets.'];
    if (typeof result.emailStatus === 'string') {
      messageParts.push(`Email: ${result.emailStatus}`);
    }
    if (result.emailMessage) {
      messageParts.push(result.emailMessage);
    }

    return { success: true, message: messageParts.join(' ') };
  } catch (error) {
    console.error('Cloud sync error:', error);
    return { success: false, message: 'Cloud sync failed. Check the Apps Script URL and deployment access.' };
  }
}

async function syncAllTicketsToGoogleSheet() {
  const scriptUrl = getGoogleScriptUrl();
  if (!scriptUrl) {
    showCloudSyncStatus('Set the Google Apps Script URL first.', 'error');
    return;
  }

  const savedTickets = localStorage.getItem(DB_KEYS.TICKETS);
  const tickets = savedTickets ? JSON.parse(savedTickets) : [];

  if (tickets.length === 0) {
    showCloudSyncStatus('There are no local tickets to sync.', 'error');
    return;
  }

  let syncedCount = 0;
  for (const ticket of tickets) {
    const result = await submitTicketToGoogleSheet(ticket);
    if (result.success) {
      syncedCount++;
    }
  }

  if (syncedCount === tickets.length) {
    showCloudSyncStatus(`Synced ${syncedCount} tickets to Google Sheets.`, 'success');
    showToast('All tickets synced to cloud', 'success');
    return;
  }

  showCloudSyncStatus(`Synced ${syncedCount} of ${tickets.length} tickets.`, 'error');
}

// ===== Setup Agent Management Form =====
function setupAgentManagementForm() {
  const form = document.getElementById('addAgentForm');
  if (!form) return;
  const cancelButton = document.getElementById('agentFormCancel');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const editId = document.getElementById('agentEditId').value.trim();
    const name = document.getElementById('agentName').value.trim();
    const email = document.getElementById('agentEmail').value.trim();
    const language = document.getElementById('agentLanguage').value.trim();

    const isSaved = editId
      ? updateExistingAgent(Number(editId), name, email, language)
      : addNewAgent(name, email, language);

    if (isSaved) {
      resetAgentForm();
    }
  });

  if (cancelButton) {
    cancelButton.addEventListener('click', resetAgentForm);
  }
}

// ===== Update Dashboard Queue =====
function updateDashboardQueue() {
  const queueContainer = document.getElementById('ticketQueue');
  const emptyState = document.getElementById('emptyQueue');

  if (!queueContainer || !emptyState) return;

  // Reload tickets from localStorage to get latest data
  const savedTickets = localStorage.getItem(DB_KEYS.TICKETS);
  if (savedTickets) {
    ticketsArray = JSON.parse(savedTickets);
  }

  // Only show Open tickets in queue
  const openTickets = ticketsArray.filter(ticket => ticket.status === 'Open');

  const priorityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
  openTickets.sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  queueContainer.innerHTML = '';

  if (openTickets.length === 0) {
    emptyState.style.display = 'block';
    updateQueueBadge();
    return;
  }

  emptyState.style.display = 'none';

  const rows = Math.ceil(openTickets.length / 4);
  for (let i = 0; i < rows; i++) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.marginBottom = '1rem';

    const start = i * 4;
    const end = start + 4;
    const ticketsInRow = openTickets.slice(start, end);

    ticketsInRow.forEach(ticket => {
      const ticketHTML = createTicketRow(ticket);
      const ticketElement = document.createElement('div');
      ticketElement.innerHTML = ticketHTML;
      ticketElement.style.flex = '1';
      ticketElement.style.margin = '0 0.5rem';
      row.appendChild(ticketElement);
    });

    queueContainer.appendChild(row);
  }

  updateQueueBadge();
  updateLanguageFilter();
}

// ===== Filter Tickets =====
function filterTickets() {
  const queueContainer = document.getElementById('ticketQueue');
  const emptyState = document.getElementById('emptyQueue');
  
  if (!queueContainer || !emptyState) return;

  // Reload tickets from localStorage
  const savedTickets = localStorage.getItem(DB_KEYS.TICKETS);
  if (savedTickets) {
    ticketsArray = JSON.parse(savedTickets);
  }

  // Get filter values
  const urgencyFilter = document.getElementById('urgencyFilter')?.value || 'all';
  const categoryFilter = document.getElementById('categoryFilter')?.value || 'all';
  const languageFilter = document.getElementById('languageFilter')?.value || 'all';

  // Filter open tickets and apply all filters
  let filteredTickets = ticketsArray.filter(ticket => ticket.status === 'Open');

  if (urgencyFilter !== 'all') {
    filteredTickets = filteredTickets.filter(ticket => ticket.priority === urgencyFilter);
  }

  if (categoryFilter !== 'all') {
    filteredTickets = filteredTickets.filter(ticket => ticket.category === categoryFilter);
  }

  if (languageFilter !== 'all') {
    filteredTickets = filteredTickets.filter(ticket => ticket.language === languageFilter);
  }

  // Sort by priority
  const priorityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
  filteredTickets.sort((a, b) => {
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  // Update language filter dropdown with unique languages from tickets
  updateLanguageFilter();

  // Render filtered tickets
  queueContainer.innerHTML = '';

  if (filteredTickets.length === 0) {
    emptyState.style.display = 'block';
    updateQueueBadge();
    return;
  }

  emptyState.style.display = 'none';

  const rows = Math.ceil(filteredTickets.length / 4);
  for (let i = 0; i < rows; i++) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.marginBottom = '1rem';

    const start = i * 4;
    const end = start + 4;
    const ticketsInRow = filteredTickets.slice(start, end);

    ticketsInRow.forEach(ticket => {
      const ticketHTML = createTicketRow(ticket);
      const ticketElement = document.createElement('div');
      ticketElement.innerHTML = ticketHTML;
      ticketElement.style.flex = '1';
      ticketElement.style.margin = '0 0.5rem';
      row.appendChild(ticketElement);
    });

    queueContainer.appendChild(row);
  }

  updateQueueBadge();
}

// ===== Update Language Filter Dropdown =====
function updateLanguageFilter() {
  const languageSelect = document.getElementById('languageFilter');
  if (!languageSelect) return;

  // Get unique languages from tickets
  const savedTickets = localStorage.getItem(DB_KEYS.TICKETS);
  if (savedTickets) {
    const tickets = JSON.parse(savedTickets);
    const languages = [...new Set(tickets.map(t => t.language).filter(l => l))];
    
    // Save current selection
    const currentSelection = languageSelect.value;
    
    // Rebuild options
    languageSelect.innerHTML = '<option value="all">All Languages</option>';
    languages.forEach(lang => {
      const option = document.createElement('option');
      option.value = lang;
      option.textContent = lang;
      languageSelect.appendChild(option);
    });
    
    // Restore selection if still available
    if (languages.includes(currentSelection)) {
      languageSelect.value = currentSelection;
    }
  }
}

// ===== Update Archive List =====
function updateArchiveList() {
  const archiveContainer = document.getElementById('archiveList');
  const emptyArchive = document.getElementById('emptyArchive');

  if (!archiveContainer || !emptyArchive) return;

  // Get resolved tickets
  const resolvedTickets = ticketsArray.filter(ticket => ticket.status === 'Resolved');

  archiveContainer.innerHTML = '';

  if (resolvedTickets.length === 0) {
    emptyArchive.style.display = 'block';
    return;
  }

  emptyArchive.style.display = 'none';

  resolvedTickets.forEach(ticket => {
    const archiveItem = document.createElement('div');
    archiveItem.style.cssText = 'background: white; padding: 1rem; margin-bottom: 1rem; border-radius: 8px; border-left: 4px solid #10b981; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
    archiveItem.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: bold; color: #10b981;">${escapeHtml(ticket.priority)} Priority - Resolved</div>
          <div style="font-size: 0.85rem; color: #6b7280;">Assigned to: ${escapeHtml(ticket.assignedTrainer)}</div>
        </div>
        <div style="font-size: 0.85rem; color: #6b7280;">
          ${ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleDateString() : ''}
        </div>
      </div>
      <div style="margin-top: 0.5rem; font-size: 0.9rem;">
        <div><strong>Ticket ID:</strong> ${escapeHtml(ticket.id)}</div>
        <div><strong>Mobile:</strong> ${escapeHtml(ticket.mobileNumber)}</div>
        <div><strong>Product:</strong> ${escapeHtml(ticket.product)}</div>
        ${ticket.language ? `<div><strong>Language:</strong> ${escapeHtml(ticket.language)}</div>` : ''}
        <div><strong>Query:</strong> ${escapeHtml(ticket.queryDescription)}</div>
      </div>
    `;
    archiveContainer.appendChild(archiveItem);
  });
}

// ===== Manual Refresh Function =====
function manualRefreshQueue() {
  loadFromLocalStorage();
  updateDashboardQueue();
  showToast('âœ… Dashboard refreshed!', 'success');
}

// ===== Claim/Assign Ticket =====
function claimTicket(ticketId) {
  const ticketIndex = ticketsArray.findIndex(ticket => ticket.id === ticketId);
  if (ticketIndex === -1) {
    showToast('âŒ Ticket not found', 'error');
    return;
  }

  const ticket = ticketsArray[ticketIndex];

  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 3000;';

  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 400px; width: 90%;';

  modalContent.innerHTML = '<h3 style="margin-bottom: 1.5rem; color: #374151;">Assign Ticket to Email</h3>' +
    '<form id="assignEmailForm">' +
    '<div style="margin-bottom: 1rem;">' +
    '<label for="emailInput" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #374151;">Email Address:</label>' +
    '<input type="email" id="emailInput" placeholder="Enter email address" required style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem;">' +
    '</div>' +
    '<button type="submit" style="width: 100%; padding: 0.75rem; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 1rem;">Assign Ticket</button>' +
    '</form>';

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  const form = modalContent.querySelector('#assignEmailForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('emailInput').value.trim();

    if (!email) {
      showToast('âŒ Please enter a valid email', 'error');
      return;
    }

    // Change status to Resolved
    ticket.status = 'Resolved';
    ticket.assignedTrainer = email;
    ticket.resolvedAt = new Date().toISOString();

    saveToLocalStorage();
    updateDashboardQueue();
    updateArchiveList();
    sendEmail(email, ticket);

    modal.remove();
    showToast('âœ… Ticket assigned and archived', 'success');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// ===== Send Email =====
function sendAssignmentEmail(agent, ticket) {
  if (!agent || !agent.email) {
    return Promise.resolve({ success: false, message: 'Assigned agent email is missing.' });
  }

  const config = getEmailJSConfig();

  if (!config.publicKey || !config.serviceId || !config.templateId) {
    console.log('Auto-assignment email skipped: EmailJS not configured');
    return Promise.resolve({ success: false, message: 'EmailJS not configured.' });
  }

  if (typeof emailjs === 'undefined') {
    console.log('Auto-assignment email skipped: EmailJS library not loaded');
    return Promise.resolve({ success: false, message: 'EmailJS library not loaded.' });
  }

  try {
    emailjs.init(config.publicKey);

    const templateParams = {
      to_email: agent.email,
      ticket_id: ticket.id,
      mobile_number: ticket.mobileNumber,
      product: ticket.product,
      query_description: ticket.queryDescription,
      priority: ticket.priority,
      status: ticket.status || 'Assigned',
      assigned_date: new Date().toLocaleString(),
      agent_name: agent.name || '',
      language: ticket.language || ''
    };

    return emailjs.send(config.serviceId, config.templateId, templateParams)
      .then(() => {
        console.log('Auto-assignment email sent to', agent.email);
        return { success: true, message: 'Assignment email sent.' };
      })
      .catch((error) => {
        console.error('Auto-assignment email failed:', error);
        const message = error && (error.text || error.message || error.status) ? String(error.text || error.message || error.status) : 'Unknown email error';
        return { success: false, message: message };
      });
  } catch (error) {
    console.error('Auto-assignment email init failed:', error);
    return Promise.resolve({ success: false, message: error.message || 'EmailJS initialization failed.' });
  }
}

function sendEmail(email, ticket) {
  const emailContent = generateEmailContent(email, ticket);
  showEmailPreviewModal(emailContent, email, ticket);
  console.log('ðŸ“§ EMAIL TO SEND:', emailContent);

  const config = getEmailJSConfig();
  console.log('ðŸ”§ EmailJS Config:', config);

  if (!config.publicKey || !config.serviceId || !config.templateId) {
    console.log('âš ï¸ EmailJS not configured');
    showToast('âŒ EmailJS not configured. Please set up credentials in Settings.', 'error');
    return;
  }

  if (typeof emailjs === 'undefined') {
    console.log('âš ï¸ EmailJS library not loaded');
    showToast('âŒ EmailJS library failed to load. Please refresh the page.', 'error');
    return;
  }

  try {
    console.log('ðŸ”§ Initializing EmailJS with public key:', config.publicKey.substring(0, 10) + '...');
    emailjs.init(config.publicKey);

    const templateParams = {
      to_email: email,
      ticket_id: ticket.id,
      mobile_number: ticket.mobileNumber,
      product: ticket.product,
      query_description: ticket.queryDescription,
      priority: ticket.priority,
      status: ticket.status,
      assigned_date: new Date().toLocaleString()
    };

    console.log('ðŸ“§ Sending email with parameters:', templateParams);

    emailjs.send(config.serviceId, config.templateId, templateParams)
      .then((response) => {
        console.log('âœ… Email sent successfully:', response);
        showToast('âœ… Email sent to ' + email, 'success');
      })
      .catch((error) => {
        console.error('âŒ Email sending failed:', error);
        console.error('âŒ Error details:', {
          error_text: error.text,
          error_message: error.message,
          error_status: error.status,
          error_type: typeof error
        });

        // Show detailed error message
        let errorMessage = 'Unknown error';
        if (error.text) errorMessage = error.text;
        else if (error.message) errorMessage = error.message;
        else if (error.status) errorMessage = 'HTTP Error: ' + error.status;

        showToast('âŒ Failed to send email. Error: ' + errorMessage, 'error');
      });
  } catch (error) {
    console.error('âŒ EmailJS initialization error:', error);
    showToast('âŒ EmailJS configuration error. Please check your credentials.', 'error');
  }
}

function generateEmailContent(email, ticket) {
  return 'â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n' +
    'TICKET ASSIGNED\n' +
    'â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n\n' +
    'Dear Support Team,\n\n' +
    'You have been assigned a new ticket.\n\n' +
    'Ticket ID:       ' + ticket.id + '\n' +
    'Mobile:          ' + ticket.mobileNumber + '\n' +
    'Product:         ' + ticket.product + '\n' +
    'Priority:        ' + ticket.priority + '\n' +
    'Status:          Assigned\n' +
    'Date:            ' + new Date().toLocaleString() + '\n\n' +
    'Query:\n' + ticket.queryDescription + '\n\n' +
    'Please address this ticket promptly.\n\n' +
    'Best regards,\n' +
    'Self-Ticket Support System\n';
}

function showEmailPreviewModal(emailContent, email, ticket) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 3000;';

  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;';

  modalContent.innerHTML = '<h3 style="margin-bottom: 1rem; color: #1f2937;">Email Preview</h3>' +
    '<p style="color: #6b7280; margin-bottom: 1.5rem;">Email to: <strong>' + escapeHtml(email) + '</strong></p>' +
    '<pre style="background: #f3f4f6; padding: 1.5rem; border-radius: 6px; overflow-x: auto; font-family: monospace; font-size: 0.85rem; line-height: 1.6; color: #374151;">' + escapeHtml(emailContent) + '</pre>' +
    '<div style="margin-top: 1.5rem; display: flex; gap: 1rem;">' +
    '<button id="sendEmailBtn" style="flex: 1; padding: 0.75rem; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Send</button>' +
    '<button onclick="this.closest(\'div\').parentElement.remove()" style="flex: 1; padding: 0.75rem; background: #f3f4f6; color: #374151; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Close</button>' +
    '</div>';

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // Add click event listener to Send button
  const sendBtn = modalContent.querySelector('#sendEmailBtn');
  sendBtn.addEventListener('click', () => {
    if (ticket) {
      // Call the actual send email function
      const config = getEmailJSConfig();
      
      if (!config.publicKey || !config.serviceId || !config.templateId) {
        showToast('âŒ EmailJS not configured. Please set up credentials in Settings.', 'error');
        return;
      }

       // Check if EmailJS library is available
       if (typeof emailjs === 'undefined') {
         console.error('EmailJS library not defined');
         
         // Try to reload the EmailJS library dynamically
         const script = document.createElement('script');
         script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js'; // Correct URL
         script.async = true;
         script.onload = () => {
           console.log('EmailJS library loaded successfully');
           // Wait a little more to ensure initialization
           setTimeout(() => {
             if (typeof emailjs !== 'undefined') {
               sendEmailInternal(email, ticket, config, modal);
             } else {
               showToast('âŒ EmailJS library failed to initialize. Please refresh the page.', 'error');
             }
           }, 500);
         };
         script.onerror = () => {
           console.error('Failed to load EmailJS library');
           showToast('âŒ Failed to load EmailJS library. Please check your internet connection and refresh the page.', 'error');
         };
         document.head.appendChild(script);
         
         return;
       }
      
      sendEmailInternal(email, ticket, config, modal);
    } else {
      showToast('âŒ Ticket not found', 'error');
    }
  });
  
  function sendEmailInternal(email, ticket, config, modal) {
    try {
      emailjs.init(config.publicKey);

      const templateParams = {
        to_email: email,
        ticket_id: ticket.id,
        mobile_number: ticket.mobileNumber,
        product: ticket.product,
        query_description: ticket.queryDescription,
        priority: ticket.priority,
        status: ticket.status,
        assigned_date: new Date().toLocaleString()
      };

      emailjs.send(config.serviceId, config.templateId, templateParams)
        .then((response) => {
          console.log('âœ… Email sent successfully:', response);
          showToast('âœ… Email sent to ' + email, 'success');
          modal.remove(); // Close modal after successful send
        })
        .catch((error) => {
          console.error('âŒ Email sending failed:', error);
          
          let errorMessage = 'Unknown error';
          if (error.text) errorMessage = error.text;
          else if (error.message) errorMessage = error.message;
          else if (error.status) errorMessage = 'HTTP Error: ' + error.status;

          showToast('âŒ Failed to send email. Error: ' + errorMessage, 'error');
        });
    } catch (error) {
      console.error('âŒ EmailJS initialization error:', error);
      showToast('âŒ EmailJS configuration error. Please check your credentials.', 'error');
    }
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// ===== EmailJS Configuration =====
function setupEmailJSConfigForm() {
  const form = document.getElementById('emailjsConfigForm');
  if (!form) return;

  const config = getEmailJSConfig();
  document.getElementById('publicKey').value = config.publicKey || '';
  document.getElementById('serviceId').value = config.serviceId || '';
  document.getElementById('templateId').value = config.templateId || '';

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const newConfig = {
      publicKey: document.getElementById('publicKey').value.trim(),
      serviceId: document.getElementById('serviceId').value.trim(),
      templateId: document.getElementById('templateId').value.trim()
    };

    if (!newConfig.publicKey || !newConfig.serviceId || !newConfig.templateId) {
      showToast('âŒ Fill in all fields', 'error');
      return;
    }

    // Save configuration permanently
    localStorage.setItem('emailjsConfig', JSON.stringify(newConfig));

    // Also save to a more persistent location for backup
    localStorage.setItem('emailjsConfigBackup', JSON.stringify(newConfig));

    const statusDiv = document.getElementById('configStatus');
    if (statusDiv) {
      statusDiv.style.display = 'block';
      statusDiv.style.background = '#d1fae5';
      statusDiv.style.borderLeft = '4px solid #10b981';
      statusDiv.style.color = '#065f46';
      statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> âœ… EmailJS configured permanently!';
    }

    showToast('âœ… EmailJS configured permanently!', 'success');

    setTimeout(() => {
      if (statusDiv) statusDiv.style.display = 'none';
    }, 3000);
  });
}

function getEmailJSConfig() {
  const saved = localStorage.getItem('emailjsConfig');
  const backup = localStorage.getItem('emailjsConfigBackup');

  if (saved) {
    return JSON.parse(saved);
  } else if (backup) {
    // Restore from backup if main config is missing
    localStorage.setItem('emailjsConfig', backup);
    return JSON.parse(backup);
  }

  return {
    publicKey: '',
    serviceId: '',
    templateId: ''
  };
}

function checkEmailJSConfiguration() {
  const config = getEmailJSConfig();
  const statusDiv = document.getElementById('configStatus');

  if (statusDiv && config.publicKey && config.serviceId && config.templateId) {
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#d1fae5';
    statusDiv.style.borderLeft = '4px solid #10b981';
    statusDiv.style.color = '#065f46';
    statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> âœ… EmailJS is configured!';
  }
}

// ===== Helper Functions =====
function switchTab(tabId) {
  console.log('ðŸ“Œ switchTab called with:', tabId);
  
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  console.log('ðŸš€ Found buttons:', tabButtons.length, 'contents:', tabContents.length);
  
  // Remove active class from all buttons and contents
  tabButtons.forEach(btn => {
    btn.classList.remove('active');
    console.log('ðŸ”˜ Button removed active:', btn.getAttribute('data-tab'));
  });
  
  tabContents.forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
    console.log('ðŸ“„ Content removed active:', content.id);
  });
  
  // Add active class to selected button
  const selectedButton = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (selectedButton) {
    selectedButton.classList.add('active');
    console.log('âœ… Button added active:', selectedButton.getAttribute('data-tab'));
  } else {
    console.error('âŒ Button not found for tab:', tabId);
  }
  
  // Show selected tab content
  const selectedContent = document.getElementById(tabId);
  if (selectedContent) {
    selectedContent.classList.add('active');
    selectedContent.style.display = 'block';
    console.log('âœ… Content added active:', selectedContent.id);
  } else {
    console.error('âŒ Content not found for tab:', tabId);
  }
  
  // Always update agents list for debugging
  console.log('ðŸ”„ Calling updateAvailableAgentsList');
  updateAvailableAgentsList();
  console.log('ðŸ”„ Calling updateAssignmentHistory');
  updateAssignmentHistory();
  
  // Update archive list when switching to archive tab
  if (tabId === 'archive') {
    updateArchiveList();
  }
  
  // Update reports when switching to reports tab
  if (tabId === 'reports') {
    updateAssignmentStats();
  }
}

function setupTabSwitching() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      switchTab(tabId);
    });
  });
}

function generateTicketId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return 'TKT-' + (timestamp + random).toUpperCase();
}

function getTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  if (seconds < 2592000) return Math.floor(seconds / 86400) + 'd ago';

  return date.toLocaleDateString();
}

function updateQueueBadge() {
  const badge = document.getElementById('queueBadge');
  if (!badge) return;

  const openCount = ticketsArray.filter(ticket => ticket.status === 'Open').length;
  badge.textContent = openCount;
}

function updateTrainerList() {
  const trainerList = document.getElementById('trainerList');
  if (!trainerList) return;

  trainerList.innerHTML = trainersArray.map(trainer => `
    <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: #f8fafc; margin: 0.5rem 0; border-radius: 6px;">
      <div>
        <div style="font-weight: 600;">${escapeHtml(trainer.name)}</div>
        <div style="font-size: 0.85rem; color: #6b7280;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${trainer.status === 'Available' ? '#10b981' : '#f59e0b'}; margin-right: 0.5rem;"></span>
          ${trainer.status} â€¢ Load: ${trainer.load}
        </div>
      </div>
    </div>
  `).join('');
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.cssText = `
    position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%);
    background: ${type === 'error' ? '#ef4444' : '#10b981'}; color: white;
    padding: 1rem 1.5rem; border-radius: 6px; display: flex; align-items: center; gap: 0.75rem; z-index: 1000;
  `;

  toast.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i><span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== Round-Robin Agent Management UI =====

// Update the available agents list in the UI
function updateAvailableAgentsList() {
  console.log('ðŸš¨ updateAvailableAgentsList is being called!');
  console.log('availableAgents variable:', availableAgents);
  console.log('LocalStorage agents:', localStorage.getItem('selfTicket_available_agents'));
  console.log('ðŸ“‹ updateAvailableAgentsList called');
  console.log('availableAgents:', availableAgents);
  console.log('localStorage:', localStorage.getItem('selfTicket_available_agents'));
  const container = document.getElementById('availableAgentsList');
  console.log('container found:', !!container);
  if (!container) return;

  const activeAgents = availableAgents.filter(a => a.status === 'Active');
  const inactiveAgents = availableAgents.filter(a => a.status === 'Inactive');

  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <h4 style="color: #374151; margin-bottom: 1rem;"><i class="fas fa-users"></i> Active Agents (${activeAgents.length})</h4>
      ${activeAgents.length === 0 ? '<p style="color: #6b7280;">No active agents</p>' : ''}
      ${activeAgents.map(agent => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f0fdf4; margin: 0.5rem 0; border-radius: 6px; border-left: 3px solid #10b981;">
          <div>
            <div style="font-weight: 600;">${escapeHtml(agent.name)}</div>
            <div style="font-size: 0.85rem; color: #6b7280;">${escapeHtml(agent.email)}</div>
            <div style="font-size: 0.8rem; color: #6b7280;">Language: ${escapeHtml(agent.language || 'Any')}</div>
            <div style="font-size: 0.8rem; color: #9ca3af;">Assigned: ${agent.assignedCount || 0} tickets</div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button onclick="editAgent(${agent.id})" title="Edit agent" style="padding: 0.4rem 0.8rem; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
              <i class="fas fa-pen"></i>
            </button>
            <button onclick="removeAgentFromList(${agent.id})" title="Remove agent" style="padding: 0.4rem 0.8rem; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
              <i class="fas fa-trash"></i>
            </button>
            <button onclick="activateAgent(${agent.id})" title="Set active" style="padding: 0.4rem 0.8rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; opacity: 0.55;">
              <i class="fas fa-play"></i>
            </button>
            <button onclick="deactivateAgent(${agent.id})" title="Set inactive" style="padding: 0.4rem 0.8rem; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
              <i class="fas fa-pause"></i>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
    ${inactiveAgents.length > 0 ? `
    <div style="margin-bottom: 1.5rem;">
      <h4 style="color: #6b7280; margin-bottom: 1rem;"><i class="fas fa-user-slash"></i> Inactive Agents (${inactiveAgents.length})</h4>
      ${inactiveAgents.map(agent => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f3f4f6; margin: 0.5rem 0; border-radius: 6px; border-left: 3px solid #9ca3af; opacity: 0.7;">
          <div>
            <div style="font-weight: 600; color: #6b7280;">${escapeHtml(agent.name)}</div>
            <div style="font-size: 0.85rem; color: #9ca3af;">${escapeHtml(agent.email)}</div>
            <div style="font-size: 0.8rem; color: #9ca3af;">Language: ${escapeHtml(agent.language || 'Any')}</div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button onclick="editAgent(${agent.id})" title="Edit agent" style="padding: 0.4rem 0.8rem; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
              <i class="fas fa-pen"></i>
            </button>
            <button onclick="removeAgentFromList(${agent.id})" title="Remove agent" style="padding: 0.4rem 0.8rem; background: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
              <i class="fas fa-trash"></i>
            </button>
            <button onclick="activateAgent(${agent.id})" title="Set active" style="padding: 0.4rem 0.8rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
              <i class="fas fa-play"></i>
            </button>
            <button onclick="deactivateAgent(${agent.id})" title="Set inactive" style="padding: 0.4rem 0.8rem; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; opacity: 0.55;">
              <i class="fas fa-pause"></i>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}
  `;

  // Update rotation info
  const rotationInfo = document.getElementById('rotationInfo');
  if (rotationInfo) {
    loadRotationState();
    const generalRotationIndex = rotationState.all || 0;
    const nextAgent = activeAgents.length > 0 ? activeAgents[generalRotationIndex % activeAgents.length] : null;
    rotationInfo.innerHTML = `
      <div style="padding: 1rem; background: #eff6ff; border-radius: 6px; border-left: 3px solid #4f46e5;">
        <div style="font-weight: 600; color: #4f46e5; margin-bottom: 0.5rem;">
          <i class="fas fa-sync"></i> Round-Robin Status
        </div>
        <div style="font-size: 0.9rem; color: #374151;">
          <strong>Next Agent:</strong> ${nextAgent ? escapeHtml(nextAgent.name) + ' (' + escapeHtml(nextAgent.email) + ')' : 'None available'}
        </div>
        ${nextAgent ? `<div style="font-size: 0.85rem; color: #6b7280; margin-top: 0.4rem;"><strong>Languages:</strong> ${escapeHtml(nextAgent.language || 'Any')}</div>` : ''}
        <div style="font-size: 0.85rem; color: #6b7280; margin-top: 0.5rem;">
          <strong>General Rotation Index:</strong> ${generalRotationIndex} | <strong>Total Active:</strong> ${activeAgents.length}
        </div>
      </div>
    `;
  }
}

// Toggle agent status between Active and Inactive
function toggleAgentStatus(agentId) {
  const agent = availableAgents.find(a => a.id === agentId);
  if (agent) {
    const newStatus = agent.status === 'Active' ? 'Inactive' : 'Active';
    setAgentStatus(agentId, newStatus);
    updateAvailableAgentsList();
    showToast('✅ Agent ' + (newStatus === 'Active' ? 'activated' : 'deactivated'), 'success');
  }
}

function activateAgent(agentId) {
  if (setAgentStatus(agentId, 'Active')) {
    updateAvailableAgentsList();
    showToast('✅ Agent activated', 'success');
  }
}

function deactivateAgent(agentId) {
  if (setAgentStatus(agentId, 'Inactive')) {
    updateAvailableAgentsList();
    showToast('✅ Agent inactivated', 'success');
  }
}

function deleteAgent(agentId) {
  const agent = availableAgents.find(a => a.id === agentId);
  if (!agent) return false;

  availableAgents = availableAgents.filter(a => a.id !== agentId);
  saveAvailableAgents();
  rotationState = {};
  saveRotationState();

  const editIdInput = document.getElementById('agentEditId');
  if (editIdInput && editIdInput.value === String(agentId)) {
    resetAgentForm();
  }

  return true;
}

// Remove agent from the list
function removeAgentFromList(agentId) {
  if (confirm('Are you sure you want to remove this agent from the rotation?')) {
    if (deleteAgent(agentId)) {
      updateAvailableAgentsList();
      showToast('✅ Agent removed from rotation', 'success');
    }
  }
}

function addNewAgent(name, email, language) {
  if (!name || !email || !language) {
    showToast('âŒ Please provide name, email, and language', 'error');
    return false;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast('âŒ Please enter a valid email address', 'error');
    return false;
  }

  // Check if email already exists
  if (availableAgents.some(a => a.email.toLowerCase() === email.toLowerCase())) {
    showToast('âŒ This email is already in the agent list', 'error');
    return false;
  }

  addAgent(name, email, language);
  updateAvailableAgentsList();
  showToast('âœ… Agent added: ' + email, 'success');
  return true;
}

function editAgent(agentId) {
  const agent = availableAgents.find(a => a.id === agentId);
  if (!agent) {
    showToast('âŒ Agent not found', 'error');
    return;
  }

  const editIdInput = document.getElementById('agentEditId');
  const nameInput = document.getElementById('agentName');
  const emailInput = document.getElementById('agentEmail');
  const languageInput = document.getElementById('agentLanguage');
  const title = document.getElementById('agentFormTitle');
  const description = document.getElementById('agentFormDescription');
  const submitButton = document.getElementById('agentFormSubmit');
  const cancelButton = document.getElementById('agentFormCancel');

  if (!editIdInput || !nameInput || !emailInput || !languageInput) return;

  editIdInput.value = String(agent.id);
  nameInput.value = agent.name || '';
  emailInput.value = agent.email || '';
  languageInput.value = agent.language || '';

  if (title) title.textContent = 'Edit Agent';
  if (description) description.textContent = 'Update the agent name, email address, and language for round-robin assignment.';
  if (submitButton) submitButton.innerHTML = '<i class="fas fa-pen"></i> Update Agent';
  if (cancelButton) cancelButton.style.display = 'inline-flex';

  nameInput.focus();
}

function resetAgentForm() {
  const form = document.getElementById('addAgentForm');
  const editIdInput = document.getElementById('agentEditId');
  const title = document.getElementById('agentFormTitle');
  const description = document.getElementById('agentFormDescription');
  const submitButton = document.getElementById('agentFormSubmit');
  const cancelButton = document.getElementById('agentFormCancel');

  if (form) form.reset();
  if (editIdInput) editIdInput.value = '';
  if (title) title.textContent = 'Add Available Agent';
  if (description) description.textContent = 'Enter Agent Name, Agent Email Address, and Language. This list is used for round-robin auto assignment.';
  if (submitButton) submitButton.innerHTML = '<i class="fas fa-user-plus"></i> Add Agent';
  if (cancelButton) cancelButton.style.display = 'none';
}

function updateExistingAgent(agentId, name, email, language) {
  if (!name || !email || !language) {
    showToast('âŒ Please provide name, email, and language', 'error');
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast('âŒ Please enter a valid email address', 'error');
    return false;
  }

  const agentIndex = availableAgents.findIndex(a => a.id === agentId);
  if (agentIndex === -1) {
    showToast('âŒ Agent not found', 'error');
    return false;
  }

  const duplicateAgent = availableAgents.find(a => a.id !== agentId && a.email.toLowerCase() === email.toLowerCase());
  if (duplicateAgent) {
    showToast('âŒ This email is already in the agent list', 'error');
    return false;
  }

  availableAgents[agentIndex] = {
    ...availableAgents[agentIndex],
    name,
    email,
    language,
    updatedAt: new Date().toISOString()
  };

  saveAvailableAgents();
  updateAvailableAgentsList();
  showToast('âœ… Agent updated: ' + email, 'success');
  return true;
}

// Reset the rotation
function resetRoundRobinRotation() {
  resetRotation();
  updateAvailableAgentsList();
  showToast('âœ… Rotation reset to beginning', 'success');
}

// ===== Assignment History UI =====

// Update assignment history display
function updateAssignmentHistory() {
  const container = document.getElementById('assignmentHistoryList');
  if (!container) return;

  const history = getAssignmentHistory();

  if (history.length === 0) {
    container.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 2rem;">No assignment history yet</p>';
    return;
  }

  container.innerHTML = history.map(record => `
    <div style="padding: 1rem; background: white; margin: 0.5rem 0; border-radius: 6px; border-left: 3px solid #4f46e5; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div>
          <div style="font-weight: 600; color: #4f46e5;">${escapeHtml(record.ticketId)}</div>
          <div style="font-size: 0.85rem; color: #6b7280;">
            <i class="fas fa-user"></i> ${escapeHtml(record.agentName)} (${escapeHtml(record.agentEmail)})
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.8rem; color: #9ca3af;">${new Date(record.assignedAt).toLocaleString()}</div>
          <div style="font-size: 0.75rem; color: #10b981; background: #d1fae5; padding: 0.2rem 0.5rem; border-radius: 3px; display: inline-block; margin-top: 0.25rem;">
            ${record.method}
          </div>
        </div>
      </div>
      <div style="margin-top: 0.5rem; font-size: 0.85rem; color: #374151;">
        <strong>Priority:</strong> ${record.ticketDetails.priority} | 
        <strong>Product:</strong> ${escapeHtml(record.ticketDetails.product)} |
        <strong>Agent Language:</strong> ${escapeHtml(record.agentLanguage || 'Any')}
      </div>
    </div>
  `).join('');
}

// Get assignment statistics for reports
function getAssignmentStats() {
  const history = getAssignmentHistory();
  const stats = {};

  history.forEach(record => {
    if (!stats[record.agentEmail]) {
      stats[record.agentEmail] = {
        email: record.agentEmail,
        name: record.agentName,
        count: 0,
        highPriority: 0,
        mediumPriority: 0,
        lowPriority: 0
      };
    }
    stats[record.agentEmail].count++;
    if (record.ticketDetails.priority === 'High') stats[record.agentEmail].highPriority++;
    if (record.ticketDetails.priority === 'Medium') stats[record.agentEmail].mediumPriority++;
    if (record.ticketDetails.priority === 'Low') stats[record.agentEmail].lowPriority++;
  });

  return Object.values(stats);
}

// Update assignment statistics display
function updateAssignmentStats() {
  const container = document.getElementById('assignmentStats');
  if (!container) return;

  const stats = getAssignmentStats();

  if (stats.length === 0) {
    container.innerHTML = '<p style="color: #6b7280; text-align: center;">No statistics available</p>';
    return;
  }

  // Sort by total assigned
  stats.sort((a, b) => b.count - a.count);

  container.innerHTML = `
    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
      <thead>
        <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
          <th style="text-align: left; padding: 0.75rem; color: #374151;">Agent</th>
          <th style="text-align: center; padding: 0.75rem; color: #374151;">Total</th>
          <th style="text-align: center; padding: 0.75rem; color: #ef4444;">High</th>
          <th style="text-align: center; padding: 0.75rem; color: #f59e0b;">Medium</th>
          <th style="text-align: center; padding: 0.75rem; color: #10b981;">Low</th>
        </tr>
      </thead>
      <tbody>
        ${stats.map(s => `
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 0.75rem;">
              <div style="font-weight: 600;">${escapeHtml(s.name)}</div>
              <div style="font-size: 0.8rem; color: #6b7280;">${escapeHtml(s.email)}</div>
            </td>
            <td style="text-align: center; padding: 0.75rem; font-weight: 600;">${s.count}</td>
            <td style="text-align: center; padding: 0.75rem; color: #ef4444;">${s.highPriority}</td>
            <td style="text-align: center; padding: 0.75rem; color: #f59e0b;">${s.mediumPriority}</td>
            <td style="text-align: center; padding: 0.75rem; color: #10b981;">${s.lowPriority}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ===== Expose functions globally =====
globalThis.claimTicket = claimTicket;
globalThis.updateDashboardQueue = updateDashboardQueue;
globalThis.manualRefreshQueue = manualRefreshQueue;
globalThis.filterTickets = filterTickets;
globalThis.updateLanguageFilter = updateLanguageFilter;

// Round-robin functions
globalThis.initializeRoundRobinSystem = initializeRoundRobinSystem;
globalThis.updateAvailableAgentsList = updateAvailableAgentsList;
globalThis.switchTab = switchTab;
globalThis.toggleAgentStatus = toggleAgentStatus;
globalThis.activateAgent = activateAgent;
globalThis.deactivateAgent = deactivateAgent;
globalThis.removeAgentFromList = removeAgentFromList;
globalThis.editAgent = editAgent;
globalThis.addNewAgent = addNewAgent;
globalThis.resetRoundRobinRotation = resetRoundRobinRotation;
globalThis.updateAssignmentHistory = updateAssignmentHistory;
globalThis.getAssignmentStats = getAssignmentStats;
globalThis.updateAssignmentStats = updateAssignmentStats;
globalThis.autoAssignTicket = autoAssignTicket;
globalThis.getNextAgent = getNextAgent;
globalThis.getAgentStats = getAgentStats;
globalThis.getAssignmentHistory = getAssignmentHistory;
globalThis.syncAllTicketsToGoogleSheet = syncAllTicketsToGoogleSheet;

// Export assignment history to CSV
function exportAssignmentHistory() {
  const history = getAssignmentHistory();
  
  if (history.length === 0) {
    showToast('âŒ No assignment history to export', 'error');
    return;
  }

  // Create CSV header
  let csv = 'Ticket ID,Agent Name,Agent Email,Priority,Product,Mobile,Assigned At,Method\n';

  // Add data rows
  history.forEach(record => {
    csv += `"${record.ticketId}","${record.agentName}","${record.agentEmail}","${record.ticketDetails.priority}","${record.ticketDetails.product}","${record.ticketDetails.mobileNumber}","${record.assignedAt}","${record.method}"\n`;
  });

  // Create and download file
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `assignment_history_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('âœ… Assignment history exported successfully', 'success');
}

globalThis.exportAssignmentHistory = exportAssignmentHistory;
