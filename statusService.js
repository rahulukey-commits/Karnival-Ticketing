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
  // fromDate/tillDate are datetime-local strings ("YYYY-MM-DDTHH:mm") — parsed as
  // local time by `new Date(str)` since they carry no timezone suffix.
  setUserStatus(newStatus, fromDate = null, tillDate = null) {
    const user = AGENTS.find(a => a.email === CURRENT_USER.email);
    if (!user) return false;

    // Validation
    if (newStatus === 'not_available') {
      if (!fromDate || !tillDate) {
        toast('Invalid Status', 'Both from and till time are required', 'warn');
        return false;
      }

      const fromDateObj = new Date(fromDate);
      const tillDateObj = new Date(tillDate);
      const now = new Date();

      if (fromDateObj < now) {
        toast('Invalid Time', 'From time must be now or later', 'warn');
        return false;
      }

      if (tillDateObj <= fromDateObj) {
        toast('Invalid Time', 'Till time must be after the from time', 'warn');
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

    // Once the till timestamp has passed, the agent is available again.
    if (agent.tillDate && new Date(agent.tillDate) <= new Date()) {
      agent.status = 'available';
      agent.fromDate = null;
      agent.tillDate = null;
      localStorage.removeItem(`status_${email}`);
      return true;
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

  // Format date+time range for display, e.g. "Jul 26, 2:00 PM - 5:00 PM"
  // or "Jul 26, 2:00 PM - Jul 28, 10:00 AM" when it spans multiple days.
  formatDateRange(fromDateStr, tillDateStr) {
    if (!fromDateStr || !tillDateStr) return '';
    const from = new Date(fromDateStr);
    const till = new Date(tillDateStr);
    const fmtTime = d => {
      let h = d.getHours(), m = d.getMinutes();
      const ap = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${String(m).padStart(2, '0')} ${ap}`;
    };
    const sameDay = from.toDateString() === till.toDateString();
    const fromStr = `${MON[from.getMonth()]} ${from.getDate()}, ${fmtTime(from)}`;
    const tillStr = sameDay ? fmtTime(till) : `${MON[till.getMonth()]} ${till.getDate()}, ${fmtTime(till)}`;
    return `${fromStr} - ${tillStr}`;
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

          // Auto-revert once the till timestamp has passed.
          if (agent.status === 'not_available' && agent.tillDate && new Date(agent.tillDate) <= new Date()) {
            agent.status = 'available';
            agent.fromDate = null;
            agent.tillDate = null;
            localStorage.removeItem(`status_${agent.email}`);
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
