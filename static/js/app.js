import { api } from "./api.js";
import { loadStats, loadOverview, clearStats } from "./stats.js";

const DEV_BYPASS = false;

const protectedPages = ["overview-page", "journals-page", "journal-form", "calendar-page", "statistics-page", "settings-page"];
const pages = document.querySelectorAll(".page");
const logInNotice = document.getElementById("log-in-notice");
let wantedPage = null;
let loggedIn = false;

/* helpers */

const loadingScreen = document.getElementById("loading-screen");
const loadingText = document.getElementById("loading-text");
let loadingCount = 0;

async function withLoading(task, message = "Loading...", delay = 0, minShow = 750) {
    loadingCount++;
    let shownAt = 0;
    let timer = null;

    const show = () => {
        loadingText.textContent = message;
        loadingScreen.hidden = false;
        shownAt = Date.now();
    };

    if (delay > 0) timer = setTimeout(show, delay);
    else show();

    try {
        return await task();
    } finally {
        clearTimeout(timer);
        const remaining = minShow - (Date.now() - shownAt);
        if (shownAt && remaining > 0) await new Promise(r => setTimeout(r, remaining));
        loadingCount--;
        if (loadingCount === 0) loadingScreen.hidden = true;
    }
}

function shake(el) {
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
    el.addEventListener("animationend", () => el.classList.remove("shake"), { once: true });
}

function toMinutes(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}

function hoursSlept(bed, wake) {
    let diff = toMinutes(wake) - toMinutes(bed);
    if (diff <= 0) diff += 24 * 60;
    return diff / 60;
}

function parseDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T00:00:00") : new Date(value);
}

/* router */

function showPage(page) {
    const loginPage = document.getElementById("log-in-page");
    let shouldShake = false;

    if (protectedPages.includes(page.id) && !loggedIn) {
        shouldShake = wantedPage === page && !loginPage.hidden;
        wantedPage = page;
        const title = page.querySelector(".page-title");
        const name = title ? title.textContent.trim().toLowerCase() : "journal";
        logInNotice.textContent = "Sorry, but you have to log in to see your " + name + ".";
        page = loginPage;
    } else {
        logInNotice.textContent = "";
    }

    pages.forEach(p => p.hidden = true);
    page.hidden = false;

    if (shouldShake) shake(logInNotice);
    if (page.id === "journals-page") withLoading(() => loadJournals(), "Loading your journal entries...");
    if (page.id === "overview-page") withLoading(() => loadOverview(handleSessionExpired), "Loading your overview...");
    if (page.id === "settings-page") withLoading(() => loadSettings(), "Loading your settings...");
    if (page.id === "statistics-page") withLoading(() => loadStats(handleSessionExpired), "Loading your statistics...");
}

function handleSessionExpired() {
    loggedIn = false;
    clearPrivateData();
    wantedPage = null;
    showPage(document.getElementById("log-in-page"));
    logInNotice.textContent = "Your session expired. Please log in again.";
}

/* creator link menus */

const iconGroups = document.querySelectorAll(".icon-group");

function closeMenus() {
    iconGroups.forEach(g => {
        g.querySelector(".icon").setAttribute("aria-expanded", "false");
        g.querySelector(".link-menu").hidden = true;
    });
}

iconGroups.forEach(g => {
    const button = g.querySelector(".icon");
    const menu = g.querySelector(".link-menu");

    button.addEventListener("click", () => {
        const wasOpen = button.getAttribute("aria-expanded") === "true";
        closeMenus();
        if (!wasOpen) {
            menu.hidden = false;
            button.setAttribute("aria-expanded", "true");
        }
    });
});

document.addEventListener("click", (event) => {
    if (!event.target.closest(".icon-group")) closeMenus();
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        const openButton = document.querySelector('.icon[aria-expanded="true"]');
        closeMenus();
        if (openButton) openButton.focus();
    }
});

/* nav buttons */

const navTargets = {
    "overview-button": "overview-page",
    "journals-button": "journals-page",
    "calendar-button": "calendar-page",
    "stats-button": "statistics-page",
    "settings-button": "settings-page"
};

Object.entries(navTargets).forEach(([buttonId, pageId]) => {
    document.getElementById(buttonId).addEventListener("click", () => {
        showPage(document.getElementById(pageId));
    });
});

document.getElementById("idhaa").addEventListener("click", () => {
    showPage(document.getElementById("sign-up-page"));
});

document.getElementById("iahaa").addEventListener("click", () => {
    showPage(document.getElementById("log-in-page"));
});

/* sign up */

const signUpForm = document.getElementById("sign-up-form");
const signUpName = document.getElementById("name");
const signUpPasswordInput = document.getElementById("sign-up-password");
const confirmInput = document.getElementById("confirm-password");
const loginForm = document.getElementById("log-in-form");
const loginEmail = document.getElementById("login-email");

signUpForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!signUpForm.checkValidity()) {
        const firstInvalid = signUpForm.querySelector(":invalid");
        shake(firstInvalid);
        firstInvalid.focus();
        signUpForm.reportValidity();
        return;
    }

    try {
        const res = await fetch("/api/signup", {
            method: "POST",
            body: new FormData(signUpForm)
        });

        await res.json();

        if (!res.ok) {
            // add signup error message field
            return;
        }

        // signing up does not log you in, so loggedIn stays false here
        loginEmail.value = document.getElementById("email").value;
        showPage(document.getElementById("log-in-page"));
        logInNotice.textContent = "Yay! You have an account! Now try logging in!";
    } catch {
        // server error message
    }
});

signUpName.addEventListener("input", () => {
    const nameText = document.querySelector("#name-form-group .success");
    nameText.textContent = "Nice to meet you, " + signUpName.value + "!";
});

signUpPasswordInput.addEventListener("input", () => {
    const password = signUpPasswordInput.value;

    if (password === "") {
        signUpPasswordInput.setCustomValidity("");
    } else if (password.length >= 12 && /[A-Z]/.test(password) && /[a-z]/.test(password)) {
        signUpPasswordInput.setCustomValidity("");
    } else {
        signUpPasswordInput.setCustomValidity("Password does not meet requirements.");
    }
});

confirmInput.addEventListener("input", () => {
    confirmInput.setCustomValidity(
        signUpPasswordInput.value === confirmInput.value ? "" : "Passwords do not match."
    );
});

/* log in */

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (DEV_BYPASS) {
        loggedIn = true;
        const nextPage = wantedPage || document.getElementById("overview-page");
        wantedPage = null;
        showPage(nextPage);
        return;
    }

    if (!loginForm.reportValidity()) return;

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            body: new FormData(loginForm)
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            logInNotice.textContent = "Hmm... that didn't work. Maybe try a different password.";
            return;
        }

        loggedIn = true;
        const nextPage = wantedPage || document.getElementById("overview-page");
        wantedPage = null;
        showPage(nextPage);
    } catch {
        logInNotice.textContent = "Sorry, I think the server may be down. Try again later.";
    }
});

async function restoreLogin() {
    try {
        const res = await fetch("/api/me");

        if (res.status === 401) {
            loggedIn = false;
            showPage(document.getElementById("log-in-page"));
            return;
        }

        if (!res.ok) {
            logInNotice.textContent = "Sorry, you got logged out. Could you pretty pleaseee log back in?";
            return;
        }

        loggedIn = true;
        const nextPage = wantedPage || document.getElementById("overview-page");
        wantedPage = null;
        showPage(nextPage);
    } catch {
        logInNotice.textContent = "Sorry, I think the server may be down. Try again later.";
    }
}

/* journal page */

const journalGrid = document.getElementById("journal-grid");
const addJournal = document.getElementById("add-journal-button");
const statusText = document.getElementById("journals-status");
const journalSearch = document.getElementById("entry-search");

const qualityIcons = {
    1: "fa-face-sad-cry",
    2: "fa-face-frown",
    3: "fa-face-meh",
    4: "fa-face-smile",
    5: "fa-face-grin-stars"
};

let journalCards = [];

function buildPages(cards, keepScroll = false) {
    const scrollTop = journalGrid.scrollTop;
    journalGrid.replaceChildren();
    for (let i = 0; i < cards.length; i += 9) {
        const page = document.createElement("div");
        page.className = "journal-page";
        page.append(...cards.slice(i, i + 9));
        journalGrid.append(page);
    }
    journalGrid.scrollTop = keepScroll ? scrollTop : 0;
}

function filterJournals(keepScroll = false) {
    const query = journalSearch.value.trim().toLowerCase();
    const matches = journalCards.filter(card => query === "" || card.dataset.search.includes(query));
    buildPages(matches, keepScroll);
    if (journalCards.length === 0) return;
    statusText.textContent = matches.length ? "" : "Sorry, we couldn't find that one.";
}

journalSearch.addEventListener("input", () => filterJournals());

function createJournalCard(entry) {
    const card = document.createElement("div");
    card.className = "journal-card";
    card.dataset.id = entry.id;

    const dateLabel = parseDate(entry.sleep_date).toLocaleDateString(undefined, {
        weekday: "short", month: "short", day: "numeric",
    });
    const hoursLabel = hoursSlept(entry.bedtime, entry.wake_time).toFixed(1) + " hours";
    card.dataset.search = [dateLabel, hoursLabel, entry.notes || ""].join(" ").toLowerCase();

    const date = document.createElement("p");
    date.className = "entry-date";
    date.textContent = dateLabel + " | ";

    const hours = document.createElement("p");
    hours.className = "journal-hours";
    hours.textContent = hoursLabel + " | ";

    const quality = document.createElement("span");
    quality.className = "entry-quality";
    quality.setAttribute("role", "img");
    quality.setAttribute("aria-label", "Sleep quality " + entry.quality + " out of 5");
    const face = document.createElement("i");
    face.classList.add("fa-regular", qualityIcons[entry.quality] || "fa-face-meh-blank");
    face.setAttribute("aria-hidden", "true");
    quality.append(face);

    const notes = document.createElement("p");
    notes.className = "journal-notes";
    notes.textContent = entry.notes || "";

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete-entry";
    del.setAttribute("aria-label", "Delete entry from " + dateLabel);
    const trash = document.createElement("i");
    trash.classList.add("fa-regular", "fa-trash-can");
    trash.setAttribute("aria-hidden", "true");
    del.append(trash);

    card.append(date, hours, quality, notes, del);
    return card;
}

function renderEntries(entries) {
    journalCards = entries.map(createJournalCard);
    if (journalCards.length === 0) {
        journalGrid.replaceChildren();
        statusText.textContent = "Make your first entry and we'll show it here!";
        return;
    }
    statusText.textContent = "";
    filterJournals();
}

async function loadJournals() {
    statusText.textContent = "Loading your entries...";
    try {
        const entries = await api("/entries");
        renderEntries(entries);
    } catch (err) {
        if (err.status === 401) {
            handleSessionExpired();
            return;
        }
        statusText.textContent = err.message;
    }
}

journalGrid.addEventListener("click", async (event) => {
    const btn = event.target.closest(".delete-entry");
    if (!btn) return;

    const card = btn.closest(".journal-card");
    btn.disabled = true;
    try {
        await api("/entries/" + card.dataset.id, { method: "DELETE" });
        card.remove();
        journalCards = journalCards.filter(c => c !== card);
        if (journalCards.length === 0) {
            journalGrid.replaceChildren();
            statusText.textContent = "Make your first entry and we'll show it here!";
        } else {
            filterJournals(true);
        }
    } catch (err) {
        btn.disabled = false;
        if (err.status === 401) {
            handleSessionExpired();
            return;
        }
        statusText.textContent = err.message;
    }
});

addJournal.addEventListener("click", () => {
    showPage(document.getElementById("journal-form"));
});

/* add entry form */

const entryForm = document.getElementById("entry-form");
const sleepDate = document.getElementById("sleep-date");
const bedTime = document.getElementById("bed-time");
const wakeTime = document.getElementById("wake-time");
const sleepSummary = document.getElementById("sleep-summary");
const notes = document.getElementById("notes");
const notesCount = document.getElementById("notes-count");
const entryError = document.getElementById("entry-error");

sleepDate.max = new Date().toLocaleDateString("en-CA"); // today, local time, as YYYY-MM-DD

entryForm.querySelectorAll(".error").forEach((p) => {
    p.dataset.default = p.textContent;
});

function setFieldError(input, message) {
    const box = input.closest(".box");
    const errorText = box.querySelector(".error");
    input.setCustomValidity(message);
    if (message) {
        errorText.textContent = message;
        box.classList.add("invalid");
        input.setAttribute("aria-invalid", "true");
    } else {
        errorText.textContent = errorText.dataset.default;
        box.classList.remove("invalid");
        input.removeAttribute("aria-invalid");
    }
}

function checkTimes() {
    if (!bedTime.value || !wakeTime.value) {
        setFieldError(wakeTime, "");
        sleepSummary.textContent = "";
        return;
    }

    let minutes = toMinutes(wakeTime.value) - toMinutes(bedTime.value);
    if (minutes < 0) minutes += 24 * 60;

    if (minutes === 0) {
        setFieldError(wakeTime, "Your wake-up time is the same as your bedtime, which would mean no sleep at all.");
        sleepSummary.textContent = "";
        return;
    }

    setFieldError(wakeTime, "");
    let text = `That's ${Math.floor(minutes / 60)}h ${minutes % 60}m of sleep.`;
    if (minutes < 120 || minutes > 14 * 60) text += " Maybe you should double check.";
    sleepSummary.textContent = text;
}

bedTime.addEventListener("input", checkTimes);
wakeTime.addEventListener("input", checkTimes);

sleepDate.addEventListener("input", () => {
    setFieldError(sleepDate, sleepDate.validity.rangeOverflow ? "That date hasn't happened yet." : "");
});

notes.addEventListener("input", () => {
    notesCount.hidden = false;
    notesCount.textContent = notes.value.length + " / " + notes.maxLength;
    notes.closest(".box").classList.toggle("red", notes.value.length >= notes.maxLength - 20);
});

entryForm.addEventListener("input", (event) => {
    const box = event.target.closest(".box");
    if (box && event.target.validity.valid) box.classList.remove("invalid");
});

entryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    entryError.textContent = "";
    checkTimes();

    const invalid = [...entryForm.querySelectorAll("input:invalid, textarea:invalid")];
    invalid.forEach((el) => el.closest(".box").classList.add("invalid"));
    if (invalid.length) {
        invalid[0].focus();
        shake(invalid[0].closest(".box"));
        return;
    }

    const saveButton = document.getElementById("save-journal-button");
    saveButton.disabled = true;
    try {
        await api("/entries", {
            method: "POST",
            body: new FormData(entryForm)
        });
        entryForm.reset();
        sleepSummary.textContent = "";
        notesCount.hidden = true;
        showPage(document.getElementById("journals-page"));
    } catch (err) {
        if (err.status === 401) {
            handleSessionExpired();
            return;
        }
        entryError.textContent = err.message;
    } finally {
        saveButton.disabled = false;
    }
});

/* settings */

const settingsForm = document.getElementById("settings-form");
const settingsStatus = document.getElementById("settings-status");
const settingsSave = document.getElementById("save-settings-button");
let settingsRequest = 0;

function clearPrivateData() {
    settingsRequest++;
    settingsForm.reset();
    settingsSave.disabled = true;
    settingsStatus.textContent = "";
    document.getElementById("settings-email").textContent = "";
    document.getElementById("delete-account-form").reset();
    document.getElementById("delete-account-form").hidden = true;
    journalCards = [];
    journalGrid.replaceChildren();
    journalSearch.value = "";
    clearStats();
}

async function loadSettings() {
    const request = ++settingsRequest;
    settingsSave.disabled = true;
    settingsStatus.textContent = "Loading settings...";
    try {
        const settings = await api("/settings");
        if (request !== settingsRequest || !loggedIn) return;
        settingsForm.elements.username.value = settings.username;
        settingsForm.elements.sleep_goal_hours.value = settings.sleep_goal_hours;
        settingsForm.elements.target_wake_time.value = settings.target_wake_time.slice(0, 5);
        document.getElementById("settings-email").textContent = settings.email;
        settingsSave.disabled = false;
        settingsStatus.textContent = "";
    } catch (err) {
        if (request !== settingsRequest) return;
        if (err.status === 401) return handleSessionExpired();
        settingsStatus.textContent = err.message;
    }
}

settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!settingsForm.reportValidity()) return;
    settingsSave.disabled = true;
    settingsStatus.textContent = "Saving...";
    try {
        await api("/settings", { method: "PUT", body: new FormData(settingsForm) });
        settingsStatus.textContent = "Settings saved. Your statistics will use your new goal.";
    } catch (err) {
        if (err.status === 401) return handleSessionExpired();
        settingsStatus.textContent = err.message;
    } finally {
        settingsSave.disabled = !loggedIn;
    }
});

document.getElementById("sign-out-button").addEventListener("click", async (event) => {
    event.target.disabled = true;
    try {
        await api("/logout", { method: "POST" });
        loggedIn = false;
        wantedPage = null;
        clearPrivateData();
        showPage(document.getElementById("log-in-page"));
        logInNotice.textContent = "You have signed out.";
    } catch (err) {
        settingsStatus.textContent = err.message;
    } finally { event.target.disabled = false; }
});

const deleteForm = document.getElementById("delete-account-form");
document.getElementById("delete-account-button").addEventListener("click", () => {
    deleteForm.hidden = false;
    document.getElementById("delete-password").focus();
});
document.getElementById("cancel-delete-button").addEventListener("click", () => {
    deleteForm.hidden = true;
    deleteForm.reset();
});
deleteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = deleteForm.querySelector('[type="submit"]');
    button.disabled = true;
    try {
        await api("/account", { method: "DELETE", body: new FormData(deleteForm) });
        loggedIn = false;
        wantedPage = null;
        clearPrivateData();
        showPage(document.getElementById("log-in-page"));
        logInNotice.textContent = "Your account and journals were deleted.";
    } catch (err) {
        if (err.status === 401) return handleSessionExpired();
        settingsStatus.textContent = err.message;
    } finally { button.disabled = false; }
});

/* on start up */


setTimeout(() => {
    if (!loadingScreen.hidden) loadingText.textContent = "This is taking too long. Try refreshing the page.";
}, 20000);

async function startUp() {
    const slowTimer = setTimeout(() => {
        loadingText.textContent = "Waking things up... the first load can take a minute.";
    }, 5000);
    try {
        if (!DEV_BYPASS) await withLoading(restoreLogin, "Getting your sleep journal ready...");
    } finally {
        clearTimeout(slowTimer);
        if (loadingCount === 0) loadingScreen.hidden = true;
    }
}

startUp();
