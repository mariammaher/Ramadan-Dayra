const STORAGE_KEY = "el_dayra_state_v1";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RAMADAN_START = "2026-02-18";
const RAMADAN_END = "2026-03-19";
const RAMADAN_DATES = buildDateRange(RAMADAN_START, RAMADAN_END);
const RAMADAN_RANGE_LABEL = "Feb 18 - Mar 19, 2026";
const CLOUD_SYNC_INTERVAL_MS = 15000;

// Set this to your Firebase Realtime Database URL to sync profiles across devices.
// Example: https://your-project-id-default-rtdb.firebaseio.com
const FIREBASE_DB_URL = "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com";

const DEFAULT_SHARED_EVENTS = [
  {
    date: "2026-03-07",
    title: "Zayed's",
    category: "Iftar",
    place: "Zayed's",
  },
  {
    date: "2026-03-09",
    title: "Mahfouz's",
    category: "Iftar",
    place: "Mahfouz's",
  },
  {
    date: "2026-03-10",
    title: "Asafirso's",
    category: "Iftar",
    place: "Asafirso's",
  },
  {
    date: "2026-03-12",
    title: "Zoghlof's",
    category: "Iftar",
    place: "Zoghlof's",
  },
  {
    date: "2026-03-13",
    title: "Giratallah's",
    category: "Sohour",
    place: "Giratallah's",
  },
];

const state = {
  users: [],
  userPins: {},
  pendingUser: "",
  currentUser: "",
  personalEventsByUser: {},
  selectedDate: RAMADAN_START,
  cloudConfigured: false,
  cloudHealthy: false,
  syncInFlight: false,
};

const el = {
  nameInput: document.getElementById("nameInput"),
  createPinInput: document.getElementById("createPinInput"),
  joinBtn: document.getElementById("joinBtn"),
  userSelect: document.getElementById("userSelect"),
  accessPinInput: document.getElementById("accessPinInput"),
  accessBtn: document.getElementById("accessBtn"),
  currentUserBadge: document.getElementById("currentUserBadge"),
  authHint: document.getElementById("authHint"),
  monthLabel: document.getElementById("monthLabel"),
  rangeLabel: document.getElementById("rangeLabel"),
  weekdays: document.getElementById("weekdays"),
  calendarGrid: document.getElementById("calendarGrid"),
  eventForm: document.getElementById("eventForm"),
  eventTitle: document.getElementById("eventTitle"),
  eventCategory: document.getElementById("eventCategory"),
  eventDate: document.getElementById("eventDate"),
  eventTime: document.getElementById("eventTime"),
  eventPlace: document.getElementById("eventPlace"),
  saveEventBtn: document.getElementById("saveEventBtn"),
  formHint: document.getElementById("formHint"),
  agendaDateLabel: document.getElementById("agendaDateLabel"),
  dayEventsList: document.getElementById("dayEventsList"),
  monthEventsList: document.getElementById("monthEventsList"),
};

init();

async function init() {
  loadState();
  applyRamadanConstraints();
  renderWeekdays();
  bindEvents();
  renderAll();
  await syncProfilesFromCloud({ announce: true });
  startProfileSync();
}

function bindEvents() {
  el.joinBtn.addEventListener("click", () => {
    void createProfile();
  });

  el.nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void createProfile();
    }
  });

  el.createPinInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void createProfile();
    }
  });

  el.userSelect.addEventListener("change", () => {
    state.pendingUser = el.userSelect.value;
    saveState();
  });

  el.accessBtn.addEventListener("click", () => {
    void unlockProfile();
  });

  el.accessPinInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void unlockProfile();
    }
  });

  el.calendarGrid.addEventListener("click", (event) => {
    const cell = event.target.closest(".day-cell");
    if (!cell || cell.classList.contains("placeholder")) return;

    const date = cell.dataset.date;
    if (!date || !isRamadanDate(date)) return;

    state.selectedDate = date;
    saveState();
    renderCalendar();
    renderAgenda();

    if (state.currentUser) {
      el.eventDate.value = date;
    }
  });

  el.eventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addPersonalEvent();
  });
}

async function createProfile() {
  const name = normalizeName(el.nameInput.value);
  const pin = el.createPinInput.value.trim();

  if (!name) {
    updateAuthHint("Type your name to create a profile.");
    return;
  }

  if (!isValidPin(pin)) {
    updateAuthHint("PIN must be exactly 4 digits.");
    return;
  }

  await syncProfilesFromCloud();
  const existingName = findExistingUserName(name);

  if (existingName) {
    state.pendingUser = existingName;
    saveState();
    renderUserSection();
    updateAuthHint("Profile already exists. Use Unlock with the correct PIN.");
    return;
  }

  state.users.push(name);
  state.userPins[name] = pin;
  state.pendingUser = name;
  state.currentUser = name;

  if (!state.personalEventsByUser[name]) {
    state.personalEventsByUser[name] = [];
  }

  el.nameInput.value = "";
  el.createPinInput.value = "";
  el.accessPinInput.value = "";
  updateAuthHint(`Profile created and unlocked for ${name}.`);
  saveState();
  renderAll();

  const cloudSaved = await saveProfileToCloud(name, pin);
  if (cloudSaved) {
    await syncProfilesFromCloud({ force: true });
    updateAuthHint(`Profile created and synced for everyone: ${name}.`);
  } else {
    updateAuthHint("Profile created on this device only. Configure cloud sync to share profiles.");
  }
}

async function unlockProfile() {
  const user = state.pendingUser || el.userSelect.value;
  const pin = el.accessPinInput.value.trim();

  if (!user) {
    updateAuthHint("Select a profile first.");
    return;
  }

  if (!isValidPin(pin)) {
    updateAuthHint("Enter a valid 4-digit PIN.");
    return;
  }

  await syncProfilesFromCloud();
  const matchedUser = findExistingUserName(user) || user;
  const savedPin = state.userPins[matchedUser];

  // Migration path for previously created profiles that had no PIN yet.
  if (!savedPin) {
    state.userPins[matchedUser] = pin;
    state.currentUser = matchedUser;
    state.pendingUser = matchedUser;
    el.accessPinInput.value = "";
    updateAuthHint(`PIN set and profile unlocked for ${matchedUser}.`);
    saveState();
    renderAll();
    await saveProfileToCloud(matchedUser, pin);
    await syncProfilesFromCloud({ force: true });
    return;
  }

  if (pin !== savedPin) {
    updateAuthHint("Incorrect PIN. Try again.");
    return;
  }

  state.currentUser = matchedUser;
  state.pendingUser = matchedUser;
  el.accessPinInput.value = "";
  updateAuthHint(`Profile unlocked for ${matchedUser}.`);
  saveState();
  renderAll();
}

function addPersonalEvent() {
  if (!state.currentUser) {
    updateHint("Unlock your profile first to add personal events.");
    return;
  }

  const title = el.eventTitle.value.trim();
  const category = el.eventCategory.value;
  const date = el.eventDate.value;
  const time = el.eventTime.value;
  const place = el.eventPlace.value.trim();

  if (!title || !date) {
    updateHint("Event name and date are required.");
    return;
  }

  if (!isRamadanDate(date)) {
    updateHint(`Date must be within Ramadan 2026 (${RAMADAN_RANGE_LABEL}).`);
    return;
  }

  const event = {
    id: `personal-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title,
    category,
    date,
    time: time || "",
    place: place || "",
    isShared: false,
    owner: state.currentUser,
  };

  const list = state.personalEventsByUser[state.currentUser] || [];
  list.push(event);
  state.personalEventsByUser[state.currentUser] = list;
  state.selectedDate = date;

  el.eventForm.reset();
  el.eventCategory.value = "Iftar";
  el.eventDate.value = date;
  updateHint("");
  saveState();
  renderAll();
}

function renderAll() {
  renderUserSection();
  renderCalendar();
  renderAgenda();
  refreshFormState();
}

function renderWeekdays() {
  el.weekdays.innerHTML = WEEKDAYS.map(
    (name) => `<div class="weekday">${name}</div>`
  ).join("");
}

function renderUserSection() {
  el.userSelect.innerHTML = ['<option value="">Select profile</option>']
    .concat(
      state.users.map((name) => {
        const selected = name === state.pendingUser ? "selected" : "";
        return `<option value="${escapeHtml(name)}" ${selected}>${escapeHtml(
          name
        )}</option>`;
      })
    )
    .join("");

  if (state.currentUser) {
    el.currentUserBadge.textContent = `Current profile: ${state.currentUser}`;
  } else {
    el.currentUserBadge.textContent = "No unlocked profile.";
  }

  el.monthLabel.textContent = "Ramadan 2026 Calendar";
  el.rangeLabel.textContent = RAMADAN_RANGE_LABEL;
}

function renderCalendar() {
  const firstWeekday = dateFromKey(RAMADAN_START).getDay();
  const prefixCount = firstWeekday;
  const totalUsed = prefixCount + RAMADAN_DATES.length;
  const suffixCount = (7 - (totalUsed % 7)) % 7;
  const cells = [];

  for (let i = 0; i < prefixCount; i += 1) {
    cells.push('<div class="day-cell placeholder" aria-hidden="true"></div>');
  }

  for (const date of RAMADAN_DATES) {
    const dayEvents = getEventsForDate(date);
    const parsed = parseDate(date);
    const isSelected = date === state.selectedDate;
    const isToday = date === todayKey();

    const classes = ["day-cell"];
    if (isSelected) classes.push("selected");
    if (isToday) classes.push("today");
    if (dayEvents.length > 0) classes.push("has-events");

    const preview = dayEvents.slice(0, 2).map(renderEventPill).join("");
    const more =
      dayEvents.length > 2
        ? `<span class="pill more">+${dayEvents.length - 2} more</span>`
        : "";
    const eventCountBadge = dayEvents.length
      ? `<span class="mobile-event-count">${dayEvents.length}</span>`
      : "";

    cells.push(`
      <button class="${classes.join(" ")}" type="button" data-date="${date}">
        <div class="day-head">
          <span class="day-number">${parsed.day}</span>
          <span class="day-month">${monthShort(parsed.month)}</span>
          ${eventCountBadge}
        </div>
        <div class="pill-row">${preview}${more}</div>
      </button>
    `);
  }

  for (let i = 0; i < suffixCount; i += 1) {
    cells.push('<div class="day-cell placeholder" aria-hidden="true"></div>');
  }

  el.calendarGrid.innerHTML = cells.join("");
}

function renderEventPill(event) {
  const categoryClass = event.category === "Sohour" ? "sohour" : "iftar";
  const sharedClass = event.isShared ? "shared" : "";
  return `<span class="pill ${categoryClass} ${sharedClass}">${escapeHtml(
    event.title
  )}</span>`;
}

function renderAgenda() {
  if (!state.selectedDate) return;

  const selected = parseDate(state.selectedDate);
  const dateObj = new Date(selected.year, selected.month - 1, selected.day);
  el.agendaDateLabel.textContent = dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const dayEvents = getEventsForDate(state.selectedDate);
  const ramadanEvents = getAllRamadanEvents();

  el.dayEventsList.innerHTML = dayEvents.length
    ? dayEvents.map((event) => renderAgendaItem(event, true)).join("")
    : `<li class="agenda-item empty">No events on this day yet.</li>`;

  el.monthEventsList.innerHTML = ramadanEvents.length
    ? ramadanEvents.map((event) => renderAgendaItem(event, false)).join("")
    : `<li class="agenda-item empty">No events for this Ramadan yet.</li>`;
}

function renderAgendaItem(event, includeDate) {
  const className = event.category === "Sohour" ? "sohour" : "iftar";
  const date = parseDate(event.date);
  const shortDate = new Date(date.year, date.month - 1, date.day).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric" }
  );
  const timePart = event.time ? ` at ${event.time}` : "";
  const placePart = event.place ? ` | ${event.place}` : "";
  const origin = event.isShared ? "Shared" : "Personal";

  return `
    <li class="agenda-item">
      <div class="top">
        <span>${includeDate ? escapeHtml(event.title) : `${shortDate} - ${escapeHtml(event.title)}`}</span>
        <span class="tag ${className}">${event.category}</span>
      </div>
      <p>${origin}${timePart}${placePart}</p>
    </li>
  `;
}

function refreshFormState() {
  const disabled = !state.currentUser;
  [
    el.eventTitle,
    el.eventCategory,
    el.eventDate,
    el.eventTime,
    el.eventPlace,
    el.saveEventBtn,
  ].forEach((field) => {
    field.disabled = disabled;
  });

  el.eventDate.min = RAMADAN_START;
  el.eventDate.max = RAMADAN_END;

  if (!el.eventDate.value || !isRamadanDate(el.eventDate.value)) {
    el.eventDate.value = state.selectedDate;
  }

  if (disabled) {
    updateHint("Unlock your profile first to save personal events.");
  } else {
    updateHint("");
  }
}

function getSharedEvents() {
  return DEFAULT_SHARED_EVENTS.map((event, index) => ({
    id: `shared-2026-${index}`,
    title: event.title,
    category: event.category,
    date: event.date,
    time: "",
    place: event.place,
    isShared: true,
  }));
}

function getEventsForDate(date) {
  const shared = getSharedEvents().filter((event) => event.date === date);
  const personal = state.currentUser
    ? (state.personalEventsByUser[state.currentUser] || []).filter(
        (event) => event.date === date
      )
    : [];
  return [...shared, ...personal].sort(compareEvents);
}

function getAllRamadanEvents() {
  const shared = getSharedEvents().filter((event) => isRamadanDate(event.date));
  const personal = state.currentUser
    ? (state.personalEventsByUser[state.currentUser] || []).filter((event) =>
        isRamadanDate(event.date)
      )
    : [];
  return [...shared, ...personal].sort(compareEvents);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);

    state.users = Array.isArray(saved.users) ? saved.users : [];
    state.userPins =
      saved.userPins && typeof saved.userPins === "object" ? saved.userPins : {};
    state.pendingUser =
      typeof saved.pendingUser === "string" ? saved.pendingUser : "";
    state.personalEventsByUser =
      saved.personalEventsByUser && typeof saved.personalEventsByUser === "object"
        ? saved.personalEventsByUser
        : {};

    // Always require unlocking again when reopening the app.
    state.currentUser = "";

    if (typeof saved.selectedDate === "string" && isRamadanDate(saved.selectedDate)) {
      state.selectedDate = saved.selectedDate;
    }
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      users: state.users,
      userPins: state.userPins,
      pendingUser: state.pendingUser,
      personalEventsByUser: state.personalEventsByUser,
      selectedDate: state.selectedDate,
    })
  );
}

function applyRamadanConstraints() {
  if (!isRamadanDate(state.selectedDate)) {
    state.selectedDate = RAMADAN_START;
  }

  if (!state.pendingUser && state.users.length > 0) {
    state.pendingUser = state.users[0];
  }

  el.eventDate.min = RAMADAN_START;
  el.eventDate.max = RAMADAN_END;
  state.cloudConfigured = isCloudConfigured();
}

function normalizeDbUrl(url) {
  return url.trim().replace(/\/+$/, "");
}

function isCloudConfigured() {
  const normalized = normalizeDbUrl(FIREBASE_DB_URL);
  return Boolean(normalized) && !normalized.includes("YOUR_PROJECT_ID");
}

function getProfilesEndpoint() {
  return `${normalizeDbUrl(FIREBASE_DB_URL)}/profiles`;
}

function findExistingUserName(candidate) {
  const lowered = candidate.toLowerCase();
  return state.users.find((name) => name.toLowerCase() === lowered) || "";
}

function profileKey(name) {
  return encodeURIComponent(name.toLowerCase());
}

function startProfileSync() {
  if (!isCloudConfigured()) return;
  setInterval(() => {
    void syncProfilesFromCloud();
  }, CLOUD_SYNC_INTERVAL_MS);
}

async function syncProfilesFromCloud(options = {}) {
  const { announce = false, force = false } = options;

  if (!isCloudConfigured()) {
    state.cloudConfigured = false;
    if (announce) {
      updateAuthHint("Shared profile sync is off. Add your Firebase URL in script.js.");
    }
    return false;
  }

  if (state.syncInFlight && !force) return false;
  state.syncInFlight = true;

  try {
    const response = await fetch(`${getProfilesEndpoint()}.json`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Cloud fetch failed with ${response.status}`);
    }

    const payload = (await response.json()) || {};
    const cloudProfiles = extractCloudProfiles(payload);
    mergeCloudProfiles(cloudProfiles);

    state.cloudConfigured = true;
    state.cloudHealthy = true;
    saveState();
    renderUserSection();
    refreshFormState();

    if (announce) {
      if (Object.keys(cloudProfiles).length > 0) {
        updateAuthHint(`Loaded ${state.users.length} shared profiles.`);
      } else {
        updateAuthHint("No shared profiles yet. Create the first one.");
      }
    }

    return true;
  } catch (error) {
    state.cloudConfigured = true;
    state.cloudHealthy = false;
    if (announce) {
      updateAuthHint("Could not reach shared profile storage. Using local profiles only.");
    }
    return false;
  } finally {
    state.syncInFlight = false;
  }
}

function extractCloudProfiles(payload) {
  const profiles = {};
  if (!payload || typeof payload !== "object") {
    return profiles;
  }

  for (const value of Object.values(payload)) {
    if (!value || typeof value !== "object") continue;
    const name = normalizeName(String(value.name || ""));
    const pin = String(value.pin || "").trim();
    if (!name || !isValidPin(pin)) continue;
    profiles[name] = pin;
  }

  return profiles;
}

function mergeCloudProfiles(cloudProfiles) {
  const mergedUsers = new Set(state.users);
  for (const name of Object.keys(cloudProfiles)) {
    mergedUsers.add(name);
    state.userPins[name] = cloudProfiles[name];
  }

  state.users = Array.from(mergedUsers).sort((a, b) => a.localeCompare(b));

  if (state.pendingUser && !findExistingUserName(state.pendingUser)) {
    state.pendingUser = "";
  }
  if (state.currentUser && !findExistingUserName(state.currentUser)) {
    state.currentUser = "";
  }
  if (!state.pendingUser && state.users.length > 0) {
    state.pendingUser = state.users[0];
  }
}

async function saveProfileToCloud(name, pin) {
  if (!isCloudConfigured()) return false;

  try {
    const response = await fetch(`${getProfilesEndpoint()}/${profileKey(name)}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        pin,
        updatedAt: new Date().toISOString(),
      }),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

function normalizeName(value) {
  return value.trim().replace(/\s+/g, " ");
}

function isValidPin(pin) {
  return /^\d{4}$/.test(pin);
}

function isRamadanDate(date) {
  return date >= RAMADAN_START && date <= RAMADAN_END;
}

function buildDateRange(startDate, endDate) {
  const dates = [];
  const cursor = dateFromKey(startDate);
  const end = dateFromKey(endDate);

  while (cursor <= end) {
    dates.push(
      formatDate(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate())
    );
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function parseDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month, day };
}

function dateFromKey(dateStr) {
  const { year, month, day } = parseDate(dateStr);
  return new Date(year, month - 1, day);
}

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

function monthShort(month) {
  return new Date(2026, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
  });
}

function todayKey() {
  const now = new Date();
  return formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function compareEvents(a, b) {
  if (a.date !== b.date) return a.date.localeCompare(b.date);

  if (a.time && b.time) return a.time.localeCompare(b.time);
  if (a.time) return -1;
  if (b.time) return 1;

  if (a.category !== b.category) return a.category.localeCompare(b.category);
  return a.title.localeCompare(b.title);
}

function updateHint(message) {
  el.formHint.textContent = message;
}

function updateAuthHint(message) {
  el.authHint.textContent = message;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
