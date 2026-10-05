from pathlib import Path

from fastapi import FastAPI, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.staticfiles import StaticFiles 
from psycopg import Error
from psycopg.errors import UniqueViolation

from backend.db import check_login, insert_user


app = FastAPI()
HTML_FILE = Path(__file__).resolve().parent / "static" / "index.html"
app.mount("/static", StaticFiles(directory=HTML_FILE.parent), name="static")
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
HTML_FILE = STATIC_DIR / "index.html"

app.mount("/css", StaticFiles(directory=STATIC_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=STATIC_DIR / "js"), name="js")
app.mount("/fonts", StaticFiles(directory=STATIC_DIR / "fonts"), name="fonts")

@app.exception_handler(Error)
def handle_database_error(request, error):
    # Keep database connection details out of the response.
    return JSONResponse(
        status_code=503,
        content={"detail": "Database unavailable. Check SUPABASE_DB_URL in .env and try again."},
    )


@app.get("/")
async def read_index():
    return FileResponse(HTML_FILE)


@app.post("/api/signup")
def handle_signup(name: str = Form(...), email: str = Form(...), password: str = Form(...)):
    """ Stores the users information into the database """

    if not name.strip() or not email.strip():
        raise HTTPException(status_code=400, detail="Name and email cannot be blank.")
    try:
        insert_user(name, email, password)
    except UniqueViolation:
        raise HTTPException(status_code=409, detail="That name or email is already registered.")
    return {"message": "Signup successful. You can now log in."}


@app.post("/api/login")
def handle_login(email: str = Form(...), password: str = Form(...)):
    """ Checks if the users password matches the stored users hashed password """
    if not check_login(email, password):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return {"message": "Login successful"}


@app.post("/api/journals")
async def handle_journal(
    sleep_date: str = Form(...),
    bedtime: str = Form(...),
    wake_time: str = Form(...),
    quality: int = Form(...),
    notes: str = Form(""),
):
    # Add your database insert here later.
    return {"message": "Journal inputs received. Nothing was saved."}
