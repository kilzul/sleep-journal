from pathlib import Path

from fastapi import FastAPI, Form
from fastapi.responses import FileResponse


app = FastAPI()
HTML_FILE = Path(__file__).resolve().parent / "static" / "index.html"


@app.get("/")
async def read_index():
    return FileResponse(HTML_FILE)


@app.post("/api/signup")
async def handle_signup(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
):
    # Form(...) reads the inputs whose HTML name attributes match these arguments.
    # The password is received, but masked in terminal output.
    user_data = {"name": name, "email": email, "password": "[redacted]"}
    print("Received Signup Dictionary:", user_data, flush=True)
    # Add your account-creation code here later.
    return {"message": "Signup inputs received. Check your terminal; nothing was saved."}


@app.post("/api/login")
async def handle_login(email: str = Form(...), password: str = Form(...)):
    user_data = {"email": email, "password": "[redacted]"}
    print("Received Login Dictionary:", user_data, flush=True)
    # Add your authentication code here later. This does not log anyone in yet.
    return {"message": "Login inputs received. Check your terminal; login is not active yet."}


@app.post("/api/journals")
async def handle_journal(
    sleep_date: str = Form(...),
    bedtime: str = Form(...),
    wake_time: str = Form(...),
    quality: int = Form(...),
    notes: str = Form(""),
):
    journal_data = {
        "sleep_date": sleep_date,
        "bedtime": bedtime,
        "wake_time": wake_time,
        "quality": quality,
        "notes": notes,
    }
    print("Received Journal Dictionary:", journal_data, flush=True)
    # Add your database insert here later.
    return {"message": "Journal inputs received. Check your terminal; nothing was saved."}
