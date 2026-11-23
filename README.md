# Skinny to Strong tracker, with login

## Run it
1. Install Node.js 22.13 or newer (the database is built into Node, so nothing needs compiling).
2. In this folder run: `npm install`
3. Start it (set your own host login):
   - Mac/Linux: `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=choose-a-strong-one npm start`
   - Windows PowerShell: `$env:ADMIN_EMAIL="you@example.com"; $env:ADMIN_PASSWORD="choose-a-strong-one"; npm start`
4. Open http://localhost:3000

If you skip ADMIN_PASSWORD, a random host password is printed in the terminal on the first start.
The host account is created once. After that, changing the variables does nothing.

## How it works
- Users sign up and log in. Each user's training data is saved in `tracker.db` (SQLite) and also cached on their device.
- Log in with the host account to see a **Host** tab: total users, who was active this week, sessions done, and each user's level, week, sessions, body weight and recent sessions.
- Passwords are stored as salted scrypt hashes. Nobody, including the host, can read them.

## Putting it online
- Use a host with a persistent disk (Render, Railway, Fly.io, a VPS) so `tracker.db` is not wiped on restart. Back it up.
- Serve it over HTTPS. Without HTTPS, passwords travel in plain text.
- Set `PORT` if your host needs it. If the page lives on a different domain than the server, set `CORS_ORIGIN=https://your-site.com` and add `<script>window.API_BASE="https://your-api.com"</script>` before the main script in `public/index.html`.

## New in this version
- Lucide icons throughout, with a bottom nav that has icons.
- Login and sign-up with show/hide password, a strength meter and confirm-password.
- Sign-up asks for age, gender, height, weight, goal weight, goal, daily activity, push-up level, experience, food type and any pain limits. Then it picks a level from your answers. All plans are free and you can change them.
- Calories, protein and the food list now come from your profile. Existing accounts are asked these questions once on next login.
- Guided warm-up (4 steps with demo and timer) before the main sets. Fixed the crash that stopped the 3D demo from playing on warm-up moves.
