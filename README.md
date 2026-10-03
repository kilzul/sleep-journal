# Sleep Journal

The frontend uses ordinary HTML POST forms and Python functions with `Form(...)`. Signup saves the name, email, and an Argon2 password hash in your own `public.users` table. Login checks the submitted password against that hash. The database is hosted on Supabase; this flow uses Postgres directly.

```text
HTML form → POST request → Python Form(...) → database function → JSON message
```

## Run and test

From the repository root:

```sh
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The root `.env` needs your existing Postgres connection string:

```env
SUPABASE_DB_URL=your_postgres_connection_string
```

Keep `.env` private. The Supabase API URL, publishable key, and `APP_URL` are no longer used. Restart Uvicorn after changing environment settings.

1. Open **http://127.0.0.1:8000/** and submit the Sign Up form.
2. The browser shows `Signup successful. You can now log in.` The account is saved in `public.users`; no confirmation email is sent.
3. Use the browser Back button or reopen the root page, then submit Log In with the same email and password.
4. A matching password returns `{"message": "Login successful"}` to the browser.
5. Try a wrong password: the response is `Incorrect email or password.` with status 401. A missing account or an old row without a password hash gets the same error.

Accounts previously created through Supabase Auth are separate from `public.users`. Sign up through this form to create an account for this implementation. Existing database rows and Supabase Auth accounts are preserved. Older `public.users` rows with uppercase letters in their email need their email lowercased to match this lookup.

## What changed

- `main.py` calls `insert_user()` for signup and `check_login()` for login. These remain plain functions using `Form(...)`.
- `backend/db.py` keeps your signup hashing code and adds `check_login()`. It looks up the stored hash by email, then calls `password_hasher.verify(password, stored_hash)`. It does not hash the login password again and compare strings, because hashes contain a random salt.
- Both database functions trim and lowercase emails. Passwords are passed through exactly as submitted. SQL uses parameters rather than putting input into SQL strings.
- The existing `password_hash` column is used; no table changes were needed. Your database already requires unique usernames and emails, so duplicate signup returns status 409.
- Database failures return a short status 503 response. Debug prints and their unused dictionaries have been removed. Passwords, stored hashes, and connection strings are never printed or returned.
- Removed the Supabase Auth helper `backend/auth.py`, its signup/login calls, email confirmation handling, and the SDK dependencies. Added `pwdlib[argon2]` to `requirements.txt`.
- In `static/index.html`, only the notice text changed in this step. Form actions, input names, layout, original selector spans, and the journal `+` placeholder are unchanged.

There is still no JavaScript, CSS, or custom request class. **Login checks credentials; it does not yet create a cookie or session that keeps the browser logged in.** Journal submission returns a receipt without saving inputs, and journal storage remains for you to implement.

## Form connections

| Form action | Python function | Input names |
| --- | --- | --- |
| `/api/signup` | `handle_signup()` | `name`, `email`, `password` |
| `/api/login` | `handle_login()` | `email`, `password` |
| `/api/journals` | `handle_journal()` | `sleep_date`, `bedtime`, `wake_time`, `quality`, `notes` |

Use `method="POST"` and input `name` attributes matching the Python arguments. Ordinary form submission opens the JSON response. The frontend developer can later use JavaScript to display that message on the page, switch sections, and build the journal form.

## Informal message for the frontend developer

> Hey, signup and login work through normal HTML POST forms now. Signup sends name/email/password to `/api/signup`; Python hashes the password and saves it in our users table. Login sends email/password to `/api/login`; Python checks the stored hash and returns a Login successful message or an error. The layout and existing IDs stay the same, so you can still handle interactivity on your side. The handlers return JSON responses without debug prints. Sessions and journal storage are still to be added.

References: [FastAPI password hashing](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/#password-hashing), [pwdlib hash verification](https://frankie567.github.io/pwdlib/reference/pwdlib/).
