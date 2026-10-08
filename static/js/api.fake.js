// fake api data until eli's enpoints r live





function loadJournals() {
    return JSON.parse(localStorage.getItem("fake-entries") || "[]");
}

function saveJournal(list) {
    localStorage.setItem("fake-entries", JSON.stringify(list));
}

export async function api(path, options = {}) {
    const method = options.method || "GET";

    if (path === "/entries" && method === "GET") {
        return loadJournals();
    }

    if (path === "/entries" && method === "POST") {
        const entry = {
            id: Date.now(),
            ...Object.fromEntries(options.body.entries())
            };

        saveJournal([entry, ...loadJournals()]);
        return entry;
    }

    if (path.startsWith("/entries/") && method === "DELETE") {
        const id = Number(path.split("/")[2]);
        saveJournal(loadJournals().filter((e) => e.id !== id));
        return null;
    }

    throw new Error("Not implemented in the fake API");
}