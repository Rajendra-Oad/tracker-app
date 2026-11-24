import { lazy, Suspense, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { EXERCISES, WARMUPS } from "./data/training";

const ExerciseScene = lazy(() => import("./components/ExerciseScene"));

const STORAGE_KEY = "bw-tracker-v1";
const LEVELS = ["A", "B", "C", "D"];
const LEVEL_NAMES = { A: "Beginner", B: "Intermediate", C: "Advanced", D: "Ultra" };
const defaultState = {
  profile: null,
  profileDraft: null,
  profileStep: 1,
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
    check: <path d="m5 12 4.5 4.5L19 7" />,
    slow: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || null}</svg>;
}

function ProfileSetup({ state, setState, onCancel, onComplete }) {
  const [step, setStep] = useState(state.profileStep || 1);
  const [draft, setDraft] = useState(state.profileDraft || {
    gender: state.profile?.gender || "male",
    frequency: String(state.profile?.frequency || 3),
    objective: state.profile?.objective || "muscle",
    age: String(state.profile?.age || 25),
    height: String(state.profile?.height || 175),
    weight: String(state.profile?.weight || 70),
    goalW: String(state.profile?.goalW || 75),
    goal: state.profile?.goal || "gain",
    plan: 0,
  });
  const [error, setError] = useState("");
  const [direction, setDirection] = useState("forward");

  const next = (event) => {
    event.preventEvent?.();
    event.preventDefault();
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

  const titles = ["Your body", "Training rhythm", "Your focus", "Basic details", "Your weight", "Exercise level"];
  const ruler = (label, key, min, max, unit, step = 1) => (
    <label className="ruler-field">
      <span>{label}</span>
      <b>{draft[key]} <small>{unit}</small></b>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft[key]}
        onChange={(event) => setDraft((value) => ({ ...value, [key]: event.target.value }))}
        style={{ "--ruler-progress": `${((+draft[key] - min) / (max - min)) * 100}%` }}
      />
      <div className="ruler-ticks" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((tick) => <i key={tick} />)}
      </div>
    </label>
  );

  return (
    <main className="setup-shell">
      <section className={`setup-card setup-step-${step}`}>
        <div className="setup-topbar">
          {step > 1 ? <button type="button" className="setup-back" aria-label="Previous step" onClick={() => {
            setDirection("back");
            setStep((value) => value - 1);
          }}>‹</button> : <span />}
          <div className="brand">HTF</div>
          <span className="setup-count">{step}/6</span>
        </div>
        <div className="progress-dots">{[1, 2, 3, 4, 5, 6].map((item) => <i key={item} className={item <= step ? "on" : ""} />)}</div>
        <form onSubmit={next} className={`setup-form slide-${direction}`} key={step}>
          <div className="setup-heading">
            <span>Personalize your plan</span>
            <h1>{titles[step - 1]}</h1>
          </div>
          {step === 1 && <div className="gender-grid">
            {[["male", "Male", "M"], ["female", "Female", "F"]].map(([value, label, mark]) =>
              <button type="button" key={value} className={draft.gender === value ? "gender-card on" : "gender-card"} onClick={() => setDraft((item) => ({ ...item, gender: value }))}>
                <span className={`gender-figure ${value}`} aria-hidden="true"><i /><b>{mark}</b></span>
                <strong>{label}</strong>
              </button>)}
          </div>}
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
          <div className="row gap">
            {step === 1 && state.profile ? <button type="button" className="secondary" onClick={onCancel}>Cancel</button> : null}
            <button className="primary setup-next" type="submit">{step === 6 ? "Create my plan" : "Continue"}<span aria-hidden="true">→</span></button>
          </div>
        </form>
      </section>
    </main>
  );
}

function Nav({ tab, setTab }) {
  return <nav className="bottom-nav">
    {[["today", "dumbbell", "Train"], ["plan", "checks", "Plan"], ["progress", "trend", "Progress"]].map(([value, icon, label]) =>
      <button key={value} className={tab === value ? "on" : ""} onClick={() => setTab(value)}><Icon name={icon} /><span>{label}</span></button>)}
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

export default function App() {
  const [state, setState] = useState(loadState);
  const [setupOpen, setSetupOpen] = useState(false);
  const [tab, setTab] = useState("today");
  const [workout, setWorkout] = useState(null);
  const [activeSession, setActiveSession] = useState(0);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, _u: Date.now() }));
  }, [state]);

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

  const toggleSet = (exerciseIndex, setIndex) => {
    const key = `${exerciseIndex}-${setIndex}`;
    setState((value) => {
      const sets = { ...value.sets };
      if (sets[key]) delete sets[key]; else sets[key] = 1;
      return { ...value, sets };
    });
  };

  const finishSession = () => {
    setState((value) => {
      const completedSets = Object.keys(value.sets).length;
      if (!completedSets) return { ...value, start: null };
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
  };

  if (!state.profile) return <ProfileSetup state={state} setState={setState} onCancel={() => setTab("today")} onComplete={() => setSetupOpen(false)} />;
  if (setupOpen) return <ProfileSetup state={state} setState={setState} onCancel={() => setSetupOpen(false)} onComplete={() => setSetupOpen(false)} />;

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
                {workout === -1 ? <ExerciseScene exercise="Push-ups" playing={playing} slow={slow} speed={speed} loop={loop} restartKey={restartKey} musclesVisible={musclesVisible} cameraView={cameraView} onTimeline={setTimeline} autoRotate={autoRotate} resetCameraKey={resetCameraKey} timelineSeek={timelineSeek} selectedMuscle={selectedMuscle ? selectedMuscle.key : null} isolationMode={isolationMode} explodedView={explodedView} autoTrack={autoTrack} /> : <ExerciseScene exercise={exercise.name} playing={playing} slow={slow} speed={speed} loop={loop} restartKey={restartKey} musclesVisible={musclesVisible} cameraView={cameraView} onTimeline={setTimeline} autoRotate={autoRotate} resetCameraKey={resetCameraKey} timelineSeek={timelineSeek} selectedMuscle={selectedMuscle ? selectedMuscle.key : null} isolationMode={isolationMode} explodedView={explodedView} autoTrack={autoTrack} />}
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
          <section className="card"><h2>Exercises</h2>{EXERCISES.map((item) => <div className="exercise-row" key={item.name}><div><b>{item.name}</b><span>{item.variation}</span></div><strong>3 × {item.target}</strong></div>)}</section>
        </>}
        {tab === "progress" && <>
          <h1>Progress</h1>
          <section className="card"><div className="kpi-grid"><div><span>This week</span><b>{currentWeekLogs.length}/{sessionTarget}</b></div><div><span>Workouts</span><b>{state.log.length}</b></div><div><span>Sets logged</span><b>{state.log.reduce((total, entry) => total + (entry.sets || 0), 0)}</b></div></div></section>
          <ProgressCharts log={state.log} />
          <section className="card"><h2>Training history</h2>{state.log.length ? state.log.slice(-8).reverse().map((entry, index) => <div className="exercise-row" key={`${entry.d}-${index}`}><b>{new Date(entry.d).toLocaleDateString()}</b><span>{entry.reps} reps · {entry.sets || 0} sets</span></div>) : <p className="muted">No sessions completed yet.</p>}</section>
        </>}
      </main>
      <Nav tab={tab} setTab={setTab} />
    </>
  );
}
