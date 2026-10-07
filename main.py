from datetime import date, datetime, time, timedelta
from pathlib import Path

from fastapi import Depends, FastAPI, Form, HTTPException, Path as PathParam, Query, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from psycopg import Error
from psycopg.errors import UniqueViolation

from backend.db import (
    authenticate_user, delete_journal, get_user_journals, insert_journal, insert_user,
    get_settings, update_settings, delete_account,
)
from backend.stats import calculate_stats
from backend.sessions import (
    COOKIE_NAME, COOKIE_SECURE, create_session, get_current_user,
    revoke_session, set_session_cookie, verify_request_origin,
)


app = FastAPI()
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
HTML_FILE = STATIC_DIR / "index.html"

# The backend branch can run without the frontend files. Serve them when present.
if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    for folder in ("css", "js", "fonts"):
        directory = STATIC_DIR / folder
        if directory.is_dir():
            app.mount(f"/{folder}", StaticFiles(directory=directory), name=folder)


@app.get("/api/settings")
def read_settings(response: Response, user: dict = Depends(get_current_user)):
    response.headers["Cache-Control"] = "no-store"
    return get_settings(user["id"])


@app.put("/api/settings")
def save_settings(response: Response, username: str = Form(..., min_length=1, max_length=100),
                  sleep_goal_hours: float = Form(..., ge=1, le=16), target_wake_time: time = Form(...),
                  user: dict = Depends(get_current_user), _origin=Depends(verify_request_origin)):
    if not username.strip() or target_wake_time.tzinfo is not None:
        raise HTTPException(status_code=422, detail="Enter a name and a local wake-up time.")
    response.headers["Cache-Control"] = "no-store"
    try:
        return update_settings(user["id"], username.strip(), sleep_goal_hours, target_wake_time)
    except UniqueViolation:
        raise HTTPException(status_code=409, detail="That name is already taken.")


@app.get("/api/stats")
def read_stats(response: Response, days: int = Query(30, ge=1, le=365), today: date | None = Query(None),
               user: dict = Depends(get_current_user)):
    response.headers["Cache-Control"] = "no-store"
    return calculate_stats(get_user_journals(user["id"]), get_settings(user["id"]), days, today)


@app.delete("/api/account", status_code=204)
def remove_account(response: Response, password: str = Form(...), user: dict = Depends(get_current_user),
                   _origin=Depends(verify_request_origin)):
    if not delete_account(user["id"], password):
        raise HTTPException(status_code=403, detail="Incorrect password. Account was not deleted.")
    response.delete_cookie(COOKIE_NAME, path="/", secure=COOKIE_SECURE, httponly=True, samesite="lax")
    response.status_code = 204
    response.headers["Cache-Control"] = "no-store"
    return response

@app.exception_handler(Error)
def handle_database_error(request, error):
    # Keep database connection details out of the response.
    return JSONResponse(
        status_code=503,
        content={"detail": "Database unavailable. Check SUPABASE_DB_URL in .env and try again."},
    )


@app.get("/")
async def read_index():
    if not HTML_FILE.is_file():
        raise HTTPException(status_code=404, detail="Frontend files are not present. The backend API is available at /docs.")
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


def save_journal(user_id, sleep_date, bedtime, wake_time, quality, notes):
    """The sleep date is the bedtime's date; earlier wake times mean the next day."""
    if bedtime.tzinfo is not None or wake_time.tzinfo is not None:
        raise HTTPException(status_code=422, detail="Use local times without a timezone, such as 23:00.")
    if bedtime == wake_time:
        raise HTTPException(status_code=422, detail="Bedtime and wake-up time must be different.")

    bed_at = datetime.combine(sleep_date, bedtime)
    wake_at = datetime.combine(sleep_date, wake_time)
    if wake_time < bedtime:
        wake_at += timedelta(days=1)

    return insert_journal(user_id, sleep_date, bed_at, wake_at, quality, notes)


@app.get("/api/entries")
def list_journals(response: Response, user: dict = Depends(get_current_user)):
    """Return an array directly, as expected by the frontend's renderEntries()."""
    response.headers["Cache-Control"] = "no-store"
    return get_user_journals(user["id"])


@app.post("/api/entries", status_code=201)
@app.post("/api/journals", status_code=201)
def handle_entry(
    response: Response,
    sleep_date: date = Form(...),
    bedtime: time = Form(...),
    wake_time: time = Form(...),
    quality: int = Form(..., ge=1, le=5),
    notes: str = Form("", max_length=200),
    user: dict = Depends(get_current_user),
    _origin=Depends(verify_request_origin),
):
    """Accept the frontend's FormData; both paths save through the same function."""
    response.headers["Cache-Control"] = "no-store"
    return save_journal(user["id"], sleep_date, bedtime, wake_time, quality, notes)


@app.delete("/api/entries/{entry_id}", status_code=204)
def handle_delete_journal(
    entry_id: int = PathParam(..., gt=0),
    user: dict = Depends(get_current_user),
    _origin=Depends(verify_request_origin),
):
    if not delete_journal(user["id"], entry_id):
        raise HTTPException(status_code=404, detail="Journal not found.")
    return Response(status_code=204, headers={"Cache-Control": "no-store"})
