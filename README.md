# Skinny to Strong Tracker

A lightweight, mobile-friendly bodyweight training tracker. Create an account, follow an eight-week plan, log workouts and bodyweight, and review a coach that adapts to completed training sessions.

## What it includes

- Email and password sign-up and login, with salted password hashes.
- A five-exercise, three-session-per-week training plan with warm-ups and rest timers.
- Progress, bodyweight, push-up tests, food targets, and CSV export.
- An adaptive coach that uses completed workout data to suggest a training level.
- An optional exercise demo with a 2D fallback if the 3D library cannot load.
- An admin dashboard for the host to review user activity and training progress.

## Requirements

- Node.js **22.13 or newer** (the app uses Node's built-in SQLite module).
- npm.

## Run locally

1. Install dependencies:

   ```sh
   npm install
   ```

2. Set a host email and password, then start the server.

   **Windows PowerShell:**

   ```powershell
   $env:ADMIN_EMAIL = "you@example.com"
   $env:ADMIN_PASSWORD = "choose-a-strong-password"
   npm start
   ```

   **macOS / Linux:**

   ```sh
   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='choose-a-strong-password' npm start
   ```

3. Open [http://localhost:3000](http://localhost:3000).

If `ADMIN_PASSWORD` is omitted on the first run, the server creates a random host password and prints it in the terminal. The host account is created only once; changing these environment variables later does not change an existing account's credentials. Do not use the example credentials on a public server.

Set `PORT` to use a different port. Set `DB_FILE` to store the SQLite database somewhere other than `tracker.db` in the project directory.

## Project layout

```text
server.js           Express API, authentication, and SQLite persistence
public/
  index.html        App shell
  app.js            Tracker UI, workout logic, and adaptive coach
  styles.css        Responsive styles and theme
package.json        Runtime requirement and start command
```

The app has no frontend build step or frontend framework. Express serves the files in `public/`.

## Accounts and saved data

- Sign-up creates a user account and saves the initial profile and plan.
- Sign-up asks for a mobile number as contact-only profile information. Email and password remain the sign-in credentials; phone-number login and SMS verification are not supported.
- Passwords are stored as salted `scrypt` hashes; the original password is not stored.
- Each user's tracker state is stored in SQLite and cached in that user's browser.
- The host account can view users' training progress and profile details. Tell users about this access before they sign up.
- Back up the database file regularly. It contains account and training data.

## How the adaptive coach works

The coach is a small, explainable **heuristic**, not a trained machine-learning model and not a medical assessment. After at least three completed sessions, it combines workout completion, reps relative to the plan, and reps in reserve (RIR) to maintain a bounded skill estimate and suggest a training level. Incomplete sessions remain in the history but do not update the estimate or count toward coach recommendations. The calculation runs in the browser; it does not send training data to an external model.

## API overview

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/signup` | Create an account |
| `POST` | `/api/login` | Sign in |
| `POST` | `/api/logout` | Revoke the current session |
| `GET` | `/api/me` | Read the signed-in user and saved tracker state |
| `PUT` | `/api/data` | Save tracker state |
| `GET` | `/api/admin/users` | List users (host only) |
| `GET` | `/api/admin/users/:id` | View a user's progress (host only) |

Authenticated API calls use `Authorization: Bearer <token>`. Sessions expire after 30 days.

## Deployment notes

- Use a host with persistent storage for the SQLite database and configure `DB_FILE` if needed.
- Put the app behind HTTPS before collecting real credentials. Do not expose it over plain HTTP on a public network.
- Configure `ADMIN_EMAIL` and `ADMIN_PASSWORD` before the first start, and use a unique, strong password.
- If the frontend and API are on different origins, set `CORS_ORIGIN` to the exact frontend origin and set `window.API_BASE` to the API URL before `app.js` loads in `public/index.html`.
- Keep regular, restorable database backups. The SQLite database and its `-wal` / `-shm` sidecar files are ignored by Git.

## Performance

The sign-in screen and tracker shell do not load a CSS framework or the 3D renderer. The exercise renderer is fetched only when a demo is opened; a lightweight 2D demo remains available if that request fails. The application otherwise uses the browser's built-in APIs and system fonts.
