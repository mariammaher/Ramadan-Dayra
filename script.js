const STORAGE_KEY = "el_dayra_state_v2";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RAMADAN_START = "2026-02-18";
const RAMADAN_END = "2026-03-19";
const RAMADAN_DATES = buildDateRange(RAMADAN_START, RAMADAN_END);
const RAMADAN_RANGE_LABEL = "Feb 18 - Mar 19, 2026";
const CLOUD_SYNC_INTERVAL_MS = 20000;
const ADMIN_PIN = "2108";

// GitHub-only sync (no external backend service):
// 1) Create a PUBLIC gist with a file named "profiles.json" containing {"profiles":[]}
// 2) Paste the Gist ID below.
// 3) Paste a GitHub token with "gist" scope below if you want everyone to write shared profiles.
const GITHUB_GIST_ID = "b2657e230ec6e682643fbcadb0f1661f";
const GITHUB_GIST_OWNER = "mariammaher";
const GITHUB_TOKEN = "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";
const GIST_FILENAME = "profiles.json";
const IMAGE_PROXY_URL =
  "https://el-dayra-image-proxy.eldayra-poster-2026.workers.dev";
const MAX_IMAGE_EVENTS = 10;

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
  sharedEvents: buildDefaultSharedEvents(),
  isAdminUnlocked: false,
  selectedDate: RAMADAN_START,
  cloudConfigured: false,
  cloudHealthy: false,
  syncInFlight: false,
  lastCloudError: "",
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
  calendarCard: document.getElementById("calendarCard"),
  generateImageBtn: document.getElementById("generateImageBtn"),
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
  dayDetailsModal: document.getElementById("dayDetailsModal"),
  mobileModalTitle: document.getElementById("mobileModalTitle"),
  mobileDayEventsList: document.getElementById("mobileDayEventsList"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  imageOptionsModal: document.getElementById("imageOptionsModal"),
  closeImageModalBtn: document.getElementById("closeImageModalBtn"),
  exportSharedOnlyBtn: document.getElementById("exportSharedOnlyBtn"),
  exportWithPersonalBtn: document.getElementById("exportWithPersonalBtn"),
  adminPinInput: document.getElementById("adminPinInput"),
  adminUnlockBtn: document.getElementById("adminUnlockBtn"),
  adminHint: document.getElementById("adminHint"),
  sharedEventForm: document.getElementById("sharedEventForm"),
  sharedEventTitle: document.getElementById("sharedEventTitle"),
  sharedEventCategory: document.getElementById("sharedEventCategory"),
  sharedEventDate: document.getElementById("sharedEventDate"),
  sharedEventTime: document.getElementById("sharedEventTime"),
  sharedEventPlace: document.getElementById("sharedEventPlace"),
  saveSharedEventBtn: document.getElementById("saveSharedEventBtn"),
  adminCard: document.getElementById("adminCard"),
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
  el.createPinInput.addEventListener("input", () => {
    el.createPinInput.value = sanitizePinInput(el.createPinInput.value);
  });

  el.accessPinInput.addEventListener("input", () => {
    el.accessPinInput.value = sanitizePinInput(el.accessPinInput.value);
  });
  el.adminPinInput.addEventListener("input", () => {
    el.adminPinInput.value = sanitizePinInput(el.adminPinInput.value);
  });

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
  el.adminPinInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      unlockAdmin();
    }
  });
  el.adminUnlockBtn.addEventListener("click", unlockAdmin);

  el.closeModalBtn.addEventListener("click", closeDayDetailsModal);
  el.closeImageModalBtn.addEventListener("click", closeImageOptionsModal);
  el.generateImageBtn.addEventListener("click", openImageOptionsModal);
  el.exportSharedOnlyBtn.addEventListener("click", () => {
    void generateCalendarImage(false);
  });
  el.exportWithPersonalBtn.addEventListener("click", () => {
    void generateCalendarImage(true);
  });

  el.dayDetailsModal.addEventListener("click", (event) => {
    if (event.target === el.dayDetailsModal) {
      closeDayDetailsModal();
    }
  });
  el.imageOptionsModal.addEventListener("click", (event) => {
    if (event.target === el.imageOptionsModal) {
      closeImageOptionsModal();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDayDetailsModal();
      closeImageOptionsModal();
    }
  });

  window.addEventListener("resize", () => {
    if (!isCompactView()) {
      closeDayDetailsModal();
    }
  });

  el.calendarGrid.addEventListener("click", (event) => {
    const cell = event.target.closest(".day-cell");
    if (!cell || cell.classList.contains("placeholder")) return;

    const date = cell.dataset.date;
    if (!date || !isRamadanDate(date)) return;
    const dayEvents = getEventsForDate(date);

    state.selectedDate = date;
    saveState();
    renderCalendar();
    renderAgenda();

    el.eventDate.value = date;

    if (isCompactView() && dayEvents.length > 0) {
      openDayDetailsModal(date);
    }
  });

  el.eventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void addPersonalEvent();
  });

  el.sharedEventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void addSharedEvent();
  });

  [el.dayEventsList, el.monthEventsList, el.mobileDayEventsList].forEach((container) => {
    container.addEventListener("click", (event) => {
      const deleteBtn = event.target.closest("[data-delete-event-id]");
      if (!deleteBtn) return;
      const eventId = deleteBtn.dataset.deleteEventId;
      if (!eventId) return;
      void deleteEventById(eventId);
    });
  });
}

async function createProfile() {
  const name = normalizeName(el.nameInput.value);
  const pin = sanitizePinInput(el.createPinInput.value);

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
    updateAuthHint(
      `Profile created locally. Shared sync failed${
        state.lastCloudError ? ` (${state.lastCloudError})` : ""
      }. If you already added token, push/redeploy then refresh.`
    );
  }
}

async function unlockProfile() {
  const user = state.pendingUser || el.userSelect.value;
  const pin = sanitizePinInput(el.accessPinInput.value);

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

async function addPersonalEvent() {
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
  state.personalEventsByUser[state.currentUser] = list.sort(compareEvents);
  state.selectedDate = date;

  el.eventForm.reset();
  el.eventCategory.value = "Iftar";
  el.eventDate.value = date;
  updateHint("");
  saveState();
  renderAll();

  const synced = await savePersonalEventsToCloud(state.currentUser);
  if (!synced) {
    updateHint(
      `Saved on this device. Cloud sync failed${
        state.lastCloudError ? ` (${state.lastCloudError})` : ""
      }.`
    );
  } else {
    await syncProfilesFromCloud({ force: true });
  }
}

function unlockAdmin() {
  if (!isAdminEligibleProfile(state.currentUser)) {
    state.isAdminUnlocked = false;
    el.adminHint.textContent = "Admin tools are available only for Mariam profile.";
    refreshAdminState();
    return;
  }

  const pin = sanitizePinInput(el.adminPinInput.value);
  if (!isValidPin(pin)) {
    el.adminHint.textContent = "Admin PIN must be exactly 4 digits.";
    return;
  }

  if (pin !== ADMIN_PIN) {
    el.adminHint.textContent = "Incorrect admin PIN.";
    return;
  }

  state.isAdminUnlocked = true;
  el.adminPinInput.value = "";
  el.adminHint.textContent = "Admin unlocked. You can now add shared events.";
  refreshAdminState();
}

async function addSharedEvent() {
  if (!isAdminEligibleProfile(state.currentUser)) {
    state.isAdminUnlocked = false;
    el.adminHint.textContent = "Only Mariam profile can add shared events.";
    refreshAdminState();
    return;
  }

  if (!state.isAdminUnlocked) {
    el.adminHint.textContent = "Unlock admin first.";
    return;
  }

  const title = el.sharedEventTitle.value.trim();
  const category = el.sharedEventCategory.value;
  const date = el.sharedEventDate.value;
  const time = el.sharedEventTime.value;
  const place = el.sharedEventPlace.value.trim();

  if (!title || !date) {
    el.adminHint.textContent = "Shared event name and date are required.";
    return;
  }

  if (!isRamadanDate(date)) {
    el.adminHint.textContent = `Date must be within Ramadan 2026 (${RAMADAN_RANGE_LABEL}).`;
    return;
  }

  const sharedEvent = {
    id: `shared-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title,
    category,
    date,
    time: time || "",
    place: place || "",
    isShared: true,
  };

  state.sharedEvents = [...state.sharedEvents, sharedEvent].sort(compareEvents);
  state.selectedDate = date;

  el.sharedEventForm.reset();
  el.sharedEventCategory.value = "Iftar";
  el.sharedEventDate.value = date;
  saveState();
  renderAll();

  const synced = await saveSharedEventsToCloud();
  if (synced) {
    await syncProfilesFromCloud({ force: true });
    el.adminHint.textContent = "Shared event added and synced for everyone.";
  } else {
    el.adminHint.textContent = `Shared event added locally only${
      state.lastCloudError ? ` (${state.lastCloudError})` : ""
    }.`;
  }
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

function renderCalendar(options = {}) {
  const includePersonal = options.includePersonal !== false;
  const firstWeekday = dateFromKey(RAMADAN_START).getDay();
  const prefixCount = firstWeekday;
  const totalUsed = prefixCount + RAMADAN_DATES.length;
  const suffixCount = (7 - (totalUsed % 7)) % 7;
  const cells = [];

  for (let i = 0; i < prefixCount; i += 1) {
    cells.push('<div class="day-cell placeholder" aria-hidden="true"></div>');
  }

  for (const date of RAMADAN_DATES) {
    const dayEvents = getEventsForDate(date, { includePersonal });
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
  const sourceClass = event.isShared ? "shared" : "personal";
  return `<span class="pill ${categoryClass} ${sourceClass}">${escapeHtml(
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
  const sourceClass = event.isShared ? "source-shared" : "source-personal";
  const sourceLabel = event.isShared ? "Shared" : "Personal";
  const deleteControl = canDeleteEvent(event)
    ? `<button type="button" class="event-delete-btn" data-delete-event-id="${escapeHtml(
        event.id
      )}">Delete</button>`
    : "";
  const date = parseDate(event.date);
  const shortDate = new Date(date.year, date.month - 1, date.day).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric" }
  );
  const detailParts = [];
  if (event.time) detailParts.push(event.time);
  if (event.place) detailParts.push(event.place);
  const detailsText = detailParts.length ? detailParts.join(" | ") : "No set time/place";
  return `
    <li class="agenda-item">
      <div class="top">
        <span>${includeDate ? escapeHtml(event.title) : `${shortDate} - ${escapeHtml(event.title)}`}</span>
        <span class="tag-group">
          <span class="tag ${className}">${event.category}</span>
          <span class="tag ${sourceClass}">${sourceLabel}</span>
          ${deleteControl}
        </span>
      </div>
      <p>${escapeHtml(detailsText)}</p>
    </li>
  `;
}

function canDeleteEvent(event) {
  if (!event || typeof event !== "object") return false;
  if (event.isShared) {
    return state.isAdminUnlocked && isAdminEligibleProfile(state.currentUser);
  }
  return Boolean(state.currentUser) && event.owner === state.currentUser;
}

function getCurrentContextEventById(eventId) {
  const shared = state.sharedEvents.find((event) => event.id === eventId);
  if (shared) return shared;

  if (!state.currentUser) return null;
  return (
    (state.personalEventsByUser[state.currentUser] || []).find(
      (event) => event.id === eventId
    ) || null
  );
}

async function deleteEventById(eventId) {
  const eventToDelete = getCurrentContextEventById(eventId);
  if (!eventToDelete) return;

  if (eventToDelete.isShared && !state.isAdminUnlocked) {
    el.adminHint.textContent = "Only admin can delete shared events.";
    return;
  }

  if (!eventToDelete.isShared && !state.currentUser) {
    updateHint("Unlock your profile first.");
    return;
  }

  const confirmed = window.confirm(
    `Delete "${eventToDelete.title}" on ${eventToDelete.date}?`
  );
  if (!confirmed) return;

  if (eventToDelete.isShared) {
    state.sharedEvents = state.sharedEvents.filter((event) => event.id !== eventId);
    saveState();
    renderAll();

    const synced = await saveSharedEventsToCloud();
    if (synced) {
      await syncProfilesFromCloud({ force: true });
      el.adminHint.textContent = "Shared event deleted and synced for everyone.";
    } else {
      el.adminHint.textContent = `Shared event deleted locally only${
        state.lastCloudError ? ` (${state.lastCloudError})` : ""
      }.`;
    }
    return;
  }

  const currentEvents = state.personalEventsByUser[state.currentUser] || [];
  state.personalEventsByUser[state.currentUser] = currentEvents.filter(
    (event) => event.id !== eventId
  );
  saveState();
  renderAll();

  const synced = await savePersonalEventsToCloud(state.currentUser);
  if (synced) {
    await syncProfilesFromCloud({ force: true });
    updateHint("Personal event deleted and synced.");
  } else {
    updateHint(
      `Personal event deleted locally only${
        state.lastCloudError ? ` (${state.lastCloudError})` : ""
      }.`
    );
  }
}

function openDayDetailsModal(date) {
  const parsed = parseDate(date);
  const dateObj = new Date(parsed.year, parsed.month - 1, parsed.day);
  const events = getEventsForDate(date);
  el.mobileModalTitle.textContent = dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  el.mobileDayEventsList.innerHTML = events.length
    ? events.map((event) => renderAgendaItem(event, true)).join("")
    : `<li class="agenda-item empty">No events on this day yet.</li>`;

  el.dayDetailsModal.classList.remove("hidden");
  el.dayDetailsModal.setAttribute("aria-hidden", "false");
}

function closeDayDetailsModal() {
  el.dayDetailsModal.classList.add("hidden");
  el.dayDetailsModal.setAttribute("aria-hidden", "true");
}

function openImageOptionsModal() {
  el.exportWithPersonalBtn.disabled = !state.currentUser;
  if (!state.currentUser) {
    el.exportWithPersonalBtn.title = "Unlock a profile first to include personal events.";
  } else {
    el.exportWithPersonalBtn.title = "";
  }
  el.imageOptionsModal.classList.remove("hidden");
  el.imageOptionsModal.setAttribute("aria-hidden", "false");
}

function closeImageOptionsModal() {
  el.imageOptionsModal.classList.add("hidden");
  el.imageOptionsModal.setAttribute("aria-hidden", "true");
}

function setImageGenerationLoading(isLoading) {
  el.generateImageBtn.disabled = isLoading;
  el.exportSharedOnlyBtn.disabled = isLoading;
  el.exportWithPersonalBtn.disabled = isLoading || !state.currentUser;
  if (isLoading) {
    el.generateImageBtn.textContent = "Generating...";
  } else {
    el.generateImageBtn.textContent = "Generate Image";
  }
}

async function generateCalendarImage(includePersonal) {
  if (includePersonal && !state.currentUser) {
    updateAuthHint("Unlock a profile first to include personal events in the image.");
    closeImageOptionsModal();
    return;
  }

  if (!IMAGE_PROXY_URL) {
    updateAuthHint("Image service is not configured yet.");
    closeImageOptionsModal();
    return;
  }

  closeImageOptionsModal();
  setImageGenerationLoading(true);

  try {
    const mode = includePersonal ? "shared_personal" : "shared_only";
    const sharedEvents = sanitizeEventsForPoster(getSharedEvents(), "Shared");
    const personalEvents = includePersonal
      ? sanitizeEventsForPoster(state.personalEventsByUser[state.currentUser] || [], "Personal")
      : [];

    const response = await fetch(IMAGE_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        profileName: state.currentUser || "",
        sharedEvents,
        personalEvents,
        prompt:
          mode === "shared_only"
            ? buildSharedPosterPrompt(sharedEvents)
            : buildSharedPersonalPosterPrompt(
                state.currentUser || "Friend",
                sharedEvents,
                personalEvents
              ),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorText =
        typeof data.error === "string" && data.error.trim()
          ? data.error.trim()
          : "Image generation failed.";
      throw new Error(errorText);
    }

    const b64 = typeof data.b64 === "string" ? data.b64 : "";
    const imageUrl = typeof data.imageUrl === "string" ? data.imageUrl : "";
    if (!b64 && !imageUrl) {
      throw new Error("No image returned from service.");
    }

    const dateStamp = todayKey();
    const modeLabel = includePersonal ? "shared-personal" : "shared-only";
    const userSlug = includePersonal
      ? `-${state.currentUser.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
      : "";

    const downloadLink = document.createElement("a");
    downloadLink.href = b64 ? `data:image/png;base64,${b64}` : imageUrl;
    downloadLink.download = `el-dayra-${modeLabel}${userSlug}-${dateStamp}.png`;
    downloadLink.rel = "noopener";
    downloadLink.target = "_blank";
    downloadLink.click();

    updateAuthHint(
      includePersonal
        ? "Calendar image downloaded (shared + personal)."
        : "Calendar image downloaded (shared only)."
    );
  } catch (error) {
    updateAuthHint(
      error instanceof Error && error.message
        ? `Could not generate image: ${error.message}`
        : "Could not generate image. Try again."
    );
  } finally {
    setImageGenerationLoading(false);
  }
}

function sanitizeEventsForPoster(events, source) {
  if (!Array.isArray(events)) return [];
  return events
    .filter((event) => event && typeof event === "object" && isRamadanDate(String(event.date || "")))
    .sort(compareEvents)
    .slice(0, MAX_IMAGE_EVENTS)
    .map((event) => ({
      date: String(event.date || ""),
      category: event.category === "Sohour" ? "Sohour" : "Iftar",
      title: String(event.title || "").trim(),
      place: String(event.place || "").trim(),
      time: String(event.time || "").trim(),
      source,
    }))
    .filter((event) => event.title && event.date);
}

function formatPosterEventLine(event) {
  const parts = [
    eventDateLabel(event.date),
    event.category,
    event.title,
    event.place ? `@ ${event.place}` : "",
    event.time ? `(${event.time})` : "",
    `[${event.source}]`,
  ].filter(Boolean);
  return `- ${parts.join(" | ")}`;
}

function eventDateLabel(dateKey) {
  if (!isRamadanDate(dateKey)) return dateKey;
  const parsed = parseDate(dateKey);
  return new Date(parsed.year, parsed.month - 1, parsed.day).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric" }
  );
}

function buildSharedPosterPrompt(sharedEvents) {
  const lines = sharedEvents.length
    ? sharedEvents.map(formatPosterEventLine).join("\n")
    : "- No shared events yet.";
  return [
    "Create a premium vertical Ramadan invite poster (1080x1920) for a friend group called 'El Dayra'.",
    "Style: rich Ramadan aesthetic, deep navy and warm gold palette, lanterns, crescent moon, stars, subtle Islamic geometric ornaments, elegant parchment event cards, highly readable text.",
    "Branding text:",
    "- Main title: El Dayra",
    "- Subtitle: Ramadan Shared Schedule 2026",
    "Rules:",
    "- Use only the events below.",
    "- Do not invent names, dates, or locations.",
    "- Keep text clean and readable.",
    "- If schedule is short, add footer: More invites to be announced.",
    "Events:",
    lines,
    "Output: one polished social-ready poster, English text only, no watermark.",
  ].join("\n");
}

function buildSharedPersonalPosterPrompt(profileName, sharedEvents, personalEvents) {
  const sharedLines = sharedEvents.length
    ? sharedEvents.map(formatPosterEventLine).join("\n")
    : "- No shared events yet.";
  const personalLines = personalEvents.length
    ? personalEvents.map(formatPosterEventLine).join("\n")
    : "- No personal events yet.";
  return [
    "Create a premium vertical Ramadan invite poster (1080x1920) for a friend group called 'El Dayra'.",
    "Style: rich Ramadan aesthetic, deep navy and warm gold palette, lanterns, crescent moon, stars, subtle Islamic geometric ornaments, elegant parchment event cards, highly readable text.",
    "Branding text:",
    "- Main title: El Dayra",
    `- Subtitle: ${profileName}'s Ramadan Agenda 2026`,
    "Rules:",
    "- Combine shared and personal events in one schedule.",
    "- Clearly label event source as Shared or Personal.",
    "- Use only the events below.",
    "- Do not invent names, dates, or locations.",
    "Shared events:",
    sharedLines,
    `Personal events for ${profileName}:`,
    personalLines,
    "Output: one polished social-ready poster, English text only, no watermark.",
  ].join("\n");
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
  el.sharedEventDate.min = RAMADAN_START;
  el.sharedEventDate.max = RAMADAN_END;

  if (!el.eventDate.value || !isRamadanDate(el.eventDate.value)) {
    el.eventDate.value = state.selectedDate;
  }
  if (!el.sharedEventDate.value || !isRamadanDate(el.sharedEventDate.value)) {
    el.sharedEventDate.value = state.selectedDate;
  }

  if (disabled) {
    updateHint("Unlock your profile first to save personal events.");
  } else {
    updateHint("");
  }

  refreshAdminState();
}

function refreshAdminState() {
  const adminEligible = isAdminEligibleProfile(state.currentUser);
  el.adminCard.hidden = !adminEligible;

  if (!adminEligible) {
    state.isAdminUnlocked = false;
  }

  const adminLocked = !state.isAdminUnlocked;
  [
    el.sharedEventTitle,
    el.sharedEventCategory,
    el.sharedEventDate,
    el.sharedEventTime,
    el.sharedEventPlace,
    el.saveSharedEventBtn,
  ].forEach((field) => {
    field.disabled = adminLocked;
  });

  if (!adminEligible) {
    el.adminHint.textContent = "Admin tools are available only for Mariam profile.";
  } else if (adminLocked && !el.adminHint.textContent.trim()) {
    el.adminHint.textContent = "Locked. Enter admin PIN to edit shared events.";
  }
}

function getSharedEvents() {
  return state.sharedEvents.length
    ? state.sharedEvents
    : buildDefaultSharedEvents();
}

function getEventsForDate(date, options = {}) {
  const includePersonal = options.includePersonal !== false;
  const shared = getSharedEvents().filter((event) => event.date === date);
  const personal = includePersonal && state.currentUser
    ? (state.personalEventsByUser[state.currentUser] || []).filter(
        (event) => event.date === date
      )
    : [];
  return [...shared, ...personal].sort(compareEvents);
}

function getAllRamadanEvents(options = {}) {
  const includePersonal = options.includePersonal !== false;
  const shared = getSharedEvents().filter((event) => isRamadanDate(event.date));
  const personal = includePersonal && state.currentUser
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
    state.sharedEvents = Array.isArray(saved.sharedEvents)
      ? saved.sharedEvents
      : buildDefaultSharedEvents();

    // Always require unlocking again when reopening the app.
    state.currentUser = "";
    state.isAdminUnlocked = false;

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
      sharedEvents: state.sharedEvents,
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
  state.personalEventsByUser = sanitizePersonalEventsByUser(state.personalEventsByUser);
  state.sharedEvents = sanitizeSharedEvents(state.sharedEvents);
  if (!state.sharedEvents.length) {
    state.sharedEvents = buildDefaultSharedEvents();
  }
}

function isCloudConfigured() {
  const gistId = String(GITHUB_GIST_ID || "").trim();
  return Boolean(gistId) && !gistId.includes("YOUR_PUBLIC_GIST_ID");
}

function hasWriteToken() {
  const token = String(GITHUB_TOKEN || "").trim();
  return Boolean(token) && !token.includes("YOUR_GITHUB_GIST_TOKEN");
}

function getGistEndpoint() {
  return `https://api.github.com/gists/${encodeURIComponent(
    String(GITHUB_GIST_ID || "").trim()
  )}`;
}

function getGistRawEndpoint() {
  const owner = String(GITHUB_GIST_OWNER || "").trim();
  const gistId = String(GITHUB_GIST_ID || "").trim();
  if (!owner || !gistId) return "";
  return `https://gist.githubusercontent.com/${encodeURIComponent(
    owner
  )}/${encodeURIComponent(gistId)}/raw/${encodeURIComponent(GIST_FILENAME)}`;
}

function buildGitHubHeaders(includeWriteAuth) {
  const headers = { Accept: "application/vnd.github+json" };
  if (includeWriteAuth && hasWriteToken()) {
    headers.Authorization = `Bearer ${String(GITHUB_TOKEN).trim()}`;
  }
  return headers;
}

function findExistingUserName(candidate) {
  const lowered = candidate.toLowerCase();
  return state.users.find((name) => name.toLowerCase() === lowered) || "";
}

function startProfileSync() {
  if (!isCloudConfigured()) return;
  setInterval(() => {
    void syncProfilesFromCloud();
  }, CLOUD_SYNC_INTERVAL_MS);
}

async function fetchCloudDataForRead() {
  const attempts = [];
  const gistEndpoint = getGistEndpoint();
  const rawEndpoint = getGistRawEndpoint();

  if (hasWriteToken()) {
    attempts.push({
      label: "api-auth",
      url: gistEndpoint,
      headers: buildGitHubHeaders(true),
      parser: "api",
    });
  }

  attempts.push({
    label: "api-public",
    url: gistEndpoint,
    headers: buildGitHubHeaders(false),
    parser: "api",
  });

  if (rawEndpoint) {
    attempts.push({
      label: "raw-public",
      url: `${rawEndpoint}?t=${Date.now()}`,
      headers: { Accept: "application/json, text/plain, */*" },
      parser: "raw",
    });
  }

  const errors = [];

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, {
        headers: attempt.headers,
        cache: "no-store",
      });

      if (!response.ok) {
        errors.push(`${attempt.label}:${response.status}`);
        continue;
      }

      let cloudData = null;
      if (attempt.parser === "api") {
        const payload = (await response.json()) || {};
        cloudData = extractCloudDataFromGist(payload);
      } else {
        const content = await response.text();
        cloudData = extractCloudDataFromRawContent(content);
      }

      if (!cloudData) {
        errors.push(`${attempt.label}:invalid-data`);
        continue;
      }

      return { ok: true, cloudData };
    } catch (error) {
      errors.push(`${attempt.label}:network`);
    }
  }

  return {
    ok: false,
    error: errors.length ? errors.join(" | ") : "network error",
  };
}

async function syncProfilesFromCloud(options = {}) {
  const { announce = false, force = false } = options;

  if (!isCloudConfigured()) {
    state.cloudConfigured = false;
    if (announce) {
      updateAuthHint("Shared profile sync is off. Add your GitHub Gist ID in script.js.");
    }
    return false;
  }

  if (state.syncInFlight && !force) return false;
  state.syncInFlight = true;

  try {
    const readResult = await fetchCloudDataForRead();
    if (!readResult || !readResult.ok || !readResult.cloudData) {
      state.lastCloudError = readResult?.error || "network error";
      throw new Error("Cloud fetch failed");
    }
    const cloudData = readResult.cloudData;
    applyCloudData(cloudData);

    state.cloudConfigured = true;
    state.cloudHealthy = true;
    state.lastCloudError = "";
    saveState();
    renderUserSection();
    refreshFormState();

    if (announce) {
      if (cloudData.users.length > 0) {
        updateAuthHint(
          hasWriteToken()
            ? `Loaded ${state.users.length} shared profiles.`
            : `Loaded ${state.users.length} shared profiles (read-only, add token to allow creating shared profiles).`
        );
      } else {
        updateAuthHint(
          hasWriteToken()
            ? "No shared profiles yet. Create the first one."
            : "No shared profiles yet. Add a GitHub token to create shared profiles."
        );
      }
    } else if (
      el.authHint.textContent.includes("Could not reach shared profile storage")
    ) {
      updateAuthHint(`Loaded ${state.users.length} shared profiles.`);
    }

    return true;
  } catch (error) {
    state.cloudConfigured = true;
    state.cloudHealthy = false;
    if (!state.lastCloudError) {
      state.lastCloudError = "network error";
    }
    if (announce) {
      updateAuthHint("Could not reach shared profile storage. Using local profiles only.");
    }
    return false;
  } finally {
    state.syncInFlight = false;
  }
}

function createEmptyCloudData() {
  return {
    users: [],
    userPins: {},
    personalEventsByUser: {},
    sharedEvents: buildDefaultSharedEvents(),
  };
}

function parseCloudDataFromObject(parsed) {
  const data = createEmptyCloudData();
  if (!parsed || typeof parsed !== "object") return null;

  const list = Array.isArray(parsed.profiles) ? parsed.profiles : [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const name = normalizeName(String(item.name || ""));
    const pin = sanitizePinInput(String(item.pin || ""));
    if (!name || !isValidPin(pin)) continue;
    data.userPins[name] = pin;
  }
  data.users = Object.keys(data.userPins).sort((a, b) => a.localeCompare(b));

  const rawPersonal =
    parsed.personalEventsByUser && typeof parsed.personalEventsByUser === "object"
      ? parsed.personalEventsByUser
      : {};
  data.personalEventsByUser = sanitizePersonalEventsByUser(rawPersonal);

  const rawShared = Array.isArray(parsed.sharedEvents) ? parsed.sharedEvents : [];
  const cleanShared = sanitizeSharedEvents(rawShared);
  data.sharedEvents = cleanShared.length ? cleanShared : buildDefaultSharedEvents();

  return data;
}

function extractCloudDataFromRawContent(content) {
  if (typeof content !== "string") return null;
  const trimmed = content.trim();
  if (!trimmed) return createEmptyCloudData();

  try {
    const parsed = JSON.parse(trimmed);
    return parseCloudDataFromObject(parsed);
  } catch (error) {
    return null;
  }
}

function extractCloudDataFromGist(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const files = payload.files && typeof payload.files === "object" ? payload.files : {};
  const profileFile = files[GIST_FILENAME];
  if (!profileFile || typeof profileFile !== "object") {
    return createEmptyCloudData();
  }

  const content =
    typeof profileFile.content === "string"
      ? profileFile.content
      : typeof profileFile.truncated === "boolean" && profileFile.raw_url
        ? null
        : "";

  if (typeof content === "string") {
    return extractCloudDataFromRawContent(content);
  }

  return null;
}

function applyCloudData(cloudData) {
  state.users = cloudData.users;
  state.userPins = cloudData.userPins;
  state.personalEventsByUser = cloudData.personalEventsByUser;
  state.sharedEvents = cloudData.sharedEvents.length
    ? cloudData.sharedEvents
    : buildDefaultSharedEvents();

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
  if (!hasWriteToken()) {
    state.lastCloudError = "missing token";
    return false;
  }

  const cloudData = await fetchCloudDataForWrite();
  if (!cloudData) return false;

  cloudData.userPins[name] = sanitizePinInput(pin);
  cloudData.users = Object.keys(cloudData.userPins).sort((a, b) => a.localeCompare(b));
  if (!cloudData.personalEventsByUser[name]) {
    cloudData.personalEventsByUser[name] = [];
  }

  return writeCloudData(cloudData);
}

async function savePersonalEventsToCloud(userName) {
  if (!isCloudConfigured()) return false;
  if (!hasWriteToken()) {
    state.lastCloudError = "missing token";
    return false;
  }

  const cloudData = await fetchCloudDataForWrite();
  if (!cloudData) return false;

  cloudData.personalEventsByUser[userName] = sanitizePersonalEventList(
    state.personalEventsByUser[userName] || [],
    userName
  );
  if (state.userPins[userName]) {
    cloudData.userPins[userName] = state.userPins[userName];
  }
  cloudData.users = Object.keys(cloudData.userPins).sort((a, b) => a.localeCompare(b));

  return writeCloudData(cloudData);
}

async function saveSharedEventsToCloud() {
  if (!isCloudConfigured()) return false;
  if (!hasWriteToken()) {
    state.lastCloudError = "missing token";
    return false;
  }

  const cloudData = await fetchCloudDataForWrite();
  if (!cloudData) return false;

  cloudData.sharedEvents = sanitizeSharedEvents(state.sharedEvents);
  return writeCloudData(cloudData);
}

async function fetchCloudDataForWrite() {
  const readResult = await fetchCloudDataForRead();
  if (!readResult.ok || !readResult.cloudData) {
    state.lastCloudError = readResult.error || "network error";
    return null;
  }
  return readResult.cloudData;
}

async function writeCloudData(cloudData) {
  try {
    const fileContent = JSON.stringify(
      {
        profiles: cloudData.users.map((name) => ({
          name,
          pin: cloudData.userPins[name],
        })),
        personalEventsByUser: cloudData.personalEventsByUser,
        sharedEvents: cloudData.sharedEvents,
        updatedAt: new Date().toISOString(),
        disclaimer:
          "Fun mode only: pins are plain text and visible to anyone with gist access.",
      },
      null,
      2
    );

    const writeResponse = await fetch(getGistEndpoint(), {
      method: "PATCH",
      headers: {
        ...buildGitHubHeaders(true),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: {
          [GIST_FILENAME]: {
            content: fileContent,
          },
        },
      }),
    });

    if (!writeResponse.ok) {
      state.lastCloudError = `write ${writeResponse.status}`;
      return false;
    }

    state.lastCloudError = "";
    return true;
  } catch (error) {
    state.lastCloudError = "network error";
    return false;
  }
}

function buildDefaultSharedEvents() {
  return DEFAULT_SHARED_EVENTS.map((event, index) => ({
    id: `shared-default-${index + 1}`,
    title: event.title,
    category: event.category === "Sohour" ? "Sohour" : "Iftar",
    date: event.date,
    time: "",
    place: event.place || "",
    isShared: true,
  }));
}

function sanitizePersonalEventsByUser(rawMap) {
  const clean = {};
  for (const [rawUser, rawEvents] of Object.entries(rawMap)) {
    const userName = normalizeName(String(rawUser || ""));
    if (!userName) continue;
    clean[userName] = sanitizePersonalEventList(rawEvents, userName);
  }
  return clean;
}

function sanitizePersonalEventList(rawEvents, owner) {
  if (!Array.isArray(rawEvents)) return [];
  return rawEvents
    .map((event, index) =>
      sanitizeEventRecord(event, {
        isShared: false,
        owner,
        fallbackId: `personal-${owner}-${index + 1}`,
      })
    )
    .filter(Boolean)
    .sort(compareEvents);
}

function sanitizeSharedEvents(rawEvents) {
  if (!Array.isArray(rawEvents)) return [];
  return rawEvents
    .map((event, index) =>
      sanitizeEventRecord(event, {
        isShared: true,
        fallbackId: `shared-cloud-${index + 1}`,
      })
    )
    .filter(Boolean)
    .sort(compareEvents);
}

function sanitizeEventRecord(rawEvent, options) {
  if (!rawEvent || typeof rawEvent !== "object") return null;

  const title = String(rawEvent.title || "").trim();
  const category = rawEvent.category === "Sohour" ? "Sohour" : "Iftar";
  const date = String(rawEvent.date || "").trim();
  const time = String(rawEvent.time || "").trim();
  const place = String(rawEvent.place || "").trim();
  const id = String(rawEvent.id || options.fallbackId || "").trim();

  if (!title || !date || !id || !isRamadanDate(date)) return null;

  const normalized = {
    id,
    title,
    category,
    date,
    time,
    place,
    isShared: Boolean(options.isShared),
  };

  if (!options.isShared) {
    normalized.owner = options.owner || "";
  }

  return normalized;
}

function normalizeName(value) {
  return value.trim().replace(/\s+/g, " ");
}

function isAdminEligibleProfile(name) {
  return typeof name === "string" && name.toLowerCase().includes("mariam");
}

function sanitizePinInput(value) {
  return String(value).replace(/\D/g, "").slice(0, 4);
}

function isValidPin(pin) {
  return /^\d{4}$/.test(pin);
}

function isCompactView() {
  return (
    window.matchMedia("(max-width: 900px)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  );
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
