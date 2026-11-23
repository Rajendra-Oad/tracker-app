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
  api-config.js     Shared frontend/API origin configuration
  app.js            Tracker UI, workout logic, and adaptive coach
  styles.css        Responsive styles and theme
  legal.html        Privacy notice and terms of use
  forgot-password.html  Request a password reset
  reset-password.html   Set a new password from an email link
  password-reset.js     Password reset form behavior
package.json        Runtime requirement and start command
```

The app has no frontend build step or frontend framework. Express serves the files in `public/`.

## Accounts and saved data

- Sign-up creates a user account and saves the initial profile and plan.
- Sign-up asks for a mobile number as contact-only profile information, with a country-code picker defaulting to India (+91). Email and password remain the sign-in credentials; phone-number login and SMS verification are not supported.
- Profile setup asks about goal weight and fitness focus on separate screens.
- Sign-up links to [Privacy & Terms](public/legal.html), which explains stored data, host access, browser storage, and the tracker's intended use. The host should review it for their deployment before public use.
- Passwords are stored as salted `scrypt` hashes; the original password is not stored.
- The login screen includes email-based password recovery when the host configures a verified sending domain and email API key.
- Each user's tracker state is stored in SQLite and cached in that user's browser.
- The host account can view users' training progress and profile details. Tell users about this access before they sign up.
- Back up the database file regularly. It contains account and training data.

## Password recovery setup

Password reset emails use the Resend API through Node's built-in `fetch`; no extra package is required. Resend currently lists a free transactional-email tier with up to 3,000 emails per month and 100 per day. A verified domain is required to send from your own address; check the current [Resend pricing](https://resend.com/pricing) and [verified-domain setup](https://resend.com/docs/dashboard/domains/introduction).

1. Add your sending domain in Resend and publish the DNS records it provides.
2. Create an API key for sending email.
3. Configure the app's public origin and sender address, then restart the server.

   **Windows PowerShell:**

   ```powershell
   $env:RESEND_API_KEY = "re_your_key"
   $env:MAIL_FROM = "HTF <accounts@yourdomain.com>"
   $env:APP_URL = "https://tracker.yourdomain.com"
   npm start
   ```

   **macOS / Linux:**

   ```sh
   RESEND_API_KEY='re_your_key' MAIL_FROM='HTF <accounts@yourdomain.com>' APP_URL='https://tracker.yourdomain.com' npm start
   ```

`APP_URL` must be the site's origin (no path); production reset links require HTTPS. Keep the API key in the host's secret/environment settings, never in source control. Reset links are single-use, expire after 30 minutes, and changing a password signs out active sessions. Requests do not reveal whether an email address has an account. If email settings are missing, the reset page tells the user to contact the host. The Resend free tier and limits can change.

## How the adaptive coach works

The coach is a small, explainable **heuristic**, not a trained machine-learning model and not a medical assessment. After at least three completed sessions, it combines workout completion, reps relative to the plan, and reps in reserve (RIR) to maintain a bounded skill estimate and suggest a training level. Incomplete sessions remain in the history but do not update the estimate or count toward coach recommendations. The calculation runs in the browser; it does not send training data to an external model.

## API overview

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/signup` | Create an account |
| `POST` | `/api/login` | Sign in |
| `POST` | `/api/logout` | Revoke the current session |
| `POST` | `/api/password-reset` | Request a reset email |
| `POST` | `/api/password-reset/confirm` | Set a new password using a reset link |
| `GET` | `/api/me` | Read the signed-in user and saved tracker state |
| `PUT` | `/api/data` | Save tracker state |
| `GET` | `/api/admin/users` | List users (host only) |
| `GET` | `/api/admin/users/:id` | View a user's progress (host only) |

Authenticated API calls use `Authorization: Bearer <token>`. Sessions expire after 30 days.

## Deploy on Render

1. In Render, create a **Web Service** for this repository and deploy the `main` branch. Leave **Root Directory** empty. Use `npm install` as the build command and `npm start` as the start command.
2. In the service's **Environment** settings, add:

   | Key | Value |
   | --- | --- |
   | `NODE_VERSION` | `24.22.1` (or another supported version at least `22.13`) |
   | `NODE_ENV` | `production` |
   | `ADMIN_EMAIL` | The host account email (set before the database creates its first admin) |
   | `ADMIN_PASSWORD` | A strong, unique host password (set before the database creates its first admin) |
   | `RESEND_API_KEY` | Your Resend API key; keep it in Render, not Git |
   | `MAIL_FROM` | For example, `HTF <accounts@yourdomain.com>` |
   | `APP_URL` | The service's public HTTPS origin, such as `https://your-service.onrender.com` |

   `MAIL_FROM` must use a domain you own and have verified in Resend. Add that domain in Resend, publish its DNS records, then create an API key. `APP_URL` must be the public HTTPS origin without a path. Save the variables and deploy the service. Render supplies `PORT`; the app listens on it automatically. For a single Render service serving both the UI and API, leave `window.API_BASE` empty.

3. **Keep the SQLite database persistent.** Render's default filesystem is ephemeral, so the app's account and tracker data can be lost when the service restarts or deploys. Attach a persistent disk to the web service (available on paid services), mount it at `/var/data`, and add `DB_FILE=/var/data/tracker.db`. A free service without a persistent disk is suitable only for testing this SQLite setup; durable production data needs a persistent disk or a database migration.
4. After deployment, open `https://your-service.onrender.com/forgot-password.html` and request a reset for an account email. The response intentionally does not reveal whether the account exists; check the inbox and spam folder.

See Render's [web service](https://render.com/docs/web-services), [environment variable](https://render.com/docs/configure-environment-variables), [Node version](https://render.com/docs/node-version), and [persistent disk](https://render.com/docs/disks) guides, plus Resend's [verified-domain guide](https://resend.com/docs/dashboard/domains/introduction).

## Deployment notes

- Use a host with persistent storage for the SQLite database and configure `DB_FILE` if needed.
- Put the app behind HTTPS before collecting real credentials. Do not expose it over plain HTTP on a public network.
- Configure `ADMIN_EMAIL` and `ADMIN_PASSWORD` before the first start, and use a unique, strong password.
- If the frontend and API are on different origins, set `CORS_ORIGIN` to the exact frontend origin and set `window.API_BASE` to the API origin in `public/api-config.js`. The shared config is loaded by the tracker and password-recovery pages.
- Restart or redeploy the Node server after updating `server.js`; a running process does not load new API routes automatically.
- Keep regular, restorable database backups. The SQLite database and its `-wal` / `-shm` sidecar files are ignored by Git.

## Performance

The sign-in screen and tracker shell do not load a CSS framework or the 3D renderer. The exercise renderer is fetched only when a demo is opened; a lightweight 2D demo remains available if that request fails. The application otherwise uses the browser's built-in APIs and system fonts.
