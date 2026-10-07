import { api } from "./api.js";

const cards = document.getElementById("stats-cards");
const status = document.getElementById("stats-status");
const insight = document.getElementById("stats-insight");
const history = document.getElementById("stats-history");
const period = document.getElementById("stats-period");
let requestId = 0;
let onExpired;

export function clearStats() {
    requestId++;
    cards.replaceChildren();
    history.replaceChildren();
    insight.textContent = "";
    status.textContent = "";
}

function card(label, value) {
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
    status.textContent = "Loading your statistics...";
    try {
        const today = new Date().toLocaleDateString("en-CA");
        const stats = await api(`/stats?days=${period.value}&today=${today}`);
        if (request !== requestId) return;
        status.textContent = stats.entry_count ? `Based on ${stats.entry_count} journal entries.` : "Add your first sleep journal to see your trends.";
        const hours = value => value == null ? "—" : `${value.toFixed(1)} hours`;
        cards.append(
            card("Suggested bedtime", stats.suggested_bedtime),
            card("Best-rated bedtime", stats.best_bedtime || "More data needed"),
            card("Average sleep", hours(stats.average_hours)),
            card("Average quality", stats.average_quality == null ? "—" : `${stats.average_quality.toFixed(1)} / 5`),
            card("Average bedtime", stats.average_bedtime || "—"),
            card("Average wake-up", stats.average_wake_time || "—"),
            card("Sleep goal reached", `${stats.goal_met_count} / ${stats.entry_count} entries`),
            card("Best night", stats.best_night ? `${stats.best_night.sleep_date}: ${stats.best_night.quality}/5, ${hours(stats.best_night.hours)}` : "—")
        );
        insight.textContent = `Your suggested bedtime allows ${stats.sleep_goal_hours} hours before your ${stats.target_wake_time} wake-up goal. ` +
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
            history.append(node);
        }
    } catch (err) {
        if (request !== requestId) return;
        if (err.status === 401 && onExpired) return onExpired();
        status.textContent = err.message;
    }
}
period.addEventListener("change", () => loadStats());
