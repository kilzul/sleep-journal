


const pages = document.querySelectorAll(".page");

function showPage(page) {
    pages.forEach(p => p.hidden = true);
    page.hidden = false;

}

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

signUpForm.addEventListener("submit", (event) => {
    event.preventDefault();
    let firstInvalid;

    if (!signUpForm.checkValidity()) {
        firstInvalid = signUpForm.querySelector(":invalid");
        firstInvalid.classList.add("shake");
        firstInvalid.focus();
    }

    firstInvalid.addEventListener("animationend", () => {
        firstInvalid.classList.remove("shake");
    })

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




