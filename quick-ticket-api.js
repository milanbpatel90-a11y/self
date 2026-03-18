// Google Apps Script Web App URL - REPLACE WITH YOUR DEPLOYED URL
const API_URL = "https://script.google.com/macros/s/AKfycbyqC6442w0hqOQga0vTOeO7BnoShm4j7DEPg-oxoo3lHtkdMEk03yHGePQbz7fkv_M/exec";

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
    
    loadRotationState();
    
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
let rotationState = {};
let assignmentHistory = [];

function loadRoundRobinData() {
  const savedAgents = localStorage.getItem(DB_KEYS.AVAILABLE_AGENTS);
  if (savedAgents) {
    availableAgents = JSON.parse(savedAgents);
  }
  
  loadRotationState();
}

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

function saveRotationState() {
  localStorage.setItem(DB_KEYS.AGENT_ROTATION, JSON.stringify(rotationState));
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

function normalizeLanguageList(value) {
  if (!value) return [];
  return value
    .split(/[,&/|]+/)
    .map(item => normalizeLanguageKey(item))
    .filter(Boolean);
}

function agentSupportsLanguage(agent, language) {
  const normalizedLanguage = normalizeLanguageKey(language);
  if (!normalizedLanguage) return true;
  const agentLanguages = normalizeLanguageList(agent.language || '');
  if (agentLanguages.length === 0) return false;
  return agentLanguages.includes(normalizedLanguage);
}

function getNextAgent(preferredLanguage = '') {
  const savedAgents = localStorage.getItem(DB_KEYS.AVAILABLE_AGENTS);
  if (savedAgents) {
    availableAgents = JSON.parse(savedAgents);
  }

  loadRotationState();
  const activeAgents = availableAgents.filter(agent => agent.status === 'Active');
  
  if (activeAgents.length === 0) {
    console.warn('No active agents available');
    return null;
  }

  const normalizedLanguage = normalizeLanguageKey(preferredLanguage);
  const rotationPool = normalizedLanguage
    ? activeAgents.filter(agent => agentSupportsLanguage(agent, normalizedLanguage))
    : activeAgents;

  if (rotationPool.length === 0) {
    console.warn('No active agents available for language:', preferredLanguage);
    return null;
  }

  const rotationKey = normalizedLanguage || 'all';
  const currentIndex = rotationState[rotationKey] || 0;
  const agent = rotationPool[currentIndex % rotationPool.length];
  rotationState[rotationKey] = (currentIndex + 1) % rotationPool.length;
  saveRotationState();

  return agent;
}

function autoAssignTicket(ticket) {
  const agent = getNextAgent(ticket.language || '');
  
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
  // First check localStorage
  const saved = localStorage.getItem('emailjsConfig');
  if (saved) {
    return JSON.parse(saved);
  }
  
  // Default configuration
  return { 
    publicKey: 'uDqRwErVJMTN74RF0', 
    serviceId: 'service_auxspig', 
    templateId: 'template_76vdopc' 
  };
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
