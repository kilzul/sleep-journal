import os
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

password_hasher = PasswordHash.recommended()

DUMMY_PASSWORD_HASH = password_hasher.hash("unused-login-placeholder")

DB_URL = os.getenv("SUPABASE_DB_URL")


def connect_db():
    if not DB_URL:
        raise psycopg.OperationalError("SUPABASE_DB_URL is missing")
    return psycopg.connect(DB_URL, connect_timeout=5)


def insert_user(name: str, email: str, password: str) -> None:
    password_hash = password_hasher.hash(password)
    with connect_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO public.users (username, email, password_hash) VALUES (%s, %s, %s)",
                (name, email.strip().lower(), password_hash),
            )


def authenticate_user(email: str, password: str) -> dict | None:
    with connect_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, email, password_hash FROM public.users WHERE email = %s",
                (email.strip().lower(),),
            )
            user = cur.fetchone()

    stored_hash = user[3] if user and user[3] else DUMMY_PASSWORD_HASH
    try:
        password_matches = password_hasher.verify(password, stored_hash)
    except UnknownHashError:
        return None

    if not user or not user[3] or not password_matches:
        return None
    return {"id": user[0], "username": user[1], "email": user[2]}


def check_login(email: str, password: str) -> bool:
    return authenticate_user(email, password) is not None


def insert_journal(user_id, sleep_date, bedtime, wake_time, quality, notes):
    """Save a journal and return the fields used by the frontend's cards."""
    with connect_db() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """INSERT INTO public.journals
                       (user_id, sleep_date, bedtime, wake_time, quality, notes)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   RETURNING id, sleep_date, bedtime::time AS bedtime,
                             wake_time::time AS wake_time, quality, notes""",
                (user_id, sleep_date, bedtime, wake_time, quality, notes),
            )
            return cur.fetchone()


def get_user_journals(user_id):
    """Return only this user's journals, with the newest sleep date first."""
    with connect_db() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """SELECT id, sleep_date, bedtime::time AS bedtime,
                          wake_time::time AS wake_time, quality, notes
                   FROM public.journals
                   WHERE user_id = %s
                   ORDER BY sleep_date DESC, id DESC""",
                (user_id,),
            )
            return cur.fetchall()


def delete_journal(user_id, entry_id):
    """Delete an entry only when it belongs to the session's user."""
    with connect_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM public.journals WHERE id = %s AND user_id = %s RETURNING id",
                (entry_id, user_id),
            )
            return cur.fetchone() is not None
