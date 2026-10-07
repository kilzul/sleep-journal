const BASE = "/api";

function getErrorMessage(body, status) {
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail)) return body.detail.map((d) => d.msg).join(" ");
    if (status >= 500) return "I'm sorry. I think we're having a server issue. Try again later.";
    return "Umm... something went wrong. Try that again.";
}

export async function api(path, options = {}) {

    const res = await fetch(BASE + path, {
        ...options,
        credentials: "same-origin"
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err = new Error(getErrorMessage(body, res.status));
        err.status = res.status;          // lets callers check for 401
        throw err;
    }

    return res.status === 204 ? null : res.json();
}