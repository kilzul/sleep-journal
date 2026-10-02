# Sleep Journal

This uses the same approach as the original test form:

```text
HTML form → POST request → Python Form(...) → print a dictionary
```

There is no CSS, JavaScript, or custom validation class. Nothing is written to the database, and signup/login do not authenticate users yet. Passwords are received but redacted in terminal output.

## Run and test

From the repository root:

```sh
source venv/bin/activate
uvicorn main:app --reload
```

Open **http://127.0.0.1:8000/**. If an older server is running, stop it with Ctrl+C first.

All sections are visible on one plain HTML page. Navigation has the original four selector spans; the frontend developer will add section visibility switching. Fill out Sign Up or Log In and submit it. The browser navigates to a JSON receipt, just like the original demo. Check the terminal where Uvicorn runs for the submitted dictionary. Use the browser Back button to return to the forms.

Overview, Calendar, and Statistics remain placeholders. Journals has its original `+` placeholder and empty container; the frontend developer will build the journal form.

## How the connection works

In `static/index.html`, each form has an `action` and `method="POST"`. The browser sends its inputs directly to that route. An input's `name` attribute matches an argument in the Python function:

```html
<form action="/api/signup" method="POST">
    <input name="name" required>
    <input name="email" type="email" required>
    <input name="password" type="password" required>
    <button type="submit">Sign Up</button>
</form>
```

In `main.py`, `handle_signup()` receives `name`, `email`, and `password` using `Form(...)`, builds a dictionary, prints it, and returns a message. The other handlers follow the same pattern.

| Form action | Python function | Input names |
| --- | --- | --- |
| `/api/signup` | `handle_signup()` | `name`, `email`, `password` |
| `/api/login` | `handle_login()` | `email`, `password` |
| `/api/journals` | `handle_journal()` | `sleep_date`, `bedtime`, `wake_time`, `quality`, `notes` |

The `/api/journals` handler is ready for a future form, but no journal form is currently in the HTML. It expects date/time strings, integer `quality`, and optional `notes` defaulting to an empty string. The frontend developer can use the listed names or agree on changes to the handler. `Form(...)` requires a field; `Form("")` makes it optional. This simple demo doesn't check sleep-time ordering or implement account validation.

To add database code yourself, use the received arguments inside each handler where its comment indicates. The original `backend/db.py` is still available, but this app does not import or call it. The actual password is available in the `password` argument for future authentication code; only the printed dictionary uses `[redacted]`.

## Changes

See [FRONTEND_CHANGES.md](FRONTEND_CHANGES.md) for the changes from the original frontend folder, including the HTML edits and form fields agreed with the backend.

- The real frontend is in `static/index.html`; the original demo HTML was removed.
- Removed CSS and JavaScript files and their HTML references.
- Restored the original four navigation selector spans and removed the added signup/login navigation buttons. Visibility switching will be added by the frontend developer. Every section/form is currently visible.
- Replaced JSON request models with ordinary Python functions using `Form(...)`.
- Each submission prints a dictionary and returns a JSON receipt. No database calls, in-page receipt handling, or custom validation classes.
- Removed the unused static asset mount since the app now serves only the HTML file.

The runtime needs `fastapi`, `uvicorn`, and `python-multipart`, already installed in the existing environment. No database credentials are needed for this demo.

## Message for the frontend developer

> Hey, I simplified the connection to use regular HTML forms. The frontend is in `static/index.html`. Signup and login use POST, and input names match Python's `Form(...)` arguments. They print dictionaries in the server terminal for now; passwords are redacted and nothing is saved. I'll add the database/auth code inside those functions. Journals is back to your original + placeholder so you can build it; the `/api/journals` backend handler is ready when you are. There's no CSS or JS right now, and submitting goes to a JSON receipt page. Let's keep form actions and input names agreed with the backend.
