

const protectedPages = ["overview-page", "journals-page", "calendar-page", "statistics-page", "settings-page"];
const logInNotice = document.getElementById("log-in-notice");

const wantedPageNames = { 

}

const pages = document.querySelectorAll(".page");
let wantedPage = null;

let loggedIn = false;

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

const overviewButton = document.getElementById("overview-button");
const journalsButton = document.getElementById("journals-button");
const calendarButton = document.getElementById("calendar-button");
const statsButton = document.getElementById("stats-button");

overviewButton.addEventListener("click", () => {
    showPage(document.getElementById("overview-page"));
});

journalsButton.addEventListener("click", () => {
    showPage(document.getElementById("journals-page"));
});

calendarButton.addEventListener("click", () => {
    showPage(document.getElementById("calendar-page"));
});

statsButton.addEventListener("click", () => {
    showPage(document.getElementById("statistics-page"));
});





const idhaaButton = document.getElementById("idhaa");

idhaaButton.addEventListener("click", () => {
    showPage(document.getElementById("sign-up-page"))
});

const iahaaButton = document.getElementById("iahaa");

iahaaButton.addEventListener("click", () => {
    showPage(document.getElementById("log-in-page"))
});



const signUpForm = document.getElementById("sign-up-form");
const signUpName = document.getElementById("name");
const signUpPasswordInput = document.getElementById("sign-up-password");
const confirmInput = document.getElementById("confirm-password");

signUpForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!signUpForm.checkValidity()) {
        const firstInvalid = signUpForm.querySelector(":invalid");
        firstInvalid.classList.add("shake");
        firstInvalid.focus();
    }

    firstInvalid.addEventListener("animationend", () => {
        firstInvalid.classList.remove("shake");
    }); 

    if (!signUpForm.reportValidity()) return;

    try {
        const res = await fetch("/api/signup", {
            method: "POST",
            body: new FormData(signUpForm)
        });

        const data = await res.json();

        if (!res.ok) {
            // add signup error message field
            return;
        }

        loggedIn = true;

        showPage(document.getElementById("overview-page"));

        //  success message
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

    if (password == "") {
        signUpPasswordInput.setCustomValidity("");
    } else if (password.length >= 12 && /[A-Z]/.test(password) && /[a-z]/.test(password)) {
        signUpPasswordInput.setCustomValidity("");
    } else {
        signUpPasswordInput.setCustomValidity("Password does not meet requirements.");
    }
});

confirmInput.addEventListener("input", () => {
    const password = signUpPasswordInput.value;
    const confirm = confirmInput.value;

    if (password == confirm) {
        confirmInput.setCustomValidity("");
    } else {
        confirmInput.setCustomValidity("Passwords do not match.");
    }

});

const loginForm = document.getElementById("log-in-form");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("log-in-password");

// router function
function showPage(page) {
    let shouldShake = false;

    if (protectedPages.includes(page.id) && !loggedIn) {
        shouldShake = wantedPage === page && !loginForm.hidden;
        wantedPage = page;
        const title = page.querySelector(".page-title");
        logInNotice.textContent = "Sorry, but you have to log in to see your " + title.textContent + ".";
        page = document.getElementById("log-in-page");
    } else {
        logInNotice.textContent = "";
    }

    pages.forEach(p => p.hidden = true);
    page.hidden = false;

    if (shouldShake) shake(logInNotice);

}

logInNotice.addEventListener("animationend", () => {
    logInNotice.classList.remove("shake");
});

function shake(el) {
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault(); 

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

restoreLogin();



