import psycopg;
import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

DB_URL = os.getenv("SUPABASE_DB_URL")

def insert_login(name, email):
    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO users (username, email) VALUES (%s, %s)", (name, email))





