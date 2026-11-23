# Skinny to Strong Tracker

A lightweight, mobile-friendly bodyweight training tracker. There are no accounts, passwords, or sign-in screens. A short first-run setup asks for age, weight, goals, and an exercise level; email and mobile number are optional.

## What it includes

- Five-exercise, three-session-per-week bodyweight plans, with warm-ups and rest timers.
- Progress, bodyweight, push-up tests, and CSV export.
- An adaptive coach that uses completed training sessions to suggest a level.
- Optional exercise demos with a 2D fallback if the 3D library cannot load.
- Automatic browser-local saving and a **Save now** action on the Plan page.

## Run locally

1. Install Node.js 18 or newer and npm.
2. Install dependencies:

   ```sh
   npm install
   ```

3. Start the app:

   ```sh
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000).

Set `PORT` to use a different port. Express serves the static app files; the server does not provide account or data APIs.

## Data and privacy

- The app saves the profile and all tracker progress in the browser's `localStorage`, automatically after changes. **Save now** on the Plan page writes the current data again on demand.
- Data stays in the current browser and device. It is not uploaded or synchronized, and it will not follow the user to another device or browser.
- Clearing site data, using private browsing, or browser storage restrictions can erase or prevent saving progress. The app displays a warning if a save fails.
- Email and mobile number are optional, stored only on this device, and never used for sign-in or verification.
- **Reset all data** removes the current browser's saved profile and progress.
- A CSV export is available for training history; it does not back up the full profile or app state.
- If you used the previous account-based version, the tracker data cached in this browser is moved to local storage and the old sign-in token is cleared. Data that exists only in the old server database is not imported.

See [Privacy & Terms](public/legal.html) for details.

## Project layout

```text
server.js           Static Express server
public/
  index.html        App shell
  app.js            Tracker UI, workout logic, and local persistence
  styles.css        Responsive styles and theme
  legal.html        Privacy notice and terms
package.json        Runtime and start script
```

The app has no frontend build step or framework. The adaptive coach runs in the browser and does not send workout data to an external AI service. Opening a 3D exercise demo may load Three.js from cdnjs; profile and workout data are not included in that request.

## Deploy

Deploy this repository to any Node.js host that supports `npm install` and `npm start`, or serve the `public/` directory as static files. If using a Node host, configure `PORT` if required by the provider. Since data is browser-local, server-side persistent storage is not needed; users should stay on the same browser/device to keep their progress.
