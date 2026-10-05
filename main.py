from pathlib import Path

from fastapi import Depends, FastAPI, Form, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from psycopg import Error
from psycopg.errors import UniqueViolation

from backend.db import authenticate_user, insert_user
from backend.sessions import (
    COOKIE_NAME, COOKIE_SECURE, create_session, get_current_user,
    revoke_session, set_session_cookie, verify_request_origin,
)


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
def handle_signup(name: str = Form(...), email: str = Form(...), password: str = Form(...), _origin=Depends(verify_request_origin)):
    """ Stores the users information into the database """

    if not name.strip() or not email.strip():
        raise HTTPException(status_code=400, detail="Name and email cannot be blank.")
    try:
        insert_user(name, email, password)
    except UniqueViolation:
        raise HTTPException(status_code=409, detail="That name or email is already registered.")
    return {"message": "Signup successful. You can now log in."}


@app.post("/api/login")
def handle_login(request: Request, response: Response, email: str = Form(...), password: str = Form(...), _origin=Depends(verify_request_origin)):
    """ Checks if the users password matches the stored users hashed password """
    user = authenticate_user(email, password)
    if not user:
        return JSONResponse(status_code=401, content={"success": False, "message": "Incorrect email or password."})
    token, expires_at = create_session(user["id"], request.cookies.get(COOKIE_NAME))
    set_session_cookie(response, token, expires_at)
    response.headers["Cache-Control"] = "no-store"
    return {"success": True, "message": "Login successful", "user": user}


@app.get("/api/me")
def handle_me(response: Response, user: dict = Depends(get_current_user)):
    response.headers["Cache-Control"] = "no-store"
    return {"user": user}


@app.post("/api/logout")
def handle_logout(request: Request, response: Response, _origin=Depends(verify_request_origin)):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        revoke_session(token)
    response.delete_cookie(COOKIE_NAME, path="/", secure=COOKIE_SECURE, httponly=True, samesite="lax")
    response.headers["Cache-Control"] = "no-store"
    return {"success": True, "message": "Logged out"}


@app.post("/api/journals")
async def handle_journal(
    sleep_date: str = Form(...),
    bedtime: str = Form(...),
    wake_time: str = Form(...),
    quality: int = Form(...),
    notes: str = Form(""),
    user: dict = Depends(get_current_user),
    _origin=Depends(verify_request_origin),
):
    # Add your database insert here later.
    return {"message": "Journal inputs received. Nothing was saved."}
