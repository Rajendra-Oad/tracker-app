import { lazy, Suspense, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { EXERCISES, WARMUPS } from "./data/training";

const ExerciseScene = lazy(() => import("./components/ExerciseScene"));

const STORAGE_KEY = "bw-tracker-v1";
const LEVELS = ["A", "B", "C", "D"];
const LEVEL_NAMES = { A: "Beginner", B: "Intermediate", C: "Advanced", D: "Ultra" };
const BODY_PARTS = [
  { name: "Arms", keywords: ["biceps", "triceps", "forearm", "grip"] },
  { name: "Back", keywords: ["back", "lat", "rhomboid", "trapezius", "erector"] },
  { name: "Chest", keywords: ["chest", "pectoral"] },
  { name: "Core", keywords: ["core", "ab", "oblique", "hip flexor"] },
  { name: "Legs", keywords: ["quad", "glute", "hamstring", "calf", "soleus", "leg"] },
  { name: "Shoulders", keywords: ["shoulder", "deltoid", "rotator cuff", "traps"] },
];
const defaultState = {
  profile: null,
  profileDraft: null,
  profileStep: 1,
  theme: "system",
  week: 1,
  track: "A",
  done: 0,
  sets: {},
  sd: {},
  log: [],
  hist: [],
  bw: [],
  warm: [],
  start: null,
};

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return defaultState;
  }
}

function Icon({ name, size = 20 }) {
  const paths = {
    dumbbell: <><path d="M6.5 7.5v9M3.5 9.5v5M17.5 7.5v9M20.5 9.5v5M6.5 12h11" /></>,
    checks: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m7.5 12 3 3 6-7" /></>,
    trend: <><path d="M4 18V9M10 18V5M16 18v-6M22 18V3" /><path d="M2 21h20" /></>,
    play: <path d="m8.5 5.5 9 6.5-9 6.5Z" />,
    pause: <><path d="M9 6v12M15 6v12" /></>,
    left: <path d="m14.5 5-7 7 7 7" />,
    right: <path d="m9.5 5 7 7-7 7" />,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.6-3.1 3.2-5 7-5s6.4 1.9 7 5" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    check: <path d="m5 12 4.5 4.5L19 7" />,
    slow: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || null}</svg>;
}

function ProfileSetup({ state, setState, onCancel, onComplete, nameOnly = false }) {
  const [step, setStep] = useState(nameOnly ? 1 : state.profileStep || 1);
  const [draft, setDraft] = useState({
    name: state.profile?.name || "",
    gender: state.profile?.gender || "male",
    frequency: String(state.profile?.frequency || 3),
    objective: state.profile?.objective || "muscle",
    age: String(state.profile?.age || 25),
    height: String(state.profile?.height || 175),
    weight: String(state.profile?.weight || 70),
    goalW: String(state.profile?.goalW || 75),
    goal: state.profile?.goal || "gain",
    plan: 0,
    ...(state.profileDraft || {}),
    name: typeof state.profileDraft?.name === "string" ? state.profileDraft.name : state.profile?.name || "",
  });
  const [error, setError] = useState("");
  const [direction, setDirection] = useState("forward");

  const next = (event) => {
    event.preventEvent?.();
    event.preventDefault();
    if (step === 1 && !draft.name.trim()) {
      setError("Enter your name to continue.");
      return;
    }
    if (nameOnly) {
      setState((value) => ({
        ...value,
        profile: value.profile ? { ...value.profile, name: draft.name.trim() } : value.profile,
        profileDraft: null,
        profileStep: null,
      }));
      onComplete?.();
      return;
    }
    if (step === 4 && (!(+draft.age >= 10 && +draft.age <= 90) || !(+draft.height >= 120 && +draft.height <= 220))) {
      setError("Choose a valid age and height.");
      return;
    }
    if (step === 5 && (!(+draft.weight >= 25 && +draft.weight <= 250) || !(+draft.goalW >= 25 && +draft.goalW <= 250))) {
      setError("Choose a valid current and goal weight.");
      return;
    }
    setError("");
    if (step < 6) {
      const nextStep = step + 1;
      setDirection("forward");
      setStep(nextStep);
      setState((value) => ({ ...value, profileStep: nextStep, profileDraft: draft }));
      return;
    }
    const profile = {
      name: draft.name.trim(),
      age: +draft.age,
      weight: +draft.weight,
      goalW: +draft.goalW,
      goal: draft.goal,
      gender: draft.gender,
      frequency: +draft.frequency,
      objective: draft.objective,
      height: +draft.height,
      planStartedAt: state.profile?.planStartedAt || Date.now(),
    };
    setState((value) => ({
      ...value,
      profile,
      track: LEVELS[draft.plan],
      profileDraft: null,
      profileStep: null,
    }));
    onComplete?.();
  };

  const titles = ["What should we call you?", "Training rhythm", "Your focus", "Basic details", "Your weight", "Exercise level"];
  const ruler = (label, key, min, max, unit, step = 1) => (
    <label className="ruler-field">
      <span>{label}</span>
      <b><span className="ruler-value" key={draft[key]}>{draft[key]}</span> <small>{unit}</small></b>
      <div className="ruler-control" style={{ "--ruler-offset": `${-(((+draft[key] - min) / step) * 10 + 5)}px` }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={draft[key]}
          onChange={(event) => setDraft((value) => ({ ...value, [key]: event.target.value }))}
        />
        <div className="ruler-ticks" aria-hidden="true">
          <div className="ruler-ticks-static">{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((tick) => <i key={tick} />)}</div>
          <div className="ruler-tick-track">
            {Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, index) => {
              const mark = min + index * step;
              const major = mark % 10 === 0;
              return <i className={major ? "ruler-tick major" : "ruler-tick"} data-value={major ? mark : undefined} key={mark} />;
            })}
          </div>
          <i className="ruler-marker" />
        </div>
      </div>
    </label>
  );

  return (
    <main className="setup-shell">
      <section className={`setup-card setup-step-${step}`}>
        <div className="setup-topbar">
          {step > 1 ? <button type="button" className="setup-back" onClick={() => {
            setDirection("back");
            setStep((value) => value - 1);
          }}>Back</button> : <span />}
          <div className="brand">HTF</div>
          <span className="setup-count">{nameOnly ? "Profile" : `${step}/6`}</span>
        </div>
        {!nameOnly && <div className="progress-dots" role="progressbar" aria-label={`Setup progress, step ${step} of 6`} aria-valuemin={1} aria-valuemax={6} aria-valuenow={step}>{[1, 2, 3, 4, 5, 6].map((item) => <i key={item} className={item <= step ? "on" : ""} />)}</div>}
        <form onSubmit={next} className={`setup-form slide-${direction}${nameOnly ? " setup-name-only" : ""}`} key={step}>
          <div className="setup-heading">
            <span>Personalize your plan</span>
            <h1>{titles[step - 1]}</h1>
          </div>
          {step === 1 && <label className="setup-name-field">
            <span>Your name</span>
            <input
              type="text"
              name="name"
              autoComplete="given-name"
              maxLength={40}
              placeholder="e.g. Raj"
              value={draft.name}
              onChange={(event) => { setError(""); setDraft((item) => ({ ...item, name: event.target.value })); }}
            />
            <small>We'll use this name in your Train greeting.</small>
          </label>}
          {step === 1 && !nameOnly && <section className="gender-selection" aria-labelledby="gender-heading">
            <h2 id="gender-heading">Gender</h2>
            <div className="gender-grid">
              {[["male", "Male", "/man_model.webp"], ["female", "Female", "/female_model.webp"]].map(([value, label, image]) =>
                <button type="button" key={value} className={draft.gender === value ? "gender-card on" : "gender-card"} onClick={() => setDraft((item) => ({ ...item, gender: value }))}>
                  <span className={`gender-figure ${value}`} aria-hidden="true"><img src={image} alt="" /></span>
                  <strong>{label}</strong>
                </button>)}
            </div>
          </section>}
          {step === 2 && <div className="choice-grid">
            {[["3", "3 sessions a week"], ["4", "4 sessions a week"], ["5", "5 sessions a week"], ["6", "6 sessions a week"]].map(([value, label]) =>
              <button type="button" key={value} className={draft.frequency === value ? "choice on" : "choice"} onClick={() => setDraft((item) => ({ ...item, frequency: value }))}><b>{label}</b></button>)}
          </div>}
          {step === 3 && <div className="focus-grid">
            {[["muscle", "Build muscle", "Strength and size"], ["fat-loss", "Burn fat", "Lean and athletic"], ["strength", "Get stronger", "Power and performance"], ["fitness", "Improve fitness", "Move and feel better"]].map(([value, title, copy]) =>
              <button type="button" key={value} className={draft.objective === value ? "choice focus-choice on" : "choice focus-choice"} onClick={() => setDraft((item) => ({ ...item, objective: value }))}><b>{title}</b><small>{copy}</small></button>)}
          </div>}
          {step === 4 && <div className="ruler-stack">
            {ruler("Age", "age", 10, 90, "years")}
            {ruler("Height", "height", 120, 220, "cm")}
          </div>}
          {step === 5 && <div className="ruler-stack">
            {ruler("Current weight", "weight", 25, 250, "kg")}
            {ruler("Goal weight", "goalW", 25, 250, "kg")}
          </div>}
          {step === 6 && <div className="choice-grid">
            {LEVELS.map((level, index) => <button type="button" key={level} className={draft.plan === index ? "choice on" : "choice"} onClick={() => setDraft((item) => ({ ...item, plan: index }))}>
              <b>{LEVEL_NAMES[level]}</b><small>{["Table and chair versions", "Floor work", "Advanced variations", "Hardest variations"][index]}</small>
            </button>)}
          </div>}
          {error && <p className="error">{error}</p>}
          <div className={`row gap setup-actions${step === 1 && state.profile && !nameOnly ? " setup-actions-with-cancel" : ""}`}>
            {step === 1 && state.profile && !nameOnly ? <button type="button" className="secondary" onClick={onCancel}>Cancel</button> : null}
            <button className="primary setup-next" type="submit">{nameOnly ? "Save name" : step === 6 ? "Create my plan" : "Continue"}<span aria-hidden="true">→</span></button>
          </div>
        </form>
      </section>
    </main>
  );
}

function Nav({ tab, setTab, onOpenProfile, profileOpen }) {
  const items = [
    ["today", "dumbbell", "Train"],
    ["plan", "checks", "Plan"],
    ["progress", "trend", "Progress"],
    ["profile", "user", "Profile"],
  ];

  return <nav className="bottom-nav" aria-label="Primary navigation">
    {items.map(([value, icon, label]) => {
      const active = value === "profile" ? profileOpen : tab === value;
      return (
        <button
          key={value}
          type="button"
          className={`${active ? "on" : ""}${value === "profile" ? " mobile-nav-profile" : ""}`}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          onClick={() => value === "profile" ? onOpenProfile() : setTab(value)}
        >
          <Icon name={icon} />
          <span>{label}</span>
        </button>
      );
    })}
  </nav>;
}

function startOfWeek(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return value;
}

function dateKey(date) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function matchesBodyPart(part, muscle) {
  const value = muscle.toLowerCase();
  return part.keywords.some((keyword) => value.includes(keyword));
}

function exercisesForBodyPart(part) {
  return EXERCISES.map((exercise, index) => ({ exercise, index }))
    .filter(({ exercise }) => exercise.muscles.some((muscle) => matchesBodyPart(part, muscle)));
}

function getWeekNumber(startedAt) {
  const start = startOfWeek(startedAt);
  const current = startOfWeek(new Date());
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const currentUtc = Date.UTC(current.getFullYear(), current.getMonth(), current.getDate());
  return Math.max(1, Math.floor((currentUtc - startUtc) / 604800000) + 1);
}

function getSuggestedDay(index, target) {
  const daySets = {
    3: [0, 2, 4],
    4: [0, 2, 4, 6],
    5: [0, 1, 3, 5, 6],
    6: [0, 1, 2, 4, 5, 6],
  };
  return (daySets[target] || daySets[3])[index] ?? 6;
}

function WeekOverview({ log, target, weekNumber }) {
  const firstDay = startOfWeek(new Date());
  const weekEntries = log.filter((entry) => new Date(entry.d) >= firstDay);
  const completedDays = new Set(weekEntries.map((entry) => dateKey(entry.d)));
  const todayKey = dateKey(new Date());
  return (
    <section className="week-overview" aria-label="This week's training schedule">
      <div className="week-overview-head">
        <div><h2>Week {weekNumber}</h2><span>This week</span></div>
        <b>{weekEntries.length}/{target} sessions</b>
      </div>
      <div className="week-days">
        {Array.from({ length: 7 }, (_, index) => {
          const date = new Date(firstDay);
          date.setDate(firstDay.getDate() + index);
          const key = dateKey(date);
          const complete = completedDays.has(key);
          return (
            <div className={`week-day ${complete ? "complete" : ""} ${key === todayKey ? "today" : ""}`} key={key}>
              <span>{date.toLocaleDateString(undefined, { weekday: "narrow" })}</span>
              <b>{date.getDate()}</b>
              <i aria-hidden="true">{complete ? <Icon name="check" size={12} /> : null}</i>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProgressCharts({ log }) {
  const currentMonday = startOfWeek(new Date());
  const weeks = Array.from({ length: 6 }, (_, index) => {
    const start = new Date(currentMonday);
    start.setDate(start.getDate() - (5 - index) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return {
      start,
      count: log.filter((entry) => new Date(entry.d) >= start && new Date(entry.d) < end).length,
    };
  });
  const max = Math.max(3, ...weeks.map((week) => week.count));
  const points = weeks.map((week, index) => `${24 + index * 52},${104 - (week.count / max) * 78}`).join(" ");
  const muscles = new Map();
  log.forEach((entry) => (entry.muscles || []).forEach((muscle) => muscles.set(muscle, (muscles.get(muscle) || 0) + 1)));
  const focus = [...muscles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxFocus = Math.max(1, ...focus.map(([, count]) => count));

  return (
    <>
      <section className="progress-chart">
        <div className="progress-chart-head"><h2>Workout consistency</h2><span>Sessions per week</span></div>
        <svg viewBox="0 0 300 128" role="img" aria-label="Completed workouts per week for the last six weeks">
          {[0, 1, 2].map((line) => <line key={line} x1="20" x2="280" y1={25 + line * 38} y2={25 + line * 38} />)}
          <polyline points={points} />
          {weeks.map((week, index) => {
            const x = 24 + index * 52;
            const y = 104 - (week.count / max) * 78;
            return <g key={week.start.toISOString()}><circle cx={x} cy={y} r="4" /><text x={x} y="123">{week.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text><title>{week.count} sessions</title></g>;
          })}
        </svg>
        <div className="chart-caption">{log.length ? `${log.length} completed workout${log.length === 1 ? "" : "s"} recorded` : "Complete a workout to start your trend."}</div>
      </section>
      <section className="muscle-progress">
        <div className="progress-chart-head"><h2>Training focus</h2><span>By completed exercises</span></div>
        {focus.length ? focus.map(([muscle, count]) => (
          <div className="focus-progress" key={muscle}>
            <div><span>{muscle}</span><b>{count} session{count === 1 ? "" : "s"}</b></div>
            <i><span style={{ width: `${(count / maxFocus) * 100}%` }} /></i>
          </div>
        )) : <p className="muted">Muscle groups will appear here after you complete and log exercise sets.</p>}
        <p className="chart-note">Training focus reflects logged exercises; it is not a measurement of muscle growth.</p>
      </section>
    </>
  );
}

function getGreeting(name) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = name?.trim().split(/\s+/)[0];
  return firstName ? `${greeting}, ${firstName}` : greeting;
}

function MobileTrainDashboard({ state, log, target, weekNumber, activeSession, onOpenProfile, onOpenSession, onOpenBodyPart, onManagePlan }) {
  const firstDay = startOfWeek(new Date());
  const todayIndex = (new Date().getDay() + 6) % 7;
  const [selectedDay, setSelectedDay] = useState(() => state.start ? getSuggestedDay(activeSession, target) : todayIndex);
  const weekEntries = log.filter((entry) => new Date(entry.d) >= firstDay);
  const scheduledSession = Array.from({ length: target }, (_, index) => index)
    .find((index) => getSuggestedDay(index, target) === selectedDay);
  const selectedDate = new Date(firstDay);
  selectedDate.setDate(firstDay.getDate() + selectedDay);
  const selectedSessionLog = weekEntries.find((entry) => dateKey(entry.d) === dateKey(selectedDate))
    || (scheduledSession === undefined ? null : weekEntries.find((entry) => entry.session === scheduledSession));
  const weeklySets = weekEntries.reduce((total, entry) => total + (entry.sets || 0), 0);
  const mix = BODY_PARTS.map((part) => ({
    ...part,
    count: weekEntries.filter((entry) => (entry.muscles || []).some((muscle) => matchesBodyPart(part, muscle))).length,
  }));
  const mixTotal = mix.reduce((total, part) => total + part.count, 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() + index);
    const key = dateKey(date);
    return {
      date,
      key,
      index,
      completed: weekEntries.some((entry) => dateKey(entry.d) === key),
      planned: Array.from({ length: target }, (_, session) => session).some((session) => getSuggestedDay(session, target) === index),
    };
  });
  const profileInitials = state.profile?.name?.trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <main className="app-shell mobile-dashboard">
      <header className="mobile-home-header">
        <div><span className="mobile-greeting">{getGreeting(state.profile?.name)}</span><h1>Train</h1></div>
        <button type="button" className="mobile-profile-trigger" aria-label={`Open ${state.profile?.name ? `${state.profile.name}'s profile` : "profile"}`} onClick={onOpenProfile}>
          <span aria-hidden="true">{profileInitials || <Icon name="user" size={22} />}</span>
        </button>
      </header>

      <section className="mobile-week-card" aria-label="Weekly training summary">
        <div className="mobile-week-stats">
          <div><span>This week</span><strong>{weekEntries.length}<small> / {target} sessions</small></strong></div>
          <div><span>Sets</span><strong>{weeklySets}</strong></div>
        </div>
        <div className="mobile-week-days" aria-label="Select a training day">
          {days.map(({ date, key, index, completed, planned }) => (
            <button type="button" key={key} className={`mobile-week-day ${selectedDay === index ? "selected" : ""} ${completed ? "completed" : ""} ${planned ? "planned" : ""}`}
              aria-pressed={selectedDay === index}
              aria-label={`${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${planned ? ", scheduled session" : ""}${completed ? ", workout complete" : ""}`}
              onClick={() => setSelectedDay(index)}>
              <span>{date.toLocaleDateString(undefined, { weekday: "narrow" })}</span>
              <b>{date.getDate()}</b>
              <i aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="mobile-muscle-mix">
          <div className="mobile-section-heading"><h2>Muscle mix</h2><span>{mixTotal ? "This week" : "No sessions yet"}</span></div>
          <div className="mobile-muscle-progress-list">
            {mix.map((part) => {
              const percentage = mixTotal ? Math.round((part.count / mixTotal) * 100) : 0;
              return (
                <div className="mobile-muscle-progress-row" key={part.name}>
                  <div className="mobile-muscle-progress-label">
                    <strong><i aria-hidden="true" data-tone={part.name.toLowerCase()} />{part.name}</strong>
                    <span>{part.count} {part.count === 1 ? "session" : "sessions"}</span>
                    <b>{percentage}%</b>
                  </div>
                  <div
                    className="mobile-muscle-track"
                    role="progressbar"
                    aria-label={`${part.name} share of this week's muscle mix`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percentage}
                    aria-valuetext={`${part.count} ${part.count === 1 ? "session" : "sessions"}, ${percentage}%`}
                  >
                    <i data-tone={part.name.toLowerCase()} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {!mixTotal && <p className="mobile-empty-mix">Complete a workout this week to build your muscle mix.</p>}
        </div>
      </section>

      <section className="mobile-week-plan">
        <div className="mobile-section-heading">
          <h2>Weekly plan</h2>
          <button type="button" className="mobile-manage-button" onClick={onManagePlan}>Manage <Icon name="right" size={16} /></button>
        </div>
        {scheduledSession === undefined ? (
          <div className="mobile-rest-day"><span>{selectedDate.toLocaleDateString(undefined, { weekday: "long" })}</span><strong>Rest day</strong><p>Choose a scheduled day to see its exercises.</p></div>
        ) : selectedSessionLog ? (
          <div className="mobile-session-preview completed">
            <span>Session {(selectedSessionLog.session ?? scheduledSession ?? 0) + 1} · {selectedDate.toLocaleDateString(undefined, { weekday: "long" })}</span>
            <strong>Workout complete</strong>
          </div>
        ) : (
          <button type="button" className="mobile-session-preview" onClick={() => onOpenSession(scheduledSession)}>
            <span>Session {scheduledSession + 1} · {selectedDate.toLocaleDateString(undefined, { weekday: "long" })}</span>
            <strong>{state.start && activeSession === scheduledSession ? "Continue workout" : "Choose exercises"} <Icon name="right" size={18} /></strong>
          </button>
        )}
      </section>

      <section className="mobile-body-parts">
        <div className="mobile-section-heading"><h2>Body parts</h2></div>
        <div className="mobile-body-part-list">
          {BODY_PARTS.map((part) => {
            const exercises = exercisesForBodyPart(part);
            const sessions = log.filter((entry) => (entry.muscles || []).some((muscle) => matchesBodyPart(part, muscle))).length;
            return (
              <button type="button" className="mobile-body-part" key={part.name} onClick={() => onOpenBodyPart(part)}>
                  <span><strong><i aria-hidden="true" data-tone={part.name.toLowerCase()} />{part.name}</strong><small>{sessions} {sessions === 1 ? "session" : "sessions"} · {exercises.length} exercises</small></span>
                <Icon name="right" size={18} />
              </button>
            );
          })}
        </div>
      </section>
      <span className="mobile-week-label" aria-hidden="true">Week {weekNumber}</span>
    </main>
  );
}

function MobileSessionExercises({ title, subtitle, exercises, onBack, onOpenExercise, onFinish }) {
  const tone = BODY_PARTS.find((part) => part.name === title)?.name.toLowerCase();

  return (
    <main className="mobile-flow-shell">
      <header className="mobile-flow-header">
        <button type="button" className="mobile-back-button" aria-label="Back to Train" onClick={onBack}><Icon name="left" size={22} /></button>
        <div><span>{subtitle}</span><h1>{title}</h1></div>
      </header>
      <p className="mobile-flow-copy">Choose an exercise to open its timer.</p>
      <div className="mobile-exercise-list" aria-label={`${title} exercises`}>
        {exercises.map(({ exercise, index }) => (
          <button type="button" className="mobile-exercise-item" key={exercise.id} onClick={() => onOpenExercise(index)}>
            <span><strong>{tone && <i aria-hidden="true" data-tone={tone} />}{exercise.name}</strong><small>{exercise.variation} · {exercise.target}</small></span>
            <Icon name="right" size={18} />
          </button>
        ))}
      </div>
      <div className="mobile-flow-footer"><button type="button" className="primary full" onClick={onFinish}>Finish workout</button></div>
    </main>
  );
}

function formatElapsedTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function MobileExercisePlayer({ exercise, exerciseIndex, sessionNumber, theme, running, elapsed, setIndex, sets, onBack, onToggleTimer, onResetTimer, onCompleteSet, onTimeline }) {
  const completedSets = [0, 1, 2].filter((index) => sets[`${exerciseIndex}-${index}`]);
  const isComplete = completedSets.length === 3;

  return (
    <main className="mobile-player-shell">
      <header className="mobile-flow-header">
        <button type="button" className="mobile-back-button" aria-label="Back to exercises" onClick={onBack}><Icon name="left" size={22} /></button>
        <div><span>Session {sessionNumber} · Set {isComplete ? 3 : setIndex + 1} of 3</span><h1>{exercise.name}</h1></div>
      </header>
      <div className="mobile-player-stage">
        <div className="stage">
          <Suspense fallback={<div className="stage-loading">Loading exercise...</div>}>
            <ExerciseScene exercise={exercise.name} theme={theme} playing={running} slow={false} speed={1} loop onTimeline={onTimeline} musclesVisible cameraView="front" />
          </Suspense>
        </div>
      </div>
      <section className="mobile-player-info">
        <div className="mobile-player-target"><span>{exercise.variation}</span><strong>Target · {exercise.target}</strong></div>
        <div className="mobile-timer" role="timer" aria-label={`Elapsed time ${formatElapsedTime(elapsed)}`} aria-live="off">{formatElapsedTime(elapsed)}</div>
        <p>{exercise.description}</p>
        <div className="mobile-set-progress" aria-label={`${completedSets.length} of 3 sets completed`}>
          {[0, 1, 2].map((index) => <i className={sets[`${exerciseIndex}-${index}`] ? "done" : ""} key={index} />)}
        </div>
        {isComplete ? (
          <div className="mobile-set-complete">
            <strong>All sets logged</strong>
            <button type="button" className="primary full" onClick={onBack}>Back to exercises</button>
          </div>
        ) : (
          <div className="mobile-player-actions">
            <button type="button" className="primary full" onClick={onToggleTimer}><Icon name={running ? "pause" : "play"} size={18} />{running ? "Pause timer" : "Start timer"}</button>
            <button type="button" className="secondary full" onClick={onResetTimer}>Reset timer</button>
            <button type="button" className="mobile-complete-set" onClick={onCompleteSet}>Complete set {setIndex + 1}</button>
          </div>
        )}
      </section>
    </main>
  );
}

function MobileProfileDialog({ open, profile, onClose, onEdit, onLogout }) {
  const dialogRef = useRef(null);
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const closeDialog = () => {
    setConfirmingLogout(false);
    onClose();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [open]);

  if (!open) return null;

  if (confirmingLogout) {
    return (
      <dialog className="mobile-profile-dialog" ref={dialogRef} aria-labelledby="logout-title"
        onCancel={(event) => { event.preventDefault(); closeDialog(); }}
        onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
        <div className="mobile-profile-card mobile-logout-confirm">
          <span className="mobile-dialog-mark"><Icon name="user" size={20} /></span>
          <h2 id="logout-title">Delete your data?</h2>
          <p>Logging out will permanently delete your profile, workouts, and progress stored on this device. This cannot be undone.</p>
          <button type="button" className="secondary full" onClick={() => setConfirmingLogout(false)}>Keep my data</button>
          <button type="button" className="mobile-danger-button full" onClick={() => { setConfirmingLogout(false); onLogout(); }}>Delete data &amp; log out</button>
        </div>
      </dialog>
    );
  }

  const details = [
    ["Name", profile?.name || "—"],
    ["Age", profile?.age ? `${profile.age} years` : "—"],
    ["Height", profile?.height ? `${profile.height} cm` : "—"],
    ["Weight", profile?.weight ? `${profile.weight} kg` : "—"],
    ["Goal weight", profile?.goalW ? `${profile.goalW} kg` : "—"],
    ["Training", profile?.frequency ? `${profile.frequency} days / week` : "—"],
  ];

  return (
    <dialog className="mobile-profile-dialog" ref={dialogRef} aria-labelledby="profile-title"
      onCancel={(event) => { event.preventDefault(); closeDialog(); }}
      onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
      <div className="mobile-profile-card">
        <div className="mobile-profile-heading">
          <span className="mobile-dialog-mark"><Icon name="user" size={20} /></span>
          <div><span>Your account</span><h2 id="profile-title">Profile</h2></div>
          <button type="button" className="mobile-dialog-close" aria-label="Close profile" onClick={closeDialog}><Icon name="close" size={18} /></button>
        </div>
        <dl className="mobile-profile-details">
          {details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        <button type="button" className="secondary full" onClick={onEdit}>Edit profile</button>
        <button type="button" className="mobile-logout-button full" onClick={() => setConfirmingLogout(true)}>Log out</button>
      </div>
    </dialog>
  );
}

export default function App() {
  const [state, setState] = useState(loadState);
  const [resolvedTheme, setResolvedTheme] = useState("dark");
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  const [setupOpen, setSetupOpen] = useState(() => Boolean(state.profile && !String(state.profile.name || "").trim()));
  const [tab, setTab] = useState("today");
  const [workout, setWorkout] = useState(null);
  const [activeSession, setActiveSession] = useState(0);
  const [mobileView, setMobileView] = useState("home");
  const [mobileSessionIndex, setMobileSessionIndex] = useState(0);
  const [mobileBodyPart, setMobileBodyPart] = useState(null);
  const [mobileExerciseIndex, setMobileExerciseIndex] = useState(null);
  const [mobileSetIndex, setMobileSetIndex] = useState(0);
  const [mobileTimerRunning, setMobileTimerRunning] = useState(false);
  const [mobileElapsedSeconds, setMobileElapsedSeconds] = useState(0);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const [warmupIndex, setWarmupIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [slow, setSlow] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  const [restartKey, setRestartKey] = useState(0);
  const [musclesVisible, setMusclesVisible] = useState(true);
  const [cameraView, setCameraView] = useState("front");
  const [timeline, setTimeline] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [resetCameraKey, setResetCameraKey] = useState(0);
  const [timelineSeek, setTimelineSeek] = useState(null);
  const [selectedMuscle, setSelectedMuscle] = useState(null);
  const [isolationMode, setIsolationMode] = useState(false);
  const [labelsVisible, setLabelsVisible] = useState(false);
  const [explodedView, setExplodedView] = useState(false);
  const [autoTrack, setAutoTrack] = useState(false);
  const stageRef = useRef(null);
  const pageRef = useRef(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const applyViewport = () => setIsMobile(media.matches);
    applyViewport();
    media.addEventListener("change", applyViewport);
    return () => media.removeEventListener("change", applyViewport);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const themeColor = document.querySelector('meta[name="theme-color"]');
    const applyTheme = () => {
      const theme = state.theme === "system" ? (media.matches ? "dark" : "light") : state.theme;
      setResolvedTheme(theme);
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
      themeColor?.setAttribute("content", theme === "light" ? "#ffffff" : "#000000");
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [state.theme]);

  useEffect(() => {
    if (!state.profile) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, _u: Date.now() }));
  }, [state]);

  useEffect(() => {
    if (!isMobile || mobileView !== "exercise" || !mobileTimerRunning) return undefined;
    const timer = window.setInterval(() => setMobileElapsedSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isMobile, mobileView, mobileTimerRunning]);

  useEffect(() => {
    if (pageRef.current) gsap.fromTo(pageRef.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" });
  }, [tab, workout]);

  useEffect(() => {
    setSelectedMuscle(null);
    setTimelineSeek(null);
  }, [workout]);

  const sessionTarget = Math.min(6, Math.max(3, Number(state.profile?.frequency) || 3));
  const planWeek = getWeekNumber(state.profile?.planStartedAt || state.log[0]?.d || Date.now());
  const weekStart = startOfWeek(new Date());
  const currentWeekLogs = state.log.filter((entry) => new Date(entry.d) >= weekStart);

  const startSession = (sessionIndex) => {
    setActiveSession(sessionIndex);
    setState((value) => ({ ...value, start: value.start || Date.now(), done: value.done || 0 }));
  };

  const openMobileSession = (sessionIndex) => {
    startSession(sessionIndex);
    setMobileSessionIndex(sessionIndex);
    setMobileBodyPart(null);
    setMobileTimerRunning(false);
    setMobileView("exercise-list");
  };

  const openMobileBodyPart = (part) => {
    startSession(activeSession);
    setMobileSessionIndex(activeSession);
    setMobileBodyPart(part);
    setMobileTimerRunning(false);
    setMobileView("exercise-list");
  };

  const openMobileExercise = (exerciseIndex) => {
    const nextSet = [0, 1, 2].find((index) => !state.sets[`${exerciseIndex}-${index}`]);
    setMobileExerciseIndex(exerciseIndex);
    setMobileSetIndex(nextSet ?? 3);
    setMobileElapsedSeconds(0);
    setMobileTimerRunning(false);
    setMobileView("exercise");
  };

  const toggleSet = (exerciseIndex, setIndex) => {
    const key = `${exerciseIndex}-${setIndex}`;
    setState((value) => {
      const sets = { ...value.sets };
      if (sets[key]) delete sets[key]; else sets[key] = 1;
      return { ...value, sets };
    });
  };

  const completeMobileSet = () => {
    if (mobileExerciseIndex === null || mobileSetIndex >= 3) return;
    toggleSet(mobileExerciseIndex, mobileSetIndex);
    setMobileTimerRunning(false);
    setMobileElapsedSeconds(0);
    setMobileSetIndex((value) => value + 1);
  };

  const finishSession = () => {
    if (!Object.keys(state.sets).length) {
      setState((value) => ({ ...value, start: null }));
      if (isMobile) {
        setMobileView("home");
        setMobileBodyPart(null);
        setMobileExerciseIndex(null);
        setMobileTimerRunning(false);
        setMobileElapsedSeconds(0);
      }
      return;
    }

    setState((value) => {
      const completedSets = Object.keys(value.sets).length;
      const completedAt = Date.now();
      const exerciseIndexes = [...new Set(Object.keys(value.sets).map((key) => Number(key.split("-")[0])))];
      const muscles = [...new Set(exerciseIndexes.flatMap((index) => EXERCISES[index]?.muscles || []))];
      const entry = {
        d: completedAt,
        w: getWeekNumber(value.profile?.planStartedAt || value.log[0]?.d || completedAt),
        session: activeSession,
        dur: value.start ? completedAt - value.start : 0,
        sets: completedSets,
        reps: completedSets * 8,
        exercises: exerciseIndexes,
        muscles,
      };
      return { ...value, log: [...value.log, entry], hist: [...value.hist, { d: completedAt, n: completedSets, ra: 1, rir: 2, ex: exerciseIndexes }], start: null, sets: {}, sd: {}, done: Math.min(sessionTarget, value.done + 1) };
    });
    setWorkout(null);
    setMobileTimerRunning(false);
    setMobileElapsedSeconds(0);
    setMobileBodyPart(null);
    setMobileExerciseIndex(null);
    setMobileView("home");
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(defaultState);
    setSetupOpen(false);
    setTab("today");
    setWorkout(null);
    setActiveSession(0);
    setMobileView("home");
    setMobileBodyPart(null);
    setMobileExerciseIndex(null);
    setMobileTimerRunning(false);
    setMobileElapsedSeconds(0);
    setMobileProfileOpen(false);
  };
  const openProfileFromNav = () => {
    setTab("today");
    setMobileProfileOpen(true);
  };

  if (!state.profile) return <ProfileSetup state={state} setState={setState} onCancel={() => setTab("today")} onComplete={() => setSetupOpen(false)} />;
  if (setupOpen) return <ProfileSetup
    state={state}
    setState={setState}
    nameOnly={Boolean(state.profile && !String(state.profile.name || "").trim())}
    onCancel={() => setSetupOpen(false)}
    onComplete={() => setSetupOpen(false)}
  />;

  if (isMobile && tab === "today" && mobileView === "exercise-list") {
    const exercises = mobileBodyPart
      ? exercisesForBodyPart(mobileBodyPart)
      : EXERCISES.map((exercise, index) => ({ exercise, index }));
    return <MobileSessionExercises
      title={mobileBodyPart ? mobileBodyPart.name : `Session ${mobileSessionIndex + 1}`}
      subtitle={mobileBodyPart ? "Body part exercises" : `Week ${planWeek} · ${LEVEL_NAMES[state.track]} plan`}
      exercises={exercises}
      onBack={() => { setMobileTimerRunning(false); setMobileView("home"); setMobileBodyPart(null); }}
      onOpenExercise={openMobileExercise}
      onFinish={finishSession}
    />;
  }

  if (isMobile && tab === "today" && mobileView === "exercise" && mobileExerciseIndex !== null) {
    return <MobileExercisePlayer
      exercise={EXERCISES[mobileExerciseIndex]}
      exerciseIndex={mobileExerciseIndex}
      sessionNumber={mobileSessionIndex + 1}
      theme={resolvedTheme}
      running={mobileTimerRunning}
      elapsed={mobileElapsedSeconds}
      setIndex={mobileSetIndex}
      sets={state.sets}
      onBack={() => { setMobileTimerRunning(false); setMobileElapsedSeconds(0); setMobileView("exercise-list"); }}
      onToggleTimer={() => setMobileTimerRunning((value) => !value)}
      onResetTimer={() => { setMobileTimerRunning(false); setMobileElapsedSeconds(0); }}
      onCompleteSet={completeMobileSet}
      onTimeline={setTimeline}
    />;
  }

  if (isMobile && tab === "today") {
    return <>
      <MobileTrainDashboard
        state={state}
        log={state.log}
        target={sessionTarget}
        weekNumber={planWeek}
        activeSession={activeSession}
        onOpenProfile={() => setMobileProfileOpen(true)}
        onOpenSession={openMobileSession}
        onOpenBodyPart={openMobileBodyPart}
        onManagePlan={() => setTab("plan")}
      />
      <Nav tab={tab} setTab={setTab} onOpenProfile={openProfileFromNav} profileOpen={mobileProfileOpen} />
      <MobileProfileDialog
        open={mobileProfileOpen}
        profile={state.profile}
        onClose={() => setMobileProfileOpen(false)}
        onEdit={() => { setMobileProfileOpen(false); setSetupOpen(true); }}
        onLogout={logout}
      />
    </>;
  }

  if (workout !== null) {
    const exercise = workout === -1 ? null : EXERCISES[workout];
    return (
      <main className="workout-shell" ref={pageRef}>
        <header className="workout-header">
          <button className="icon-button" aria-label="Back" onClick={() => setWorkout(null)}><Icon name="left" size={24} /></button>
          <b>Session in progress</b>
          <button className="text-button" onClick={finishSession}>Finish</button>
        </header>
        <div className="workout-tabs">
          <button className={workout === -1 ? "on" : ""} onClick={() => setWorkout(-1)}>Warm-up</button>
          {EXERCISES.map((item, index) => <button key={item.name} className={workout === index ? "on" : ""} onClick={() => setWorkout(index)}>{item.name.split(" ")[0]}</button>)}
        </div>
        <div className="workout-layout">
          <section className="demo-panel">
            <h2>{workout === -1 ? "Warm-up" : `${exercise.name} · demo`}</h2>
            <div className="stage" ref={stageRef}>
              <Suspense fallback={<div className="stage-loading">Loading 3D scene...</div>}>
                {workout === -1 ? <ExerciseScene exercise="Push-ups" theme={resolvedTheme} playing={playing} slow={slow} speed={speed} loop={loop} restartKey={restartKey} musclesVisible={musclesVisible} cameraView={cameraView} onTimeline={setTimeline} autoRotate={autoRotate} resetCameraKey={resetCameraKey} timelineSeek={timelineSeek} selectedMuscle={selectedMuscle ? selectedMuscle.key : null} isolationMode={isolationMode} explodedView={explodedView} autoTrack={autoTrack} /> : <ExerciseScene exercise={exercise.name} theme={resolvedTheme} playing={playing} slow={slow} speed={speed} loop={loop} restartKey={restartKey} musclesVisible={musclesVisible} cameraView={cameraView} onTimeline={setTimeline} autoRotate={autoRotate} resetCameraKey={resetCameraKey} timelineSeek={timelineSeek} selectedMuscle={selectedMuscle ? selectedMuscle.key : null} isolationMode={isolationMode} explodedView={explodedView} autoTrack={autoTrack} />}
              </Suspense>
              {workout !== -1 && (
                <div className="stage-muscle-key" aria-label="Muscles working">
                  {exercise.muscles.map((muscle) => <span key={muscle}>{muscle}</span>)}
                </div>
              )}
            </div>
            <div className="demo-toolbar" aria-label="3D playback toolbar">
              <button className="primary demo-action" onClick={() => setPlaying((value) => !value)}><Icon name={playing ? "pause" : "play"} size={18} />{playing ? "Pause" : "Play"}</button>
              <button className="toolbar-button" onClick={() => setRestartKey((value) => value + 1)}>Restart</button>
              <button className={slow ? "toolbar-button active" : "toolbar-button"} onClick={() => setSlow((value) => !value)}><Icon name="slow" size={16} />Slow</button>
              <label className="toolbar-select">Speed
                <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => <option key={value} value={value}>{value}x</option>)}
                </select>
              </label>
              <button className={loop ? "toolbar-button active" : "toolbar-button"} onClick={() => setLoop((value) => !value)}>Loop</button>
              <button className="toolbar-button" onClick={() => setMusclesVisible((value) => !value)}>{musclesVisible ? "Hide muscles" : "Show muscles"}</button>
              <button className="toolbar-button" onClick={async () => {
                if (!document.fullscreenElement) await stageRef.current?.requestFullscreen?.();
                else await document.exitFullscreen?.();
              }}>Full screen</button>
            </div>
            {workout !== -1 && (
              <div className="camera-toolbar" aria-label="Camera view toolbar">
                <span>Camera</span>
                {["orbit", "front", "back", "left", "right", "full"].map((view) => (
                  <button key={view} className={view === "orbit" ? (autoRotate ? "camera-button active" : "camera-button") : view === "full" ? "camera-button" : (cameraView === view ? "camera-button active" : "camera-button")} onClick={() => {
                    if (view === "orbit") setAutoRotate((value) => !value);
                    else if (view === "full") {
                      setCameraView("front");
                      setSelectedMuscle(null);
                      setResetCameraKey((value) => value + 1);
                    } else setCameraView(view);
                  }}>{view === "orbit" ? "360°" : view === "full" ? "Full body" : `${view[0].toUpperCase()}${view.slice(1)}`}</button>
                ))}
                <button className="camera-button" onClick={() => setResetCameraKey((value) => value + 1)}>Reset</button>
              </div>
            )}
            {workout !== -1 && (
              <>
                <div className="exercise-phase-row">
                  <span>Movement phase</span>
                  <b>{timeline < 0.12 ? "Starting" : timeline < 0.38 ? "Eccentric" : timeline < 0.62 ? "Bottom" : timeline < 0.88 ? "Concentric" : "End"}</b>
                </div>
                <input
                  className="exercise-timeline"
                  aria-label="Animation timeline"
                  type="range"
                  min="0"
                  max="1"
                  step="0.001"
                  value={timeline}
                  onChange={(event) => {
                    setPlaying(false);
                    setTimelineSeek(Number(event.target.value));
                    setTimeline(Number(event.target.value));
                  }}
                />
              </>
            )}
          </section>
          <section className="sets-panel">
            {workout === -1 ? <>
              <div className="row"><div><span className="muted">Step {warmupIndex + 1} of 4</span><h2>{WARMUPS[warmupIndex]}</h2></div></div>
              <div className="warmup-list">{WARMUPS.map((item, index) => <button key={item} className={warmupIndex === index ? "on" : ""} onClick={() => setWarmupIndex(index)}>{index + 1}</button>)}</div>
            </> : <>
              <div className="row"><div><h2>{exercise.name}</h2><span className="muted">{exercise.variation}</span></div><span className="chip">Rest 1:30</span></div>
              <div className="muscle-panel">
                <div className="muscle-panel-head">
                  <span>Muscles working</span>
                  <b>{exercise.muscles.length} groups</b>
                </div>
                {exercise.primary?.length > 0 && (
                  <div className="activation-panel">
                    {[...exercise.primary, ...exercise.secondary, ...exercise.stabilizers].map((muscle) => {
                      const basePulse = exercise.id === "push-ups"
                        ? 0.82 + Math.sin(timeline * Math.PI * 4) * 0.12
                        : 0.86 + Math.sin(timeline * Math.PI * 3) * 0.1;
                      const phaseFactor = timeline >= 0.25 && timeline <= 0.75 ? 1 : 0.82;
                      const value = Math.round(muscle.activation * basePulse * phaseFactor);
                      const key = muscle.name.toLowerCase().includes("chest") || muscle.name.toLowerCase().includes("pect")
                        ? "chest"
                        : muscle.name.toLowerCase().includes("triceps") || muscle.name.toLowerCase().includes("arm")
                          ? "triceps"
                          : muscle.name.toLowerCase().includes("deltoid") || muscle.name.toLowerCase().includes("shoulder")
                            ? "shoulders"
                            : muscle.name.toLowerCase().includes("abdom") || muscle.name.toLowerCase().includes("core")
                              ? "core"
                              : muscle.name.toLowerCase().includes("back") || muscle.name.toLowerCase().includes("erector")
                                ? "back"
                                : "legs";
                      const roleLabel = muscle.category === "primary" ? "Primary" : muscle.category === "secondary" ? "Secondary" : "Stabilizing";
                      return (
                        <button type="button" className={`activation-row ${muscle.category} ${selectedMuscle?.name === muscle.name ? "selected" : ""}`} key={muscle.name} onClick={() => {
                          setSelectedMuscle({ name: muscle.name, key, role: roleLabel, activation: value });
                          setIsolationMode(true);
                          setCameraView("front");
                        }}>
                          <div><span>{muscle.name}</span><b>{value}%</b></div>
                          <div className="activation-track"><i style={{ width: `${value}%` }} /></div>
                          {labelsVisible && <small>{roleLabel} muscle · {value}%</small>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedMuscle && (
                  <div className="muscle-inspector">
                    <div>
                      <span>Selected muscle</span>
                      <h3>{selectedMuscle.name}</h3>
                    </div>
                    <div className="muscle-inspector-meta">
                      <b>{selectedMuscle.role}</b>
                      <span>{selectedMuscle.activation}% illustrative</span>
                    </div>
                    <button type="button" className="toolbar-button" onClick={() => {
                      setSelectedMuscle(null);
                      setIsolationMode(false);
                      setCameraView("front");
                      setResetCameraKey((value) => value + 1);
                    }}>Full body</button>
                  </div>
                )}
                <div className="anatomy-options">
                  <button type="button" className={isolationMode ? "toolbar-button active" : "toolbar-button"} onClick={() => setIsolationMode((value) => !value)}>Muscle isolation</button>
                  <button type="button" className={labelsVisible ? "toolbar-button active" : "toolbar-button"} onClick={() => setLabelsVisible((value) => !value)}>Labels</button>
                  <button type="button" className={explodedView ? "toolbar-button active" : "toolbar-button"} onClick={() => setExplodedView((value) => !value)}>Exploded view</button>
                  <button type="button" className={autoTrack ? "toolbar-button active" : "toolbar-button"} onClick={() => setAutoTrack((value) => !value)}>Auto-track</button>
                </div>
                <div className="muscle-list">
                  {exercise.muscles.map((muscle, index) => (
                    <span className={`muscle-item muscle-${index % 3}`} key={muscle}>
                      <i aria-hidden="true" />
                      {muscle}
                    </span>
                  ))}
                </div>
              </div>
              {exercise.technique?.length > 0 && (
                <div className="technique-panel">
                  <span>Technique</span>
                  <ul>
                    {exercise.technique.map((step) => <li key={step}>{step}</li>)}
                  </ul>
                </div>
              )}
              <div className="set-table">
                {[0, 1, 2].map((setIndex) => {
                  const key = `${workout}-${setIndex}`;
                  return <div className={state.sets[key] ? "set-row done" : "set-row"} key={key}>
                    <b>{setIndex + 1}</b>
                    <input type="number" defaultValue={exercise.target.match(/\d+/)?.[0] || 20} aria-label={`Set ${setIndex + 1}`} />
                    <button className="tick" aria-label={`Complete set ${setIndex + 1}`} onClick={() => toggleSet(workout, setIndex)}>{state.sets[key] ? <Icon name="check" size={16} /> : null}</button>
                  </div>;
                })}
              </div>
            </>}
          </section>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="app-shell" ref={pageRef}>
        {tab === "today" && <>
          <header className="page-head"><div><span className="muted">{LEVEL_NAMES[state.track]} plan</span><h1>Week {planWeek}</h1></div><span className="week-target">{sessionTarget} workouts / week</span></header>
          <WeekOverview log={state.log} target={sessionTarget} weekNumber={planWeek} />
          {Array.from({ length: sessionTarget }, (_, session) => {
            const completedEntry = currentWeekLogs.find((entry) => entry.session === session);
            const isDone = !!completedEntry;
            const day = getSuggestedDay(session, sessionTarget);
            const plannedDate = new Date(weekStart);
            plannedDate.setDate(weekStart.getDate() + day);
            const sessionDayLabel = completedEntry
              ? new Date(completedEntry.d).toLocaleDateString(undefined, { weekday: "long" })
              : plannedDate.toLocaleDateString(undefined, { weekday: "long" });
            return (
              <article className={`session-card ${isDone ? "completed" : ""} ${activeSession === session && state.start ? "current" : ""}`} key={session}>
                <div className="row">
                  <div><h2>Session {session + 1} · Full body</h2><span className="muted">{sessionDayLabel}</span></div>
                  {isDone ? <span className="chip session-complete"><Icon name="check" size={14} />Done</span> : activeSession === session && state.start ? <span className="chip">In progress</span> : null}
                </div>
                <div className="session-stats"><span>Focus <b>Full body</b></span><span>Sets logged <b>{completedEntry?.sets || "—"}</b></span></div>
                {!isDone && <button className="primary full" onClick={() => { startSession(session); setWorkout(-1); }}>{activeSession === session && state.start ? "Continue session" : "Start session"}</button>}
              </article>
            );
          })}
        </>}
        {tab === "plan" && <>
          <h1>Plan</h1>
          <section className="card"><div className="row"><h2>Your training profile</h2><button className="secondary" onClick={() => setSetupOpen(true)}>Edit</button></div>
            <div className="kpi-grid"><div><span>Age</span><b>{state.profile.age}</b></div><div><span>Weight</span><b>{state.profile.weight} kg</b></div><div><span>Goal</span><b>{state.profile.goalW} kg</b></div></div>
          </section>
          <section className="card appearance-settings">
            <div className="row"><h2>Appearance</h2></div>
            <div className="theme-options" aria-label="Appearance">
              {[["system", "System"], ["light", "Light"], ["dark", "Dark"]].map(([value, label]) =>
                <button type="button" key={value} className={state.theme === value ? "theme-option on" : "theme-option"} onClick={() => setState((item) => ({ ...item, theme: value }))}>
                  {label}
                </button>)}
            </div>
          </section>
          <section className="card"><h2>Exercises</h2>{EXERCISES.map((item) => <div className="exercise-row" key={item.name}><div><b>{item.name}</b><span>{item.variation}</span></div><strong>3 × {item.target}</strong></div>)}</section>
        </>}
        {tab === "progress" && <>
          <h1>Progress</h1>
          <section className="card"><div className="kpi-grid"><div><span>This week</span><b>{currentWeekLogs.length}/{sessionTarget}</b></div><div><span>Workouts</span><b>{state.log.length}</b></div><div><span>Sets logged</span><b>{state.log.reduce((total, entry) => total + (entry.sets || 0), 0)}</b></div></div></section>
          <ProgressCharts log={state.log} />
          <section className="card"><h2>Training history</h2>{state.log.length ? state.log.slice(-8).reverse().map((entry, index) => <div className="exercise-row" key={`${entry.d}-${index}`}><b>{new Date(entry.d).toLocaleDateString()}</b><span>{entry.reps} reps · {entry.sets || 0} sets</span></div>) : <p className="muted">No sessions completed yet.</p>}</section>
        </>}
      </main>
      <Nav tab={tab} setTab={setTab} onOpenProfile={openProfileFromNav} profileOpen={mobileProfileOpen} />
      <MobileProfileDialog
        open={mobileProfileOpen}
        profile={state.profile}
        onClose={() => setMobileProfileOpen(false)}
        onEdit={() => { setMobileProfileOpen(false); setSetupOpen(true); }}
        onLogout={logout}
      />
    </>
  );
}
