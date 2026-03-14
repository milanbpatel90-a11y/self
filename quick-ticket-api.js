// Google Apps Script Web App URL - REPLACE WITH YOUR DEPLOYED URL
const API_URL = "https://script.google.com/macros/s/AKfycbz2hmmAZkgHbkjF2gZuurJCtOUvTQhTZR-v09ja924YHXerNcwy61XArp51x2DMPxSD/exec";

// DB_KEYS - using Google Sheets via API
const DB_KEYS = {
  TICKETS: 'selfTicket_tickets',
  TRAINERS: 'selfTicket_trainers',
  TICKET_COUNTER: 'selfTicket_counter',
  ASSIGNMENT_HISTORY: 'selfTicket_assignment_history',
  AGENT_ROTATION: 'selfTicket_agent_rotation',
  AVAILABLE_AGENTS: 'selfTicket_available_agents'
};

// Initialize data from Google Sheets
async function initializeData() {
  try {
    // Load agents from localStorage (for agent management)
    const savedAgents = localStorage.getItem(DB_KEYS.AVAILABLE_AGENTS);
    if (savedAgents) {
      availableAgents = JSON.parse(savedAgents);
    } else {
      availableAgents = [];
      saveAvailableAgents();
    }
    
    // Load rotation index
    const savedIndex = localStorage.getItem(DB_KEYS.AGENT_ROTATION);
    if (savedIndex) {
      rotationIndex = parseInt(savedIndex, 10);
    }
    
    console.log('✅ Data initialized');
  } catch (error) {
    console.error('Error initializing data:', error);
  }
}

// Submit ticket to Google Sheets via API
async function submitTicketToSheet(ticketData) {
  if (!API_URL || API_URL === "YOUR_GOOGLE_APPS_SCRIPT_URL") {
    console.log('API URL not configured - using localStorage fallback');
    return null;
  }
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(ticketData)
    });
    
    const result = await response.json();
    console.log('Ticket submitted to sheet:', result);
    return result;
  } catch (error) {
    console.error('Error submitting ticket:', error);
    return null;
  }
}

// Round-robin assignment functions
let availableAgents = [];
let rotationIndex = 0;
let assignmentHistory = [];

function loadRoundRobinData() {
  const savedAgents = localStorage.getItem(DB_KEYS.AVAILABLE_AGENTS);
  if (savedAgents) {
    availableAgents = JSON.parse(savedAgents);
  }
  
  const savedIndex = localStorage.getItem(DB_KEYS.AGENT_ROTATION);
  if (savedIndex) {
    rotationIndex = parseInt(savedIndex, 10);
  }
}

function saveAvailableAgents() {
  localStorage.setItem(DB_KEYS.AVAILABLE_AGENTS, JSON.stringify(availableAgents));
}

function saveRotationIndex() {
  localStorage.setItem(DB_KEYS.AGENT_ROTATION, rotationIndex.toString());
}

function getNextAgent() {
  const activeAgents = availableAgents.filter(agent => agent.status === 'Active');
  
  if (activeAgents.length === 0) {
    console.warn('No active agents available');
    return null;
  }

  const agent = activeAgents[rotationIndex % activeAgents.length];
  rotationIndex = (rotationIndex + 1) % activeAgents.length;
  saveRotationIndex();

  return agent;
}

function autoAssignTicket(ticket) {
  const agent = getNextAgent();
  
  if (!agent) {
    return null;
  }

  ticket.assignedTrainer = agent.email;
  ticket.assignedAgentName = agent.name;
  ticket.assignedAgentId = agent.id;
  ticket.assignedAt = new Date().toISOString();
  ticket.assignmentMethod = 'Round-Robin';

  // Update agent's assigned count
  agent.assignedCount = (agent.assignedCount || 0) + 1;
  saveAvailableAgents();

  return agent;
}

// EmailJS Configuration
function getEmailJSConfig() {
  const saved = localStorage.getItem('emailjsConfig');
  if (saved) {
    return JSON.parse(saved);
  }
  return { publicKey: '', serviceId: '', templateId: '' };
}

// Send assignment email
function sendAssignmentEmail(agent, ticket) {
  const config = getEmailJSConfig();
  
  if (!config.publicKey || !config.serviceId || !config.templateId) {
    console.log('EmailJS not configured');
    return;
  }

  if (typeof emailjs === 'undefined') {
    console.log('EmailJS library not loaded');
    return;
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
      status: 'Assigned',
      assigned_date: new Date().toLocaleString()
    };

    emailjs.send(config.serviceId, config.templateId, templateParams)
      .then((response) => {
        console.log('Email sent to', agent.email);
      })
      .catch((error) => {
        console.error('Email failed:', error);
      });
  } catch (error) {
    console.error('EmailJS error:', error);
  }
}

// Mobile validation
function validateMobileNumber(mobileNumber) {
  const cleaned = mobileNumber.replace(/\s/g, '');
  
  if (!cleaned || cleaned.length === 0) {
    return { valid: false, message: 'Mobile number is required' };
  }
  
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, message: 'Mobile number must contain only digits' };
  }
  
  if (cleaned.length !== 10) {
    return { valid: false, message: 'Mobile number must be exactly 10 digits' };
  }
  
  if (cleaned.charAt(0) === '0') {
    return { valid: false, message: 'Mobile number cannot start with 0' };
  }
  
  return { valid: true, message: 'Valid', cleanedNumber: cleaned };
}

function generateTicketId() {
  return 'TKT-' + Date.now();
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  const toastMessage = document.getElementById('toastMessage');
  if (toastMessage) toastMessage.textContent = message;
  
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// Form submission
document.addEventListener('DOMContentLoaded', function() {
  initializeData();
  loadRoundRobinData();
  
  const form = document.getElementById('quickTicketForm');
  if (!form) return;

  const successState = document.getElementById('successState');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const mobile = document.getElementById('mobile').value;
    const product = document.getElementById('product').value;
    const language = document.getElementById('language').value;
    const queries = document.getElementById('queries').value;
    const priority = document.querySelector('input[name="priority"]:checked')?.value || 'Medium';
    
    const mobileValidation = validateMobileNumber(mobile);
    if (!mobileValidation.valid) {
      showToast('❌ ' + mobileValidation.message);
      return;
    }
    
    const ticket = {
      id: generateTicketId(),
      timestamp: new Date().toISOString(),
      mobileNumber: mobileValidation.cleanedNumber,
      product: product,
      language: language,
      queryDescription: queries,
      priority: priority,
      category: product,
      status: 'Open',
      assignedTrainer: null,
      assignedAgentName: null,
      assignedAgentId: null,
      assignedAt: null,
      assignmentMethod: null,
      resolvedAt: null
    };
    
    // Auto-assign using round-robin
    const assignedAgent = autoAssignTicket(ticket);
    
    if (assignedAgent) {
      showToast('✅ Ticket assigned to ' + assignedAgent.email);
      sendAssignmentEmail(assignedAgent, ticket);
    } else {
      showToast('⚠️ Ticket submitted - no agents available');
    }
    
    // Try to submit to Google Sheets
    const sheetResult = await submitTicketToSheet({
      ticketId: ticket.id,
      mobile: ticket.mobileNumber,
      product: ticket.product,
      language: ticket.language,
      query: ticket.queryDescription,
      priority: ticket.priority,
      status: 'Open',
      assignedTo: ticket.assignedTrainer || 'Unassigned',
      createdTime: ticket.timestamp
    });
    
    if (sheetResult) {
      showToast('✅ Ticket submitted to database!');
    }
    
    // Show success
    form.style.display = 'none';
    if (successState) {
      successState.classList.add('show');
    }
  });
});

function resetForm() {
  const form = document.getElementById('quickTicketForm');
  const successState = document.getElementById('successState');
  
  if (form) {
    form.reset();
    form.style.display = 'block';
  }
  if (successState) {
    successState.classList.remove('show');
  }
}
