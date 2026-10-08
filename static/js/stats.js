import { api } from "./api.js";


const statCards = document.getElementById("stats-cards");
const statStatus = document.getElementById("stats-status");
const statInsight = document.getElementById("stats-insight");
const statHistory = document.getElementById("stats-history");
const statPeriod = document.getElementById("stats-period");
let requestId = 0;
let onExpired;
let overviewRequestId = 0;

export function clearStats() {
    requestId++;
    overviewRequestId++;
    overviewCards.replaceChildren();
    overviewStatus.textContent = "";
    statCards.replaceChildren();
    statHistory.replaceChildren();
    statInsight.textContent = "";
    statStatus.textContent = "";
}

export function card(label, value) {
    const node = document.createElement("div");
    node.className = "data-card";
    const title = document.createElement("h2");
    title.textContent = label;
    const text = document.createElement("p");
    text.textContent = value;
    node.append(title, text);
    return node;
}

export async function loadStats(handleExpired = onExpired) {
    onExpired = handleExpired;
    clearStats();
    const request = requestId;
    statStatus.textContent = "Loading your statistics...";
    try {
        const today = new Date().toLocaleDateString("en-CA");
        const stats = await api(`/stats?days=${statPeriod.value}&today=${today}`);
        if (request !== requestId) return;
        statStatus.textContent = stats.entry_count ? `Based on ${stats.entry_count} journal entries.` : "Add your first sleep journal to see your trends.";
        const hours = value => value == null ? "—" : `${value.toFixed(1)} hours`;
        statCards.append(
            card("Suggested bedtime", stats.suggested_bedtime),
            card("Best-rated bedtime", stats.best_bedtime || "More data needed"),
            card("Average sleep", hours(stats.average_hours)),
            card("Average quality", stats.average_quality == null ? "—" : `${stats.average_quality.toFixed(1)} / 5`),
            card("Average bedtime", stats.average_bedtime || "—"),
            card("Average wake-up", stats.average_wake_time || "—"),
            card("Sleep goal reached", `${stats.goal_met_count} / ${stats.entry_count} entries`),
            card("Best night", stats.best_night ? `${stats.best_night.sleep_date}: ${stats.best_night.quality}/5, ${hours(stats.best_night.hours)}` : "—")
        );
        statInsight.textContent = `Your suggested bedtime allows ${stats.sleep_goal_hours} hours before your ${stats.target_wake_time} wake-up goal. ` +
            (stats.best_bedtime ? `Your best-rated bedtime is the average of ${stats.best_bedtime_samples} nights rated 4 or 5. This describes your logs; it does not predict better sleep.` : "Log at least three nights rated 4 or 5 to see their average bedtime. Widely scattered times may not have a useful average.");
        for (const row of stats.history.slice(-14)) {
            const node = document.createElement("div");
            node.className = "sleep-history-row";
            const label = document.createElement("span");
            label.textContent = `${row.sleep_date} · ${hours(row.hours)} · ${row.quality}/5`;
            const bar = document.createElement("meter");
            bar.min = 0;
            bar.max = 24;
            bar.value = row.hours;
            bar.setAttribute("aria-label", `Sleep hours on ${row.sleep_date}`);
            node.append(label, bar);
            statHistory.append(node);
        }
    } catch (err) {
        if (request !== requestId) return;
        if (err.status === 401 && onExpired) return onExpired();
        statStatus.textContent = err.message;
    }
}
statPeriod.addEventListener("change", () => loadStats());

const overviewCards = document.getElementById("overview-cards");
const overviewStatus = document.getElementById("overview-status");

export async function loadOverview(handleExpired = onExpired) {
    onExpired = handleExpired;
    const request = ++overviewRequestId;
    overviewCards.replaceChildren();
    overviewStatus.textContent = "Loading your overview...";
    try {
        const overview = await api("/overview");
        if (request !== overviewRequestId) return;
        overviewStatus.textContent = "Your overview is ready.";
        overviewCards.append(
            card("Total entries", overview.entry_count),
            card("First sleep entry", overview.first_entry_date ? `${overview.first_entry_date}` : "—"),
            card("Total sleep hours", overview.total_sleep_hours == null ? "—" : `${overview.total_sleep_hours.toFixed(1)} hours`)
        );
    } catch (err) {
        if (request !== overviewRequestId) return;
        if (err.status === 401 && onExpired) return onExpired();
        overviewStatus.textContent = err.message;
    }
}
