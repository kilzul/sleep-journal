import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from fastapi import HTTPException, Request, Response

from backend.db import connect_db

COOKIE_NAME = "sleep_journal_session"
SESSION_SECONDS = 7 * 24 * 60 * 60
APP_ORIGIN = os.getenv("APP_URL", "http://127.0.0.1:8000").rstrip("/")
COOKIE_SECURE = urlsplit(APP_ORIGIN).scheme == "https"


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(user_id: int, previous_token: str | None = None) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=SESSION_SECONDS)
    with connect_db() as conn:
        with conn.cursor() as cur:
            if previous_token:
                cur.execute("DELETE FROM public.user_sessions WHERE token_hash = %s", (token_hash(previous_token),))
            cur.execute("DELETE FROM public.user_sessions WHERE user_id = %s AND expires_at <= CURRENT_TIMESTAMP", (user_id,))
            cur.execute(
                "INSERT INTO public.user_sessions (token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
                (token_hash(token), user_id, expires_at),
            )
    return token, expires_at


def set_session_cookie(response: Response, token: str, expires_at: datetime) -> None:
    response.set_cookie(
        COOKIE_NAME, token, max_age=SESSION_SECONDS, expires=expires_at,
        httponly=True, secure=COOKIE_SECURE, samesite="lax", path="/",
    )


def revoke_session(token: str) -> None:
    with connect_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM public.user_sessions WHERE token_hash = %s", (token_hash(token),))


def get_current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token or len(token) != 43:
        raise HTTPException(status_code=401, detail="Please log in.")
    with connect_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT u.id, u.username, u.email
                   FROM public.user_sessions s JOIN public.users u ON u.id = s.user_id
                   WHERE s.token_hash = %s AND s.expires_at > CURRENT_TIMESTAMP""",
                (token_hash(token),),
            )
            user = cur.fetchone()
    if not user:
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please log in.")
    return {"id": user[0], "username": user[1], "email": user[2]}


def verify_request_origin(request: Request) -> None:
    """Reject cross-site browser writes, including login and logout CSRF."""
    if request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(status_code=403, detail="Cross-site requests are not allowed.")
    source = request.headers.get("origin") or request.headers.get("referer")
    if source:
        parsed = urlsplit(source)
        expected = urlsplit(APP_ORIGIN)
        if (parsed.scheme, parsed.netloc) != (expected.scheme, expected.netloc):
            raise HTTPException(status_code=403, detail="Request origin is not allowed.")
