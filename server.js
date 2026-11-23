// Simple login + database for the tracker: Express + built-in Node SQLite (one file: tracker.db). Needs Node 22.13+
const express = require("express"), { DatabaseSync } = require("node:sqlite"), crypto = require("crypto"), path = require("path");
const db = new DatabaseSync(process.env.DB_FILE || path.join(__dirname, "tracker.db"));
db.exec("PRAGMA journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, hash TEXT NOT NULL, salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created INTEGER NOT NULL, last_active INTEGER);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS data(user_id INTEGER PRIMARY KEY, state TEXT NOT NULL, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS password_resets(user_id INTEGER PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, expires INTEGER NOT NULL, last_sent INTEGER NOT NULL);`);

const now = () => Date.now(), sha = t => crypto.createHash("sha256").update(t).digest("hex");
const hashPw = (p, s) => crypto.scryptSync(p, s, 64).toString("hex");
const passwordScore = p => [p.length >= 8, /[a-z]/.test(p) && /[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
const validPassword = p => p.length <= 128 && passwordScore(p) >= 3;
const RESET_TTL = 30 * 60 * 1000, RESET_COOLDOWN = 60 * 1000;
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim(), RESET_MAIL_FROM = (process.env.MAIL_FROM || "").trim();
const RESET_ORIGIN = (() => {
  try {
    const u = new URL((process.env.APP_URL || "").trim());
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
    if (u.username || u.password || u.pathname !== "/" || u.search || u.hash) return "";
    if (u.protocol === "https:" || (process.env.NODE_ENV !== "production" && local && u.protocol === "http:")) return u.origin;
  } catch {}
  return "";
})();
const resetMailConfigured = !!(RESEND_API_KEY && RESET_MAIL_FROM && RESET_ORIGIN);
if ((RESEND_API_KEY || RESET_MAIL_FROM || process.env.APP_URL) && !resetMailConfigured) {
  console.error("Password reset is disabled: configure RESEND_API_KEY, MAIL_FROM, and a valid APP_URL (HTTPS in production).");
}
async function sendPasswordResetEmail(to, url) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json", "User-Agent": "tracker-app/1.0" },
    body: JSON.stringify({
      from: RESET_MAIL_FROM, to, subject: "Reset your HTF password",
      text: `Someone requested a password reset for your HTF account.\n\nUse this link within 30 minutes:\n${url}\n\nIf you did not request this, you can ignore this email. Your password has not been changed.`
    }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`Resend returned HTTP ${response.status}.`);
}
const addUser = (name, email, pw, role) => {
  const salt = crypto.randomBytes(16).toString("hex");
  return db.prepare("INSERT INTO users(name,email,hash,salt,role,created,last_active) VALUES(?,?,?,?,?,?,?)").run(name, email, hashPw(pw, salt), salt, role, now(), now()).lastInsertRowid;
};
// First start: create the host (admin) account
if (!db.prepare("SELECT 1 FROM users WHERE role='admin'").get()) {
  const email = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
  addUser("Host", email, pw, "admin");
  console.log(`Host account created -> email: ${email}  password: ${process.env.ADMIN_PASSWORD ? "(from ADMIN_PASSWORD)" : pw}`);
}

const issue = uid => { const t = crypto.randomBytes(32).toString("hex"); db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(sha(t), uid, now() + 30 * 864e5); return t; };
const pub = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const auth = (req, res, next) => {
  const t = (req.headers.authorization || "").slice(7);
  const u = t && db.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?").get(sha(t), now());
  if (!u) return res.status(401).json({ error: "Please log in again." });
  req.user = u; req.tok = sha(t); next();
};
const host = (req, res, next) => req.user.role === "admin" ? next() : res.status(403).json({ error: "Host access only." });
const hits = new Map();
const limit = (req, res, next) => {
  const h = (hits.get(req.ip) || []).filter(t => t > now() - 9e5);
  if (h.length >= 20) return res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
  h.push(now()); hits.set(req.ip, h); next();
};
const load = id => { const r = db.prepare("SELECT state, updated FROM data WHERE user_id=?").get(id); return r ? { state: JSON.parse(r.state), updated: r.updated } : { state: null, updated: 0 }; };
const summary = s => {
  s = s || {}; const log = s.log || [], hist = s.hist || [], bw = s.bw || [], L = hist.slice(-6);
  const avg = f => L.length ? L.reduce((a, x) => a + f(x), 0) / L.length : null;
  return { sessions: log.filter(x => !x.part).length, partial: log.filter(x => x.part).length, week: s.week || 1, level: s.track || "A",
    comp: avg(x => x.n / 15), reps: avg(x => x.ra), bw0: bw[0] ? bw[0].v : null, bw1: bw.length ? bw[bw.length - 1].v : null, inSession: !!s.start };
};

const clamp = (v, a, b, d) => { v = +v; return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
const pick = (v, list, d) => list.includes(v) ? v : d;
const cleanProfile = p => { p = p && typeof p === "object" ? p : {}; return {
  age: clamp(p.age, 10, 90, 20), gender: pick(p.gender, ["male", "female", "other"], "male"), height: clamp(p.height, 100, 230, 170),
  weight: clamp(p.weight, 25, 250, 55), goalW: clamp(p.goalW, 25, 250, 60), goal: pick(p.goal, ["gain", "maintain", "lose"], "gain"),
  act: pick(p.act, ["sed", "light", "mod", "act"], "light"), push: clamp(p.push, 0, 200, 4), exp: pick(p.exp, ["new", "some", "reg"], "new"),
  phone: String(p.phone || "").replace(/[^\d+().\-\s]/g, "").trim().slice(0, 32),
  diet: pick(p.diet, ["veg", "egg", "non"], "egg"), lim: (Array.isArray(p.lim) ? p.lim : []).filter(x => ["none", "wrist", "shoulder", "knee", "back"].includes(x)).slice(0, 5),
  plan: pick(p.plan, ["A", "B", "C", "D"], "A") }; };

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
if (process.env.CORS_ORIGIN) app.use((req, res, next) => { // only needed if the page is hosted on another domain
  res.set({ "Access-Control-Allow-Origin": process.env.CORS_ORIGIN, "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS" });
  req.method === "OPTIONS" ? res.sendStatus(204) : next();
});

app.post("/api/signup", limit, (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 60), email = String(req.body.email || "").trim().toLowerCase(), pw = String(req.body.password || "");
  if (!name) return res.status(400).json({ error: "Enter your name." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (pw.length < 8 || pw.length > 128) return res.status(400).json({ error: "Use a password between 8 and 128 characters." });
  if (!validPassword(pw)) return res.status(400).json({ error: "Make the password stronger by using more character types." });
  try { const id = addUser(name, email, pw, "user");
    if (req.body.profile) { // body details + chosen free plan from the sign-up questions become the starting data
      const pr = cleanProfile(req.body.profile), t = now();
      db.prepare("INSERT INTO data(user_id,state,updated) VALUES(?,?,?)").run(id, JSON.stringify({ profile: pr, track: pr.plan, sk: "ABCD".indexOf(pr.plan), bw: [{ d: t, v: pr.weight }], _u: t }), t);
    }
    res.json({ token: issue(id), user: pub({ id, name, email, role: "user" }) }); }
  catch (e) { res.status(409).json({ error: "That email already has an account. Log in instead." }); }
});
app.post("/api/password-reset", limit, (req, res) => {
  if (!resetMailConfigured) return res.status(503).json({ error: "Password reset is not configured. Contact the site administrator." });
  const email = String(req.body.email || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  const user = db.prepare("SELECT id,email FROM users WHERE email=?").get(email);
  if (user) {
    const previous = db.prepare("SELECT token_hash,expires,last_sent FROM password_resets WHERE user_id=?").get(user.id);
    if (!previous || now() - previous.last_sent >= RESET_COOLDOWN) {
      const token = crypto.randomBytes(32).toString("base64url"), tokenHash = sha(token), sentAt = now();
      db.prepare(`INSERT INTO password_resets(user_id,token_hash,expires,last_sent) VALUES(?,?,?,?)
        ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash,expires=excluded.expires,last_sent=excluded.last_sent`)
        .run(user.id, tokenHash, sentAt + RESET_TTL, sentAt);
      void sendPasswordResetEmail(email, `${RESET_ORIGIN}/reset-password.html#${token}`).catch(error => {
        try {
          if (previous) db.prepare("UPDATE password_resets SET token_hash=?,expires=?,last_sent=? WHERE user_id=? AND token_hash=?").run(previous.token_hash, previous.expires, previous.last_sent, user.id, tokenHash);
          else db.prepare("DELETE FROM password_resets WHERE user_id=? AND token_hash=?").run(user.id, tokenHash);
        } catch (restoreError) { console.error("Could not restore the previous password reset token.", restoreError); }
        console.error("Password reset email delivery failed.", error);
      });
    }
  }
  res.status(202).json({ message: "If an account exists for that email, a reset link may arrive shortly. Check spam; if no email arrives, contact the site administrator." });
});
app.post("/api/password-reset/confirm", limit, (req, res) => {
  const token = String(req.body.token || ""), password = String(req.body.password || "");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return res.status(400).json({ error: "This reset link is invalid or expired. Request a new one." });
  if (password.length < 8 || password.length > 128 || !validPassword(password)) return res.status(400).json({ error: "Use 8 to 128 characters and a stronger mix of character types." });
  const tokenHash = sha(token);
  db.exec("BEGIN IMMEDIATE");
  try {
    const reset = db.prepare("SELECT user_id,expires FROM password_resets WHERE token_hash=?").get(tokenHash);
    if (!reset || reset.expires <= now()) {
      db.exec("ROLLBACK");
      return res.status(400).json({ error: "This reset link is invalid or expired. Request a new one." });
    }
    const salt = crypto.randomBytes(16).toString("hex");
    const updated = db.prepare("UPDATE users SET hash=?,salt=? WHERE id=?").run(hashPw(password, salt), salt, reset.user_id);
    if (updated.changes !== 1) {
      db.exec("ROLLBACK");
      return res.status(400).json({ error: "This reset link is invalid or expired. Request a new one." });
    }
    db.prepare("DELETE FROM password_resets WHERE user_id=?").run(reset.user_id);
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(reset.user_id);
    db.exec("COMMIT");
    res.json({ message: "Password updated. Sign in with your new password." });
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch (rollbackError) { console.error("Could not roll back a password reset.", rollbackError); }
    console.error("Password reset failed.", error);
    res.status(500).json({ error: "We could not reset the password. Try again or contact the site administrator." });
  }
});
app.post("/api/login", limit, (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE email=?").get(String(req.body.email || "").trim().toLowerCase());
  const ok = u && crypto.timingSafeEqual(Buffer.from(hashPw(String(req.body.password || ""), u.salt), "hex"), Buffer.from(u.hash, "hex"));
  if (!ok) return res.status(401).json({ error: "Wrong email or password." });
  db.prepare("UPDATE users SET last_active=? WHERE id=?").run(now(), u.id);
  res.json({ token: issue(u.id), user: pub(u) });
});
app.post("/api/logout", auth, (req, res) => { db.prepare("DELETE FROM sessions WHERE token=?").run(req.tok); res.json({ ok: true }); });
app.get("/api/me", auth, (req, res) => res.json({ user: pub(req.user), ...load(req.user.id) }));
app.put("/api/data", auth, (req, res) => {
  const s = req.body.state;
  if (!s || typeof s !== "object" || Array.isArray(s)) return res.status(400).json({ error: "Invalid data." });
  const t = now();
  db.prepare("INSERT INTO data(user_id,state,updated) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET state=excluded.state, updated=excluded.updated").run(req.user.id, JSON.stringify(s), t);
  db.prepare("UPDATE users SET last_active=? WHERE id=?").run(t, req.user.id);
  res.json({ updated: t });
});

// Host dashboard
app.get("/api/admin/users", auth, host, (req, res) => {
  const users = db.prepare("SELECT id,name,email,created,last_active FROM users WHERE role='user' ORDER BY last_active DESC").all()
    .map(u => ({ ...u, sum: summary(load(u.id).state) }));
  res.json({ users });
});
app.get("/api/admin/users/:id", auth, host, (req, res) => {
  const u = db.prepare("SELECT id,name,email,created,last_active FROM users WHERE id=? AND role='user'").get(+req.params.id);
  if (!u) return res.status(404).json({ error: "User not found." });
  const s = load(u.id).state || {};
  res.json({ user: u, profile: s.profile || null, sum: summary(s), hist: (s.hist || []).slice(-12), bw: (s.bw || []).slice(-8), pt: (s.pt || []).slice(-5) });
});

app.use(express.static(path.join(__dirname, "public")));
app.listen(process.env.PORT || 3000, () => console.log(`Tracker running on http://localhost:${process.env.PORT || 3000}`));
