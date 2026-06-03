const STORAGE_KEYS = {
  model: "brodiedash.openrouter.model",
  positions: "brodiedash.positions",
  tasks: "brodiedash.tasks",
  roadmap: "brodiedash.roadmap",
  users: "brodiedash.users",
  sessionUser: "brodiedash.session.user"
};

// For the local prototype, put your OpenRouter key in config.local.js.
// That file is ignored by Git so the key does not get pushed to GitHub.
const HARDCODED_OPENROUTER_API_KEY = String(window.BRODIEDASH_CONFIG?.openRouterApiKey || "").trim();
const ADMIN_ACCOUNT = {
  username: "brodiebulman",
  password: "Brodie14!$",
  role: "admin"
};
const preferredModels = [
  { id: "openai/gpt-5.5", label: "GPT 5.5" },
  { id: "anthropic/claude-opus-4.8", label: "Claude Opus 4.8" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" }
];
const fallbackModels = preferredModels.map((model) => model.id);
const modelLabels = Object.fromEntries(preferredModels.map((model) => [model.id, model.label]));
const modulePermissions = [
  { id: "ai", label: "AI" },
  { id: "finance", label: "Finance" },
  { id: "calendar", label: "Calendar" },
  { id: "roadmap", label: "Roadmap" },
  { id: "systems", label: "Systems" },
  { id: "admin", label: "Admin" }
];
const defaultModulePermissions = ["ai", "finance", "calendar", "roadmap", "systems"];

const defaultPositions = [];

const defaultTasks = [
  { id: crypto.randomUUID(), title: "Review dashboard architecture", date: toDateInput(new Date()), priority: "High", done: false },
  { id: crypto.randomUUID(), title: "Add OpenRouter key", date: toDateInput(addDays(new Date(), 1)), priority: "Medium", done: false },
  { id: crypto.randomUUID(), title: "Plan finance data provider", date: toDateInput(addDays(new Date(), 3)), priority: "Low", done: false }
];

const recommendedModules = [
  {
    title: "Market Data Connector",
    description: "Wire a quote API such as Polygon, Finnhub, Alpha Vantage, or Twelve Data for live prices, sectors, and alerts.",
    tags: ["Finance", "API", "High impact"]
  },
  {
    title: "AI Portfolio Analyst",
    description: "Let OpenRouter summarize allocation, concentration, downside scenarios, and watchlist catalysts from your saved positions.",
    tags: ["AI", "Finance", "Risk"]
  },
  {
    title: "Recurring Calendar Engine",
    description: "Add recurring tasks, drag scheduling, streaks, agenda lanes, and export to an ICS calendar file.",
    tags: ["Calendar", "Productivity"]
  },
  {
    title: "Personal CRM",
    description: "Track people, follow-ups, notes, birthdays, and relationship history from one command surface.",
    tags: ["CRM", "Network"]
  },
  {
    title: "Knowledge Vault",
    description: "Store notes, documents, links, and AI summaries with semantic search across your personal context.",
    tags: ["Search", "Notes", "AI"]
  },
  {
    title: "Automation Hub",
    description: "Connect GitHub, email, weather, reminders, and webhook actions to turn the dashboard into an operating layer.",
    tags: ["Automation", "Integrations"]
  }
];

const els = {};
const authState = {
  currentUser: null
};
const cloudState = {
  enabled: false,
  users: null,
  saveTimer: null
};
let state = {
  positions: defaultPositions,
  tasks: loadJson(STORAGE_KEYS.tasks, defaultTasks),
  roadmap: loadJson(STORAGE_KEYS.roadmap, []),
  currentMonth: new Date(),
  selectedDate: toDateInput(new Date())
};

document.addEventListener("DOMContentLoaded", async () => {
  bindElements();
  bindEvents();
  await initializeAuth();
  hydrateApiSettings();
  renderAll();
  startClock();
  startCanvases();
});

function bindElements() {
  [
    "authScreen", "loginForm", "signupForm", "loginUsername", "loginPassword", "signupUsername",
    "signupPassword", "authMessage", "clock", "aiLinkStatus", "focusLoad", "currentUserLabel",
    "topLogoutBtn", "refreshModelsBtn", "modelSelect", "keyModeLabel", "aiPrompt", "includeContext",
    "runAiBtn", "aiOutput", "portfolioValue", "portfolioDelta", "taskCount",
    "taskDelta", "roadmapCount", "automationScore", "totalValue", "unrealizedPnL", "riskTilt", "pnlPill",
    "largestPosition", "allocationRing", "financeHealth", "cashReserve", "diversificationScore",
    "allocationSummary", "allocationBars", "positionSummary", "positionForm", "positionsBody",
    "financeRecommendations", "simulatePricesBtn", "monthLabel", "calendarGrid",
    "prevMonthBtn", "nextMonthBtn", "taskForm", "taskList", "featureList", "clearRoadmapBtn",
    "modelSyncProgress", "calendarPressure", "portfolioDrift", "roadmapClarity", "logoutBtn",
    "pendingCount", "approvedCount", "adminRequests"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function hydrateApiSettings() {
  const key = getOpenRouterKey();
  const serverApi = canUseServerApi() && !key;
  els.keyModeLabel.textContent = serverApi ? "Server" : key ? "Local" : "Missing";
  els.aiLinkStatus.textContent = serverApi ? "Server" : key ? "Local" : "Offline";
  setModelOptions(fallbackModels, localStorage.getItem(STORAGE_KEYS.model) || fallbackModels[0]);
  if (serverApi || key) {
    fetchOpenRouterModels();
  }
}

function bindEvents() {
  setupRouteLinks();

  document.querySelectorAll("[data-auth-view]").forEach((button) => {
    button.addEventListener("click", () => switchAuthView(button.dataset.authView));
  });
  els.loginForm.addEventListener("submit", handleLogin);
  els.signupForm.addEventListener("submit", handleSignup);
  els.topLogoutBtn.addEventListener("click", logout);
  els.logoutBtn.addEventListener("click", logout);

  els.refreshModelsBtn.addEventListener("click", fetchOpenRouterModels);
  els.modelSelect.addEventListener("change", () => localStorage.setItem(STORAGE_KEYS.model, els.modelSelect.value));
  els.runAiBtn.addEventListener("click", runAiCommand);
  document.querySelectorAll(".quick-actions button").forEach((button) => {
    button.addEventListener("click", () => {
      els.aiPrompt.value = button.dataset.prompt;
      els.aiPrompt.focus();
    });
  });

  els.positionForm.addEventListener("submit", addPosition);
  els.simulatePricesBtn.addEventListener("click", simulatePriceTick);
  els.prevMonthBtn.addEventListener("click", () => changeMonth(-1));
  els.nextMonthBtn.addEventListener("click", () => changeMonth(1));
  els.taskForm.addEventListener("submit", addTask);
  els.clearRoadmapBtn.addEventListener("click", () => {
    state.roadmap = [];
    persist(STORAGE_KEYS.roadmap, state.roadmap);
    scheduleCloudDashboardSave();
    renderAll();
  });
}

function renderAll() {
  renderFinance();
  renderCalendar();
  renderTasks();
  renderFeatures();
  renderPulse();
  renderAdminConsole();
  updateSystems();
}

function setupRouteLinks() {
  const route = getCurrentRoute();
  document.querySelectorAll("[data-route-link]").forEach((link) => {
    const target = link.dataset.routeLink;
    link.href = getRouteHref(target);
    link.classList.toggle("active", target === route);
  });
}

function getCurrentRoute() {
  return document.body.dataset.route || "home";
}

function getRouteHref(route) {
  if (window.location.protocol === "file:") {
    return getCurrentRoute() === "home" ? `${route}/index.html` : `../${route}/index.html`;
  }
  return `/${route}/`;
}

async function initializeAuth() {
  const cloudSession = await fetchCloudAuthStatus();
  if (cloudSession?.authenticated && cloudSession.user) {
    cloudState.users = cloudSession.users || null;
    await setAuthenticatedUser(cloudSession.user, { cloud: true });
    return;
  }

  if (!canUseLocalFallback() && canUseServerApi()) {
    lockDashboard();
    return;
  }

  const session = loadJson(STORAGE_KEYS.sessionUser, null);
  if (session && isKnownUser(session.username, session.role)) {
    await setAuthenticatedUser(session);
    return;
  }
  lockDashboard();
}

function switchAuthView(view) {
  const showSignup = view === "signup";
  els.loginForm.classList.toggle("hidden", showSignup);
  els.signupForm.classList.toggle("hidden", !showSignup);
  document.querySelectorAll("[data-auth-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authView === view);
  });
  els.authMessage.textContent = showSignup
    ? "New accounts require Brodie approval before login."
    : "Admin access is available for the Brodie account.";
}

async function handleLogin(event) {
  event.preventDefault();
  const username = normalizeUsername(els.loginUsername.value);
  const password = els.loginPassword.value;

  const cloudLogin = await loginWithCloud(username, password);
  if (cloudLogin.handled) {
    if (cloudLogin.user) {
      cloudState.users = cloudLogin.users || null;
      await setAuthenticatedUser(cloudLogin.user, { cloud: true });
      els.loginForm.reset();
      return;
    }
    els.authMessage.textContent = cloudLogin.error;
    return;
  }
  if (!canUseLocalFallback() && canUseServerApi()) {
    els.authMessage.textContent = "Cloud login is unavailable. Check the Vercel database environment variables and redeploy.";
    return;
  }

  if (username === ADMIN_ACCOUNT.username && password === ADMIN_ACCOUNT.password) {
    await setAuthenticatedUser({ username: ADMIN_ACCOUNT.username, role: ADMIN_ACCOUNT.role });
    els.loginForm.reset();
    return;
  }

  const user = loadUsers().find((item) => item.username === username);
  if (!user) {
    els.authMessage.textContent = "No approved account exists for that username.";
    return;
  }
  if (user.status === "pending") {
    els.authMessage.textContent = "That account is still waiting for Brodie approval.";
    return;
  }
  if (user.status === "denied") {
    els.authMessage.textContent = "That account request was denied.";
    return;
  }
  const passwordHash = await hashPassword(password, user.salt);
  if (passwordHash !== user.passwordHash) {
    els.authMessage.textContent = "Incorrect password.";
    return;
  }

  await setAuthenticatedUser({ username: user.username, role: "user" });
  els.loginForm.reset();
}

async function handleSignup(event) {
  event.preventDefault();
  const username = normalizeUsername(els.signupUsername.value);
  const password = els.signupPassword.value;

  if (username.length < 3 || password.length < 6) {
    els.authMessage.textContent = "Use a username with 3+ characters and password with 6+ characters.";
    return;
  }
  if (username === ADMIN_ACCOUNT.username) {
    els.authMessage.textContent = "That username is reserved.";
    return;
  }

  const cloudSignup = await signupWithCloud(username, password);
  if (cloudSignup.handled) {
    if (cloudSignup.ok) {
      els.signupForm.reset();
      switchAuthView("login");
    }
    els.authMessage.textContent = cloudSignup.message;
    return;
  }
  if (!canUseLocalFallback() && canUseServerApi()) {
    els.authMessage.textContent = "Cloud signup is unavailable. Check the Vercel database environment variables and redeploy.";
    return;
  }

  const users = loadUsers();
  const existing = users.find((item) => item.username === username);
  if (existing) {
    els.authMessage.textContent = existing.status === "approved"
      ? "That username is already approved."
      : "That username already has a request on file.";
    return;
  }

  const salt = createSalt();
  users.push({
    id: crypto.randomUUID(),
    username,
    salt,
    passwordHash: await hashPassword(password, salt),
    role: "user",
    status: "pending",
    createdAt: new Date().toISOString(),
    displayName: username,
    notes: "",
    modulePermissions: defaultModulePermissions,
    lastLoginAt: null
  });
  persist(STORAGE_KEYS.users, users);
  els.signupForm.reset();
  switchAuthView("login");
  els.authMessage.textContent = "Request submitted. Brodie can approve it in the admin console.";
}

async function setAuthenticatedUser(user, options = {}) {
  authState.currentUser = normalizeProfileUser(user);
  state.positions = loadCurrentUserPositions();
  persist(STORAGE_KEYS.sessionUser, authState.currentUser);
  document.body.classList.remove("locked");
  els.currentUserLabel.textContent = authState.currentUser.displayName || authState.currentUser.username;
  renderAdminAccess();
  renderModuleAccess();
  renderAll();
  if (options.cloud) {
    await loadCloudDashboardState();
    renderAll();
  }
}

function lockDashboard() {
  authState.currentUser = null;
  state.positions = [];
  localStorage.removeItem(STORAGE_KEYS.sessionUser);
  document.body.classList.add("locked");
  els.currentUserLabel.textContent = "Locked";
  renderAdminAccess();
  renderModuleAccess();
}

async function logout() {
  if (cloudState.enabled) {
    await logoutCloud();
  }
  lockDashboard();
  switchAuthView("login");
  els.authMessage.textContent = "Logged out.";
}

function renderAdminAccess() {
  const isAdmin = authState.currentUser?.role === "admin";
  document.querySelectorAll(".admin-nav, .admin-panel").forEach((node) => {
    node.classList.toggle("hidden", !isAdmin);
  });
  renderAdminConsole();
}

function renderModuleAccess() {
  const user = authState.currentUser;
  const allowed = user?.role === "admin"
    ? modulePermissions.map((permission) => permission.id)
    : user?.modulePermissions || [];
  document.querySelectorAll("[data-route-link]").forEach((link) => {
    const route = link.dataset.routeLink;
    const visible = Boolean(user && allowed.includes(route) && (route !== "admin" || user.role === "admin"));
    link.classList.toggle("hidden", !visible);
  });
}

function renderAdminConsole() {
  if (!els.adminRequests) return;
  const users = (cloudState.users || loadUsers()).map(normalizeProfileUser).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const pending = users.filter((user) => user.status === "pending").length;
  const approved = users.filter((user) => user.status === "approved").length + 1;
  els.pendingCount.textContent = String(pending);
  els.approvedCount.textContent = String(approved);

  if (!users.length) {
    els.adminRequests.innerHTML = `<div class="empty-state">No user requests yet.</div>`;
    return;
  }

  els.adminRequests.innerHTML = users.map((user) => `
    <article class="admin-request">
      <div class="admin-user-main">
        <div class="admin-user-title">
          <div>
            <strong>${escapeHtml(user.displayName || user.username)}</strong>
            <span>@${escapeHtml(user.username)} / Requested ${formatRequestDate(user.createdAt)}</span>
            <span>Last login: ${escapeHtml(formatOptionalDate(user.lastLoginAt))}</span>
          </div>
          <span class="status-pill ${escapeHtml(user.status)}">${escapeHtml(user.status)}</span>
        </div>
        <form class="admin-profile-form" data-profile-user="${escapeHtml(user.id)}">
          <label class="field">
            <span>Display Name</span>
            <input name="displayName" value="${escapeHtml(user.displayName || "")}" maxlength="80">
          </label>
          <label class="field">
            <span>Role</span>
            <select name="role">
              ${["user", "viewer", "editor"].map((role) => `
                <option value="${role}" ${user.role === role ? "selected" : ""}>${role}</option>
              `).join("")}
            </select>
          </label>
          <label class="field admin-notes-field">
            <span>Notes</span>
            <textarea name="notes" rows="2" maxlength="800">${escapeHtml(user.notes || "")}</textarea>
          </label>
          <div class="admin-permissions" aria-label="Module permissions">
            ${modulePermissions.map((permission) => `
              <label>
                <input type="checkbox" name="modulePermissions" value="${escapeHtml(permission.id)}" ${user.modulePermissions.includes(permission.id) ? "checked" : ""}>
                <span>${escapeHtml(permission.label)}</span>
              </label>
            `).join("")}
          </div>
          <div class="admin-profile-actions">
            <button class="secondary-btn" type="submit">Save Profile</button>
            <span>${escapeHtml(formatReviewMeta(user))}</span>
          </div>
        </form>
      </div>
      <div class="admin-actions">
        <button class="secondary-btn" data-approve-user="${escapeHtml(user.id)}" type="button">Approve</button>
        <button class="delete-btn" data-deny-user="${escapeHtml(user.id)}" type="button">Deny</button>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-approve-user]").forEach((button) => {
    button.addEventListener("click", () => updateUserStatus(button.dataset.approveUser, "approved"));
  });
  document.querySelectorAll("[data-deny-user]").forEach((button) => {
    button.addEventListener("click", () => updateUserStatus(button.dataset.denyUser, "denied"));
  });
  document.querySelectorAll("[data-profile-user]").forEach((form) => {
    form.addEventListener("submit", updateUserProfile);
  });
}

async function updateUserStatus(id, status) {
  const cloudUsers = await updateCloudUserStatus(id, status);
  if (cloudUsers) {
    renderAdminConsole();
    return;
  }

  const users = loadUsers().map((user) => {
    if (user.id !== id) return user;
    return { ...user, status, reviewedAt: new Date().toISOString(), reviewedBy: ADMIN_ACCOUNT.username };
  });
  persist(STORAGE_KEYS.users, users);
  renderAdminConsole();
}

async function updateUserProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.dataset.profileUser;
  const data = new FormData(form);
  const profile = {
    displayName: String(data.get("displayName") || "").trim(),
    role: String(data.get("role") || "user"),
    notes: String(data.get("notes") || "").trim(),
    modulePermissions: data.getAll("modulePermissions")
  };

  const cloudUsers = await updateCloudUserProfile(id, profile);
  if (cloudUsers) {
    renderAdminConsole();
    return;
  }

  const users = loadUsers().map((user) => {
    if (user.id !== id) return user;
    return normalizeProfileUser({ ...user, ...profile });
  });
  persist(STORAGE_KEYS.users, users);
  renderAdminConsole();
}

function isKnownUser(username, role) {
  if (role === "admin" && username === ADMIN_ACCOUNT.username) return true;
  return loadUsers().some((user) => user.username === username && user.status === "approved");
}

function loadUsers() {
  return loadJson(STORAGE_KEYS.users, []);
}

async function fetchCloudAuthStatus() {
  if (!canUseServerApi()) return null;
  try {
    const response = await fetch("/api/auth", { credentials: "same-origin" });
    if (!response.ok) return null;
    const payload = await response.json();
    cloudState.enabled = Boolean(payload.available);
    cloudState.users = payload.users || cloudState.users;
    return payload;
  } catch (error) {
    console.warn("BrodieDash cloud auth unavailable:", error.message);
    cloudState.enabled = false;
    return null;
  }
}

async function loginWithCloud(username, password) {
  if (!canUseServerApi()) return { handled: false };
  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", username, password })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (!cloudState.enabled && (response.status === 404 || response.status === 405 || response.status === 501 || response.status >= 500)) {
        return { handled: false };
      }
      cloudState.enabled = true;
      return { handled: true, error: payload.error || "Cloud login failed." };
    }
    cloudState.enabled = true;
    return { handled: true, user: payload.user, users: payload.users || null };
  } catch (error) {
    console.warn("BrodieDash cloud login unavailable:", error.message);
    return { handled: false };
  }
}

async function signupWithCloud(username, password) {
  if (!cloudState.enabled || !canUseServerApi()) return { handled: false };
  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signup", username, password })
    });
    const payload = await response.json().catch(() => ({}));
    return {
      handled: true,
      ok: response.ok,
      message: payload.message || payload.error || "Signup request could not be submitted."
    };
  } catch (error) {
    console.warn("BrodieDash cloud signup unavailable:", error.message);
    return { handled: false };
  }
}

async function logoutCloud() {
  try {
    await fetch("/api/auth", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" })
    });
  } catch (error) {
    console.warn("BrodieDash cloud logout unavailable:", error.message);
  }
}

async function updateCloudUserStatus(id, status) {
  if (!cloudState.enabled || !canUseServerApi()) return null;
  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update-user", id, status })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Cloud user update failed.");
    cloudState.users = payload.users || [];
    return cloudState.users;
  } catch (error) {
    console.warn("BrodieDash cloud user update unavailable:", error.message);
    return null;
  }
}

async function updateCloudUserProfile(id, profile) {
  if (!cloudState.enabled || !canUseServerApi()) return null;
  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update-profile", id, ...profile })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Cloud profile update failed.");
    cloudState.users = payload.users || [];
    return cloudState.users;
  } catch (error) {
    console.warn("BrodieDash cloud profile update unavailable:", error.message);
    return null;
  }
}

function getCurrentUserFinanceKey() {
  const username = authState.currentUser?.username ? normalizeUsername(authState.currentUser.username) : "locked";
  return `${STORAGE_KEYS.positions}.${username}`;
}

function loadCurrentUserPositions() {
  if (!authState.currentUser) return [];
  return loadJson(getCurrentUserFinanceKey(), []);
}

function persistCurrentUserPositions(options = {}) {
  if (!authState.currentUser) return;
  persist(getCurrentUserFinanceKey(), state.positions);
  if (!options.localOnly) scheduleCloudDashboardSave();
}

async function loadCloudDashboardState() {
  if (!cloudState.enabled || !authState.currentUser || !canUseServerApi()) return;
  try {
    const response = await fetch("/api/dashboard-state", { credentials: "same-origin" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Cloud dashboard load failed.");
    if (!payload.exists || !payload.payload) {
      scheduleCloudDashboardSave({ immediate: true });
      return;
    }
    applyCloudDashboardPayload(payload.payload);
  } catch (error) {
    console.warn("BrodieDash cloud dashboard unavailable:", error.message);
  }
}

function applyCloudDashboardPayload(payload) {
  if (Array.isArray(payload.positions)) {
    state.positions = payload.positions;
    persistCurrentUserPositions({ localOnly: true });
  }
  if (Array.isArray(payload.tasks)) {
    state.tasks = payload.tasks;
    persist(STORAGE_KEYS.tasks, state.tasks);
  }
  if (Array.isArray(payload.roadmap)) {
    state.roadmap = payload.roadmap;
    persist(STORAGE_KEYS.roadmap, state.roadmap);
  }
}

function scheduleCloudDashboardSave(options = {}) {
  if (!cloudState.enabled || !authState.currentUser || !canUseServerApi()) return;
  window.clearTimeout(cloudState.saveTimer);
  cloudState.saveTimer = window.setTimeout(saveCloudDashboardState, options.immediate ? 0 : 450);
}

async function saveCloudDashboardState() {
  if (!cloudState.enabled || !authState.currentUser || !canUseServerApi()) return;
  try {
    const response = await fetch("/api/dashboard-state", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: {
          positions: state.positions,
          tasks: state.tasks,
          roadmap: state.roadmap
        }
      })
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Cloud dashboard save failed.");
    }
  } catch (error) {
    console.warn("BrodieDash cloud save unavailable:", error.message);
  }
}

function normalizeUsername(value) {
  return String(value).trim().toLowerCase();
}

function createSalt() {
  if (!crypto.getRandomValues) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
  if (!crypto.subtle || typeof TextEncoder === "undefined") {
    let hash = 2166136261;
    const value = `${salt}:${password}`;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchOpenRouterModels() {
  const key = getOpenRouterKey();
  const serverApi = canUseServerApi() && !key;
  if (!serverApi && !key) {
    setModelOptions(fallbackModels, localStorage.getItem(STORAGE_KEYS.model) || fallbackModels[0]);
    els.aiOutput.textContent = "Add your OpenRouter key to config.local.js.";
    els.modelSyncProgress.value = 32;
    return;
  }

  els.aiLinkStatus.textContent = "Syncing";
  els.modelSyncProgress.value = 56;
  try {
    const response = serverApi
      ? await fetch("/api/openrouter-models")
      : await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json"
        }
      });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Model sync failed ${response.status}: ${errorText.slice(0, 180)}`);
    }
    const payload = await response.json();
    const models = (payload.data || [])
      .map((model) => model.id)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    const availableModels = fallbackModels.filter((model) => models.includes(model));
    setModelOptions(availableModels.length ? availableModels : fallbackModels, localStorage.getItem(STORAGE_KEYS.model));
    els.aiLinkStatus.textContent = "Online";
    els.modelSyncProgress.value = 100;
  } catch (error) {
    els.aiLinkStatus.textContent = "Fallback";
    els.modelSyncProgress.value = 42;
    setModelOptions(fallbackModels, localStorage.getItem(STORAGE_KEYS.model) || fallbackModels[0]);
    els.aiOutput.textContent = `${error.message}\nUsing fallback model list.`;
  }
}

function setModelOptions(models, selectedModel) {
  const selected = selectedModel && models.includes(selectedModel) ? selectedModel : models[0];
  els.modelSelect.innerHTML = models
    .map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(modelLabels[model] || model)}</option>`)
    .join("");
  els.modelSelect.value = selected;
  localStorage.setItem(STORAGE_KEYS.model, selected);
}

async function runAiCommand() {
  const key = getOpenRouterKey();
  const serverApi = canUseServerApi() && !key;
  const prompt = els.aiPrompt.value.trim();
  if (!serverApi && !key) {
    els.aiOutput.textContent = "Add your OpenRouter key to config.local.js.";
    return;
  }
  if (!prompt) {
    els.aiOutput.textContent = "Enter a command first.";
    return;
  }

  els.runAiBtn.disabled = true;
  els.runAiBtn.textContent = "Running";
  els.aiOutput.textContent = "Reading command...";

  try {
    const financeUpdate = await maybeApplyFinanceUpdate(prompt, key, serverApi);
    els.aiOutput.textContent = "Contacting OpenRouter...";
    const messages = [
      {
        role: "system",
        content: "You are the AI layer inside BrodieDash. Be concise, operational, and specific. Avoid pretending to have live financial data unless supplied in context."
      },
      {
        role: "user",
        content: els.includeContext.checked ? `${prompt}\n\nDashboard context:\n${buildDashboardContext()}` : prompt
      }
    ];
    const payload = await sendOpenRouterChat({ key, serverApi, messages, temperature: 0.35 });
    const answer = payload.choices?.[0]?.message?.content || "No response content returned.";
    els.aiOutput.textContent = financeUpdate ? `${financeUpdate}\n\n${answer}` : answer;
  } catch (error) {
    els.aiOutput.textContent = error.message;
  } finally {
    els.runAiBtn.disabled = false;
    els.runAiBtn.textContent = "Run Analysis";
  }
}

async function sendOpenRouterChat({ key, serverApi, messages, temperature = 0.35 }) {
  const response = serverApi
    ? await fetch("/api/openrouter-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: els.modelSelect.value,
        messages,
        temperature
      })
    })
    : await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.href,
        "X-OpenRouter-Title": "BrodieDash"
      },
      body: JSON.stringify({
        model: els.modelSelect.value,
        messages,
        temperature
      })
    });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${errorText.slice(0, 240)}`);
  }

  return response.json();
}

async function maybeApplyFinanceUpdate(prompt, key, serverApi) {
  if (!authState.currentUser || !shouldAttemptFinanceExtraction(prompt)) return "";
  els.aiOutput.textContent = "Updating finance profile...";
  try {
    const payload = await sendOpenRouterChat({
      key,
      serverApi,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: [
            "Extract investment positions for BrodieDash from the user's command.",
            "Return only JSON with this shape:",
            '{"mode":"none|upsert|replace|clear","positions":[{"symbol":"AAPL","name":"Apple","qty":10,"avg":150,"price":175}],"notes":[]}',
            "Use mode clear only when the user asks to clear/reset/delete all finance positions.",
            "Use mode replace when the user says this is the full/new portfolio.",
            "Use mode upsert when the user adds or updates holdings.",
            "Do not invent live prices. If only current value is supplied, use qty 1 and avg/price equal to that value.",
            "If the prompt is not about the user's own holdings, return mode none with an empty positions array."
          ].join(" ")
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });
    const content = payload.choices?.[0]?.message?.content || "";
    return applyFinanceExtraction(parseAiJson(content));
  } catch (error) {
    return `Finance update skipped: ${error.message}`;
  }
}

function shouldAttemptFinanceExtraction(prompt) {
  return /\b(portfolio|invest|investment|investments|stock|stocks|shares|share|etf|fund|crypto|holding|holdings|position|positions|bought|buy|own|ticker|avg|average|cost basis|allocation|finance|finances)\b/i.test(prompt);
}

function parseAiJson(content) {
  const text = String(content).trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI did not return finance JSON.");
    return JSON.parse(match[0]);
  }
}

function applyFinanceExtraction(extraction) {
  const mode = String(extraction?.mode || "none").toLowerCase();
  if (mode === "none") return "";

  if (mode === "clear") {
    state.positions = [];
    persistCurrentUserPositions();
    renderAll();
    return "Finance tab updated: cleared personal positions.";
  }

  const positions = Array.isArray(extraction?.positions)
    ? extraction.positions.map(normalizeExtractedPosition).filter(Boolean)
    : [];
  if (!positions.length) return "Finance update skipped: no complete positions were found.";

  if (mode === "replace") {
    state.positions = positions.map((position) => ({ ...position, id: crypto.randomUUID() }));
  } else {
    const next = [...state.positions];
    positions.forEach((position) => {
      const index = next.findIndex((item) => item.symbol === position.symbol);
      if (index >= 0) {
        next[index] = { ...next[index], ...position, id: next[index].id };
      } else {
        next.push({ ...position, id: crypto.randomUUID() });
      }
    });
    state.positions = next;
  }

  persistCurrentUserPositions();
  renderAll();
  return `Finance tab updated: ${positions.map((position) => position.symbol).join(", ")}.`;
}

function normalizeExtractedPosition(raw) {
  const symbol = String(raw?.symbol || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "")
    .slice(0, 12);
  if (!symbol) return null;

  const value = readPositiveNumber(raw?.value ?? raw?.currentValue ?? raw?.amount);
  let qty = readPositiveNumber(raw?.qty ?? raw?.quantity ?? raw?.shares ?? raw?.units);
  let avg = readNonNegativeNumber(raw?.avg ?? raw?.averageCost ?? raw?.costBasis ?? raw?.cost);
  let price = readNonNegativeNumber(raw?.price ?? raw?.currentPrice ?? raw?.marketPrice);

  if (qty === null && value !== null) {
    qty = 1;
    avg = avg ?? value;
    price = price ?? value;
  }
  if (qty === null) return null;
  if (price === null && avg !== null) price = avg;
  if (avg === null && price !== null) avg = price;
  if (avg === null || price === null) return null;

  return {
    symbol,
    name: String(raw?.name || symbol).trim().slice(0, 64) || symbol,
    qty,
    avg,
    price
  };
}

function readPositiveNumber(value) {
  const number = Number(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function readNonNegativeNumber(value) {
  const number = Number(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function renderFinance() {
  const hasPositions = state.positions.length > 0;
  const total = state.positions.reduce((sum, item) => sum + item.qty * item.price, 0);
  const cost = state.positions.reduce((sum, item) => sum + item.qty * item.avg, 0);
  const pnl = total - cost;
  const pnlPct = cost ? (pnl / cost) * 100 : 0;
  const positionStats = state.positions.map((item, index) => {
    const value = item.qty * item.price;
    const itemCost = item.qty * item.avg;
    const itemPnl = value - itemCost;
    const itemPnlPct = itemCost ? (itemPnl / itemCost) * 100 : 0;
    const allocation = total ? (value / total) * 100 : 0;
    return { ...item, value, itemCost, itemPnl, itemPnlPct, allocation, color: financeColor(index) };
  });
  const largest = positionStats.reduce((top, item) => item.value > (top?.value || 0) ? item : top, null);
  const largestAllocation = largest ? largest.allocation : 0;
  const cashLike = positionStats.filter((item) => /^(CASH|SGOV|BIL|TBIL|USFR|VMFXX)$/i.test(item.symbol));
  const cashValue = cashLike.reduce((sum, item) => sum + item.value, 0);
  const diversification = hasPositions
    ? Math.max(0, Math.min(100, Math.round(100 - largestAllocation + Math.min(positionStats.length, 8) * 3)))
    : 0;
  const healthLabel = !hasPositions ? "--" : largestAllocation > 45 ? "Tight" : largestAllocation > 28 ? "Stable" : "Wide";
  const financeModeChip = document.querySelector(".position-toolbar .chip");
  if (financeModeChip) {
    financeModeChip.textContent = authState.currentUser ? `${authState.currentUser.username} ledger` : "Personal ledger";
  }

  els.totalValue.textContent = formatCurrency(total);
  els.portfolioValue.textContent = formatCurrency(total);
  els.unrealizedPnL.textContent = `${formatCurrency(pnl)} (${pnlPct.toFixed(1)}%)`;
  els.unrealizedPnL.className = pnl >= 0 ? "gain" : "loss";
  els.pnlPill.textContent = hasPositions ? `${pnl >= 0 ? "+" : ""}${formatCurrency(pnl)} / ${pnlPct.toFixed(1)}%` : "$0";
  els.pnlPill.className = `finance-pill ${pnl >= 0 ? "gain-pill" : "loss-pill"}`;
  els.portfolioDelta.textContent = !hasPositions
    ? "No personal positions"
    : pnl >= 0 ? `${pnlPct.toFixed(1)}% unrealized gain` : `${Math.abs(pnlPct).toFixed(1)}% unrealized drawdown`;
  els.portfolioDelta.className = pnl >= 0 ? "gain" : "loss";
  els.riskTilt.textContent = !hasPositions ? "Empty" : largestAllocation > 45 ? "Concentrated" : largestAllocation > 28 ? "Moderate" : "Balanced";
  els.riskTilt.className = "finance-pill";
  els.cashReserve.textContent = formatCurrency(cashValue);
  els.diversificationScore.textContent = `${diversification}%`;
  els.financeHealth.textContent = healthLabel;
  els.largestPosition.textContent = largest
    ? `${largest.symbol} leads at ${largest.allocation.toFixed(1)}% of the portfolio.`
    : "No personal positions loaded.";
  els.allocationSummary.textContent = largest
    ? `${positionStats.length} assets / ${largest.symbol} largest`
    : "No assets";
  els.positionSummary.textContent = `${positionStats.length} tracked asset${positionStats.length === 1 ? "" : "s"}`;
  els.allocationRing.style.background = buildAllocationGradient(positionStats);

  els.allocationBars.innerHTML = hasPositions ? positionStats.map((item) => `
    <div class="allocation-bar">
      <div>
        <strong>${escapeHtml(item.symbol)}</strong>
        <span>${item.allocation.toFixed(1)}%</span>
      </div>
      <span class="allocation-track"><span style="width: ${item.allocation.toFixed(1)}%; background: ${item.color};"></span></span>
    </div>
  `).join("") : `<div class="empty-state">No personal allocation data.</div>`;

  els.positionsBody.innerHTML = hasPositions ? positionStats.map((item) => {
    return `
      <article class="position-card">
        <div class="position-main">
          <span class="asset-orb" style="--asset-color: ${item.color};">${escapeHtml(item.symbol.slice(0, 2))}</span>
          <span class="asset-name">
            <strong>${escapeHtml(item.symbol)}</strong>
            <span>${escapeHtml(item.name)}</span>
          </span>
        </div>
        <div class="position-spark" aria-hidden="true">${buildSparkline(item)}</div>
        <div class="position-metrics">
          <span><small>Qty</small><strong>${numberCompact(item.qty)}</strong></span>
          <span><small>Value</small><strong>${formatCurrency(item.value)}</strong></span>
          <span><small>P/L</small><strong class="${item.itemPnl >= 0 ? "gain" : "loss"}">${formatCurrency(item.itemPnl)}</strong></span>
          <span><small>Alloc</small><strong>${item.allocation.toFixed(1)}%</strong></span>
        </div>
        <div class="position-allocation">
          <span style="width: ${item.allocation.toFixed(1)}%; background: ${item.color};"></span>
        </div>
        <button class="delete-btn" data-delete-position="${item.id}" aria-label="Delete ${escapeHtml(item.symbol)}">X</button>
      </article>`;
  }).join("") : `<div class="empty-state">No positions saved for ${escapeHtml(authState.currentUser?.username || "this user")}.</div>`;

  document.querySelectorAll("[data-delete-position]").forEach((button) => {
    button.addEventListener("click", () => {
      state.positions = state.positions.filter((item) => item.id !== button.dataset.deletePosition);
      persistCurrentUserPositions();
      renderAll();
    });
  });

  renderFinanceRecommendations(positionStats, largestAllocation, pnlPct, cashValue, total);
}

function renderFinanceRecommendations(positionStats, largestAllocation, pnlPct, cashValue, total) {
  if (!positionStats.length) {
    els.financeRecommendations.innerHTML = `<div class="empty-state">No personal capital intelligence yet.</div>`;
    return;
  }

  const largest = positionStats.reduce((top, item) => item.value > (top?.value || 0) ? item : top, null);
  const cashPct = total ? (cashValue / total) * 100 : 0;
  const recs = [
    {
      title: largestAllocation > 45 ? "Concentration watch" : "Top allocation",
      body: largestAllocation > 45
        ? `${largest.symbol} is ${largest.allocation.toFixed(1)}% of this profile; review whether that matches the user's risk target.`
        : `${largest.symbol} leads at ${largest.allocation.toFixed(1)}%, with ${positionStats.length} tracked position${positionStats.length === 1 ? "" : "s"}.`
    },
    {
      title: cashPct < 5 ? "Cash reserve low" : "Cash reserve",
      body: cashPct < 5
        ? `Cash-like holdings are ${cashPct.toFixed(1)}% of the portfolio.`
        : `Cash-like holdings are ${cashPct.toFixed(1)}% of the portfolio.`
    },
    {
      title: pnlPct < 0 ? "Drawdown status" : "Profit status",
      body: pnlPct < 0
        ? `Tracked cost basis shows a ${Math.abs(pnlPct).toFixed(1)}% unrealized drawdown.`
        : `Tracked cost basis shows a ${pnlPct.toFixed(1)}% unrealized gain.`
    }
  ];

  els.financeRecommendations.innerHTML = recs.map((rec) => `
    <div class="rec-card">
      <strong>${escapeHtml(rec.title)}</strong>
      <p>${escapeHtml(rec.body)}</p>
    </div>
  `).join("");
}

function getOpenRouterKey() {
  return HARDCODED_OPENROUTER_API_KEY.trim();
}

function canUseServerApi() {
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

function canUseLocalFallback() {
  return window.location.protocol === "file:"
    || window.location.hostname === "localhost"
    || window.location.hostname === "127.0.0.1"
    || window.location.hostname === "::1";
}

function financeColor(index) {
  return ["#36e6ff", "#61ff9b", "#ffbf5f", "#f36cff", "#ff5d78", "#8ea4ff", "#7dffdf"][index % 7];
}

function buildAllocationGradient(positionStats) {
  if (!positionStats.length) {
    return "conic-gradient(rgba(154, 167, 173, 0.2) 0 100%)";
  }

  let cursor = 0;
  const stops = positionStats.map((item) => {
    const start = cursor;
    cursor += item.allocation;
    return `${item.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function buildSparkline(item) {
  const seed = item.symbol.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Array.from({ length: 16 }, (_, index) => {
    const wave = Math.sin((seed + index * 17) * 0.34) * 18;
    const trend = Math.max(-18, Math.min(18, item.itemPnlPct)) * (index / 16);
    const height = Math.max(18, Math.min(82, 44 + wave + trend));
    return `<span style="height: ${height.toFixed(0)}%;"></span>`;
  }).join("");
}

function addPosition(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.positions.push({
    id: crypto.randomUUID(),
    symbol: String(data.get("symbol")).trim().toUpperCase(),
    name: String(data.get("name")).trim(),
    qty: Number(data.get("qty")),
    avg: Number(data.get("avg")),
    price: Number(data.get("price"))
  });
  persistCurrentUserPositions();
  event.currentTarget.reset();
  renderAll();
}

function simulatePriceTick() {
  state.positions = state.positions.map((position) => {
    const movement = 1 + (Math.random() - 0.47) * 0.065;
    return { ...position, price: Math.max(0.01, Number((position.price * movement).toFixed(2))) };
  });
  persistCurrentUserPositions();
  renderAll();
}

function renderCalendar() {
  const date = state.currentMonth;
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const today = toDateInput(new Date());

  els.monthLabel.textContent = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date);

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const cells = weekdays.map((day) => `<div class="weekday">${day}</div>`);
  for (let i = 0; i < 42; i += 1) {
    const cellDate = addDays(start, i);
    const iso = toDateInput(cellDate);
    const dayTasks = state.tasks.filter((task) => task.date === iso);
    const classes = ["day"];
    if (cellDate.getMonth() !== month) classes.push("muted");
    if (iso === today) classes.push("today");
    if (iso === state.selectedDate) classes.push("selected");
    cells.push(`
      <button class="${classes.join(" ")}" data-select-date="${iso}" type="button">
        <span class="date-num">${cellDate.getDate()}</span>
        ${dayTasks.slice(0, 2).map((task) => `<span class="task-dot ${task.priority.toLowerCase()}">${escapeHtml(task.title)}</span>`).join("")}
        ${dayTasks.length > 2 ? `<span class="chip">+${dayTasks.length - 2}</span>` : ""}
      </button>
    `);
  }
  els.calendarGrid.innerHTML = cells.join("");
  document.querySelectorAll("[data-select-date]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDate = button.dataset.selectDate;
      els.taskForm.elements.date.value = state.selectedDate;
      renderCalendar();
      renderTasks();
    });
  });
}

function renderTasks() {
  const sorted = [...state.tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.date.localeCompare(b.date);
  });
  const selectedTasks = sorted.filter((task) => task.date === state.selectedDate);
  const visibleTasks = selectedTasks.length ? selectedTasks : sorted.slice(0, 8);

  els.taskList.innerHTML = visibleTasks.map((task) => `
    <div class="task-item ${task.done ? "done" : ""}">
      <input type="checkbox" ${task.done ? "checked" : ""} data-toggle-task="${task.id}" aria-label="Complete ${escapeHtml(task.title)}">
      <span class="task-title">
        <strong>${escapeHtml(task.title)}</strong>
        <span>${formatDate(task.date)}</span>
      </span>
      <span class="chip">${escapeHtml(task.priority)}</span>
      <button class="delete-btn" data-delete-task="${task.id}" aria-label="Delete task">×</button>
    </div>
  `).join("");

  document.querySelectorAll("[data-toggle-task]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      state.tasks = state.tasks.map((task) => task.id === checkbox.dataset.toggleTask ? { ...task, done: checkbox.checked } : task);
      persist(STORAGE_KEYS.tasks, state.tasks);
      scheduleCloudDashboardSave();
      renderAll();
    });
  });

  document.querySelectorAll("[data-delete-task]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tasks = state.tasks.filter((task) => task.id !== button.dataset.deleteTask);
      persist(STORAGE_KEYS.tasks, state.tasks);
      scheduleCloudDashboardSave();
      renderAll();
    });
  });
}

function addTask(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.tasks.push({
    id: crypto.randomUUID(),
    title: String(data.get("title")).trim(),
    date: String(data.get("date")),
    priority: String(data.get("priority")),
    done: false
  });
  state.selectedDate = String(data.get("date"));
  persist(STORAGE_KEYS.tasks, state.tasks);
  scheduleCloudDashboardSave();
  event.currentTarget.reset();
  event.currentTarget.elements.date.value = state.selectedDate;
  renderAll();
}

function renderFeatures() {
  els.featureList.innerHTML = recommendedModules.map((feature) => {
    const pinned = state.roadmap.includes(feature.title);
    return `
      <div class="feature-card">
        <div>
          <strong>${escapeHtml(feature.title)}</strong>
          <p>${escapeHtml(feature.description)}</p>
          <div class="feature-meta">${feature.tags.map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`).join("")}</div>
        </div>
        <button class="${pinned ? "primary-btn" : "secondary-btn"}" data-pin-feature="${escapeHtml(feature.title)}">${pinned ? "Pinned" : "Pin"}</button>
      </div>
    `;
  }).join("");

  document.querySelectorAll("[data-pin-feature]").forEach((button) => {
    button.addEventListener("click", () => {
      const title = button.dataset.pinFeature;
      state.roadmap = state.roadmap.includes(title)
        ? state.roadmap.filter((item) => item !== title)
        : [...state.roadmap, title];
      persist(STORAGE_KEYS.roadmap, state.roadmap);
      scheduleCloudDashboardSave();
      renderAll();
    });
  });
}

function renderPulse() {
  const activeTasks = state.tasks.filter((task) => !task.done).length;
  const highPriority = state.tasks.filter((task) => !task.done && task.priority === "High").length;
  els.taskCount.textContent = String(activeTasks);
  els.taskDelta.textContent = highPriority ? `${highPriority} high-priority active` : "No high-priority pressure";
  els.roadmapCount.textContent = String(state.roadmap.length);
  const focus = Math.min(100, activeTasks * 9 + highPriority * 12 + state.roadmap.length * 4);
  els.focusLoad.textContent = `${focus}%`;
  els.automationScore.textContent = String(Math.max(48, 82 - activeTasks * 2 + state.roadmap.length * 3));
}

function updateSystems() {
  const activeTasks = state.tasks.filter((task) => !task.done).length;
  const total = state.positions.reduce((sum, item) => sum + item.qty * item.price, 0);
  const largestAllocation = total ? Math.max(...state.positions.map((item) => (item.qty * item.price) / total)) * 100 : 0;
  els.calendarPressure.value = Math.min(100, activeTasks * 11);
  els.portfolioDrift.value = Math.min(100, largestAllocation);
  els.roadmapClarity.value = Math.min(100, 18 + state.roadmap.length * 14);
}

function changeMonth(offset) {
  state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + offset, 1);
  renderCalendar();
}

function buildDashboardContext() {
  const username = authState.currentUser?.username || "Locked";
  const positions = state.positions.length
    ? state.positions.map((item) => `${item.symbol}: qty ${item.qty}, avg ${item.avg}, price ${item.price}`).join("\n")
    : "No personal positions saved";
  const tasks = state.tasks.map((task) => `${task.date} | ${task.priority} | ${task.done ? "done" : "open"} | ${task.title}`).join("\n");
  const roadmap = state.roadmap.length ? state.roadmap.join(", ") : "No pinned modules";
  return `Current user: ${username}\n\nPositions:\n${positions}\n\nTasks:\n${tasks}\n\nPinned roadmap modules:\n${roadmap}`;
}

function startClock() {
  const tick = () => {
    els.clock.textContent = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date());
  };
  tick();
  setInterval(tick, 1000);
}

function startCanvases() {
  startSignalCanvas();
  startRadarCanvas();
}

function startSignalCanvas() {
  const canvas = document.getElementById("signalCanvas");
  const ctx = canvas.getContext("2d");
  let points = [];

  function resize() {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    points = Array.from({ length: Math.min(90, Math.floor(window.innerWidth / 18)) }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.strokeStyle = "rgba(54, 230, 255, 0.16)";
    ctx.fillStyle = "rgba(97, 255, 155, 0.5)";
    points.forEach((point, index) => {
      point.x += point.vx;
      point.y += point.vy;
      if (point.x < 0 || point.x > window.innerWidth) point.vx *= -1;
      if (point.y < 0 || point.y > window.innerHeight) point.vy *= -1;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
      for (let j = index + 1; j < points.length; j += 1) {
        const other = points[j];
        const dx = point.x - other.x;
        const dy = point.y - other.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 112) {
          ctx.globalAlpha = 1 - dist / 112;
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(other.x, other.y);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    });
    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", resize);
  draw();
}

function startRadarCanvas() {
  const canvas = document.getElementById("radarCanvas");
  const ctx = canvas.getContext("2d");
  let angle = 0;

  function draw() {
    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.38;
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(54, 230, 255, 0.28)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i += 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius * (i / 4), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI * 2 * i) / 8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      ctx.stroke();
    }

    const gradient = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    gradient.addColorStop(0, "rgba(97, 255, 155, 0.9)");
    gradient.addColorStop(1, "rgba(54, 230, 255, 0)");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.stroke();

    const dots = [
      [0.35, 0.8, "#36e6ff"],
      [0.62, 2.1, "#ffbf5f"],
      [0.78, 3.8, "#f36cff"],
      [0.48, 5.1, "#61ff9b"]
    ];
    dots.forEach(([r, a, color]) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * radius * r, cy + Math.sin(a) * radius * r, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    angle += 0.018;
    requestAnimationFrame(draw);
  }

  draw();
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function persist(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function toDateInput(date) {
  const copy = new Date(date);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function numberCompact(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value || 0);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function formatRequestDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatOptionalDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatReviewMeta(user) {
  if (!user.reviewedAt) return "Not reviewed";
  return `Reviewed ${formatOptionalDate(user.reviewedAt)} by ${user.reviewedBy || "admin"}`;
}

function normalizeProfileUser(user) {
  const isAdmin = user.role === "admin";
  const moduleList = Array.isArray(user.modulePermissions)
    ? user.modulePermissions
    : isAdmin ? modulePermissions.map((permission) => permission.id) : defaultModulePermissions;
  return {
    ...user,
    role: ["admin", "user", "viewer", "editor"].includes(user.role) ? user.role : "user",
    displayName: user.displayName || user.username,
    notes: user.notes || "",
    modulePermissions: modulePermissions
      .map((permission) => permission.id)
      .filter((permission) => moduleList.includes(permission)),
    lastLoginAt: user.lastLoginAt || null
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
