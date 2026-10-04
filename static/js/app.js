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
    if (signUpPasswordInput.value !== confirmInput.value) {
        event.preventDefault();
    }
});