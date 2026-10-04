const pages = document.querySelectorAll(".page");

function showPage(page) {
    pages.forEach(p => p.hidden = true);
    page.hidden = false;

}


const idhaaButton = document.getElementById("idhaa");

idhaaButton.addEventListener("click", () => {
    showPage(document.getElementById("sign-up-page"))
});

const iahaaButton = document.getElementById("iahaa");

iahaaButton.addEventListener("click", () => {
    showPage(document.getElementById("log-in-page"))
});



const signUpForm = document.getElementById("sign-up-form");
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

