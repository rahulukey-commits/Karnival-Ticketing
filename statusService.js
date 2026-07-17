/* ============================================================
   Karnival Ticketing — Status Service
   Manages collaborator availability status and return dates
   ============================================================ */

const StatusService = {
  // Get current user's status
  getCurrentUserStatus() {
    const user = AGENTS.find(a => a.email === CURRENT_USER.email);
    return user ? {
      status: user.status,
      fromDate: user.fromDate || null,
      tillDate: user.tillDate || null
    } : { status: 'available', fromDate: null, tillDate: null };
  },

  // Update current user's status
  setUserStatus(newStatus, fromDate = null, tillDate = null) {
    const user = AGENTS.find(a => a.email === CURRENT_USER.email);
    if (!user) return false;

    // Validation
    if (newStatus === 'not_available') {
      if (!fromDate || !tillDate) {
        toast('Invalid Status', 'Both from and till dates are required', 'warn');
        return false;
      }

      const fromDateObj = new Date(fromDate);
      const tillDateObj = new Date(tillDate);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      if (fromDateObj < tomorrow) {
        toast('Invalid Date', 'From date must be in the future', 'warn');
        return false;
      }

      if (tillDateObj < fromDateObj) {
        toast('Invalid Date', 'Till date must be after or equal to from date', 'warn');
        return false;
      }
    }

    // Update status
    user.status = newStatus;
    user.fromDate = newStatus === 'available' ? null : fromDate;
    user.tillDate = newStatus === 'available' ? null : tillDate;

    // Persist to localStorage
    localStorage.setItem(`status_${CURRENT_USER.email}`, JSON.stringify({
      status: user.status,
      fromDate: user.fromDate,
      tillDate: user.tillDate
    }));

    return true;
  },

  // Get all agents with their status (for assignment dropdown)
  getAvailableAgents() {
    return AGENTS.filter(a => this.isAgentAvailable(a.email));
  },

  // Check if a specific agent is available for assignment
  isAgentAvailable(email) {
    const agent = AGENTS.find(a => a.email === email);
    if (!agent) return true;

    if (agent.status === 'available') return true;

    // Check if till date has passed
    if (agent.tillDate) {
      const tillDateObj = new Date(agent.tillDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (tillDateObj <= today) {
        agent.status = 'available';
        agent.fromDate = null;
        agent.tillDate = null;
        localStorage.removeItem(`status_${email}`);
        return true;
      }
    }

    return false;
  },

  // Get status for a specific agent (for display in assignment UI)
  getAgentStatus(email) {
    const agent = AGENTS.find(a => a.email === email);
    if (!agent) return null;

    // Check and auto-revert if needed
    this.isAgentAvailable(email);

    return {
      name: agent.name,
      email: agent.email,
      status: agent.status,
      fromDate: agent.fromDate,
      tillDate: agent.tillDate,
    };
  },

  // Format date range for display
  formatDateRange(fromDateStr, tillDateStr) {
    if (!fromDateStr || !tillDateStr) return '';
    const from = new Date(fromDateStr);
    const till = new Date(tillDateStr);
    return `${MON[from.getMonth()]} ${from.getDate()} - ${MON[till.getMonth()]} ${till.getDate()}, ${till.getFullYear()}`;
  },

  // Load persisted status from localStorage
  loadPersistedStatus() {
    AGENTS.forEach(agent => {
      const stored = localStorage.getItem(`status_${agent.email}`);
      if (stored) {
        try {
          const { status, fromDate, tillDate } = JSON.parse(stored);
          agent.status = status;
          agent.fromDate = fromDate;
          agent.tillDate = tillDate;

          // Auto-revert if till date has passed
          if (agent.status === 'not_available' && agent.tillDate) {
            const tillDateObj = new Date(agent.tillDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (tillDateObj <= today) {
              agent.status = 'available';
              agent.fromDate = null;
              agent.tillDate = null;
              localStorage.removeItem(`status_${agent.email}`);
            }
          }
        } catch (e) {
          console.error('Error loading status:', e);
        }
      }
    });
  },
};

// Load persisted statuses on app start
StatusService.loadPersistedStatus();
