import os
from pathlib import Path

import psycopg
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


def check_login(email: str, password: str) -> bool:
    with connect_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT password_hash FROM public.users WHERE email = %s",
                (email.strip().lower(),),
            )
            user = cur.fetchone()

    stored_hash = user[0] if user and user[0] else DUMMY_PASSWORD_HASH
    try:
        password_matches = password_hasher.verify(password, stored_hash)
    except UnknownHashError:
        return False

    return bool(user and user[0] and password_matches)
