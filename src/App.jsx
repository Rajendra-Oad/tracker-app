import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { EXERCISES, WARMUPS } from "./data/training";
import { ProfileSetup } from "./components/onboarding/ProfileSetup";
import { Nav, ProfileTrigger } from "./components/navigation/AppNavigation";
import { Icon } from "./components/ui/Icon";
import { HTFPreloader } from "./components/ui/HTFPreloader";
import { PlanGenerationScreen } from "./components/onboarding/PlanGenerationScreen";
import { hasCachedCriticalAssets, preloadCriticalAssets } from "./services/assetPreloader";
import { BODY_PARTS, dateKey, exercisesForBodyPart, formatElapsedTime, getGreeting, getSuggestedDay, getWeekNumber, LEVEL_NAMES, matchesBodyPart, startOfWeek } from "./features/dashboard/utils/dashboardUtils";

const ExerciseScene = lazy(() => import("./features/exercise/three/ExerciseScene"));

import { defaultState, LEGACY_STORAGE_KEY, loadState, STORAGE_KEY, STORAGE_VERSION } from "./app/appState";


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

function buildSmoothPath(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point[0]} ${point[1]}`;
    const previous = points[index - 1];
    const midpoint = (previous[0] + point[0]) / 2;
    return `${path} C ${midpoint} ${previous[1]}, ${midpoint} ${point[1]}, ${point[0]} ${point[1]}`;
  }, "");
}

function ProgressCharts({ log, startedAt, onStartWorkout }) {
  const validLog = log.filter((entry) => Number.isFinite(new Date(entry.d).getTime()));
  const hasHistory = validLog.length > 0;
  const journeyStart = startOfWeek(startedAt || validLog[0]?.d || new Date());
  const currentMonday = startOfWeek(new Date());
  const availableWeeks = Math.max(1, Math.floor((currentMonday - journeyStart) / 604800000) + 1);
  const weekCount = Math.min(6, availableWeeks);
  const chartStart = new Date(currentMonday);
  chartStart.setDate(chartStart.getDate() - (weekCount - 1) * 7);
  const weeks = Array.from({ length: weekCount }, (_, index) => {
    const start = new Date(chartStart);
    start.setDate(start.getDate() + index * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, count: validLog.filter((entry) => new Date(entry.d) >= start && new Date(entry.d) < end).length };
  });
  const maxCount = Math.max(1, ...weeks.map((week) => week.count));
  const scaleMax = Math.max(3, Math.ceil(maxCount / 3) * 3);
  const chart = { left: 42, right: 344, top: 18, bottom: 142 };
  const xStep = weeks.length > 1 ? (chart.right - chart.left) / (weeks.length - 1) : 0;
  const points = weeks.map((week, index) => [chart.left + index * xStep, chart.bottom - (week.count / scaleMax) * (chart.bottom - chart.top)]);
  const linePath = buildSmoothPath(points);
  const areaPath = points.length ? `${linePath} L ${points[points.length - 1][0]} ${chart.bottom} L ${points[0][0]} ${chart.bottom} Z` : "";
  const muscles = new Map();
  validLog.forEach((entry) => (entry.muscles || []).forEach((muscle) => muscles.set(muscle, (muscles.get(muscle) || 0) + 1)));
  const focus = [...muscles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxFocus = Math.max(1, ...focus.map(([, count]) => count));

  return (
    <>
      <section className={`progress-chart ${!hasHistory ? "progress-chart-empty" : ""}`}>
        <div className="progress-chart-head"><h2>Workout consistency</h2><span>Sessions per week</span></div>
        {!hasHistory ? (
          <div className="chart-empty-state"><div className="chart-empty-illustration" aria-hidden="true"><span /><span /><span /></div><strong>Your fitness journey starts here</strong><p>Complete your first workout to see your progress.</p><button type="button" className="chart-start-button" onClick={onStartWorkout}>Start workout →</button></div>
        ) : (
          <svg viewBox="0 0 370 176" role="img" aria-label={`Completed workouts per week from ${weeks[0].start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} to now`}>
            <defs><linearGradient id="activity-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".26" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
            {[0, 1, 2, 3].map((step) => { const y = chart.bottom - (step / 3) * (chart.bottom - chart.top); const label = Math.round((scaleMax / 3) * step); return <g key={step}><line x1={chart.left} x2={chart.right} y1={y} y2={y} /><text className="chart-y-label" x="3" y={y + 3}>{label}</text></g>; })}
            <path className="progress-chart-area" d={areaPath} />
            <path className="progress-chart-line" d={linePath} />
            {weeks.map((week, index) => { const [x, y] = points[index]; return <g key={week.start.toISOString()}><circle cx={x} cy={y} r="3.5" /><text x={x} y="166">{week.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text><title>{week.count} session{week.count === 1 ? "" : "s"}</title></g>; })}
          </svg>
        )}
        {hasHistory && <div className="chart-caption">{validLog.length} completed workout{validLog.length === 1 ? "" : "s"} recorded</div>}
      </section>
      <section className="muscle-progress">
        <div className="progress-chart-head"><h2>Training focus</h2><span>By completed exercises</span></div>
        {focus.length ? focus.map(([muscle, count]) => (
          <div className="focus-progress" key={muscle}>
            <div><span>{muscle}</span><b>{count} session{count === 1 ? "" : "s"}</b></div>
            <i><span style={{ width: `${(count / maxFocus) * 100}%` }} /></i>
          </div>
        )) : <p className="muted mt-3">Muscle groups will appear here after you complete and log exercise sets.</p>}
        <p className="chart-note">Training focus reflects logged exercises; it is not a measurement of muscle growth.</p>
      </section>
    </>
  );
}


function MobileTrainDashboard({ state, log, target, weekNumber, activeSession, onOpenProfile, onOpenSession, onOpenBodyPart, onManagePlan }) {
  const firstDay = startOfWeek(new Date());
  const todayIndex = (new Date().getDay() + 6) % 7;
  const [selectedDay, setSelectedDay] = useState(todayIndex);
  const [showYearSummary, setShowYearSummary] = useState(false);
  const weekEntries = log.filter((entry) => new Date(entry.d) >= firstDay);
  const currentYear = new Date().getFullYear();
  const yearEntries = log.filter((entry) => new Date(entry.d).getFullYear() === currentYear);
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
      <header className="page-head mobile-home-header">
        <div className="mobile-title-row"><h1>Train</h1><ProfileTrigger profile={state.profile} onOpen={onOpenProfile} /></div>
      </header>
      <div className="mobile-greeting-block"><span className="mobile-greeting">{getGreeting(state.profile?.name)}</span></div>

      <section className="mobile-week-card" aria-label="Weekly training summary">
        <div className="mobile-week-stats">
          <div><span>This week</span><strong>{weekEntries.length}<small> / {target} sessions</small></strong></div>
          <div><span>Sets</span><strong>{weeklySets}</strong></div>
        </div>
        <div className="mobile-week-days" aria-label="Select a training day">
          {days.map(({ date, key, index, completed, planned }) => (
            <button type="button" key={key} className={`mobile-week-day ${selectedDay === index ? "selected" : ""} ${index === todayIndex ? "today" : ""} ${completed ? "completed" : ""} ${planned ? "planned" : ""}`}
              aria-pressed={selectedDay === index}
              aria-current={index === todayIndex ? "date" : undefined}
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
          <div className="mobile-muscle-progress" role="progressbar" aria-label="This week's muscle mix" aria-valuemin={0} aria-valuemax={100} aria-valuenow={mixTotal ? 100 : 0}>
            <div className="mobile-muscle-track">
              {mix.map((part) => {
                const percentage = mixTotal ? Math.round((part.count / mixTotal) * 100) : 0;
                return <i key={part.name} data-tone={part.name.toLowerCase()} style={{ width: `${percentage}%` }} aria-hidden="true" />;
              })}
            </div>
            <div className="mobile-muscle-legend">
              {mix.map((part) => {
                const percentage = mixTotal ? Math.round((part.count / mixTotal) * 100) : 0;
                return <span key={part.name}><i aria-hidden="true" data-tone={part.name.toLowerCase()} />{part.name} <b>{percentage}%</b></span>;
              })}
            </div>
          </div>
          {!mixTotal && (
            <div className="mobile-empty-mix">
              <p>{yearEntries.length ? `${yearEntries.length} workout${yearEntries.length === 1 ? "" : "s"} completed this year.` : "No workouts recorded this week yet."}</p>
              <button type="button" className="mobile-year-summary-toggle" aria-expanded={showYearSummary} onClick={() => setShowYearSummary((value) => !value)}>
                {showYearSummary ? "Hide yearly activity" : "View this year's activity"} <Icon name="right" size={14} />
              </button>
              {showYearSummary && <div className="mobile-year-summary" aria-label="This year's workout summary"><strong>{yearEntries.length}</strong><span>workout{yearEntries.length === 1 ? "" : "s"} completed in {currentYear}</span></div>}
            </div>
          )}
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
        <div className="mobile-set-progress" role="progressbar" aria-label={`${completedSets.length} of 3 sets completed`} aria-valuemin="0" aria-valuemax="3" aria-valuenow={completedSets.length}>
          <div className="mobile-set-progress-label">
            <span>Set progress</span>
            <strong>{completedSets.length} of 3 complete</strong>
          </div>
          <div className="mobile-set-progress-track">
            <i style={{ width: `${(completedSets.length / 3) * 100}%` }} />
          </div>
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

function MobilePlan({ state, target, currentWeekLogs, activeSession, onOpenProfile, onStartWorkout }) {
  const [expandedExercise, setExpandedExercise] = useState(null);
  const [exerciseList, setExerciseList] = useState(() => EXERCISES.slice(0, 8));
  const completedExercises = new Set(currentWeekLogs.flatMap((entry) => entry.exercises || []));
  const completedCount = exerciseList.filter((item) => completedExercises.has(EXERCISES.indexOf(item))).length;
  const swapExercise = (index) => {
    const replacement = EXERCISES.find((item) => !exerciseList.some((current) => current.id === item.id));
    if (!replacement) return;
    setExerciseList((items) => items.map((item, itemIndex) => itemIndex === index ? replacement : item));
  };
  const removeExercise = (index) => setExerciseList((items) => items.filter((_, itemIndex) => itemIndex !== index));
  const addExercise = () => {
    const replacement = EXERCISES.find((item) => !exerciseList.some((current) => current.id === item.id));
    if (replacement) setExerciseList((items) => [...items, replacement]);
  };
  const moveExercise = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= exerciseList.length) return;
    setExerciseList((items) => {
      const next = [...items];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  return (
    <main className="app-shell mobile-plan-shell">
      <header className="page-head mobile-home-header"><div><span className="muted">Your weekly routine</span><h1>Plan</h1></div><ProfileTrigger profile={state.profile} onOpen={onOpenProfile} /></header>
      <section className="mobile-plan-summary card">
        <div className="mobile-plan-summary-head"><div><span className="muted">This week's workout</span><h2>Session {activeSession + 1}</h2></div><span className="chip">{currentWeekLogs.length}/{target} complete</span></div>
        <div className="mobile-plan-progress" role="progressbar" aria-label="Workout plan progress" aria-valuemin="0" aria-valuemax={exerciseList.length} aria-valuenow={completedCount}><span style={{ width: `${exerciseList.length ? (completedCount / exerciseList.length) * 100 : 0}%` }} /></div>
        <div className="mobile-plan-progress-label"><span>{completedCount} of {exerciseList.length} exercises complete</span><span>About {Math.max(10, exerciseList.length * 5)} min</span></div>
        <button type="button" className="primary full" onClick={onStartWorkout}>{state.start ? "Continue workout" : "Start workout"}</button>
      </section>
      <section className="mobile-plan-exercises card">
        <div className="mobile-section-heading"><div><h2>Exercises</h2><span>Tap an exercise for details</span></div><button type="button" className="mobile-manage-button" onClick={addExercise}>Add <Icon name="plus" size={15} /></button></div>
        <div className="mobile-plan-exercise-list">
          {exerciseList.map((exercise, index) => {
            const originalIndex = EXERCISES.indexOf(exercise);
            const complete = completedExercises.has(originalIndex);
            const open = expandedExercise === exercise.id;
            return <article className={`mobile-plan-exercise ${complete ? "completed" : ""}`} key={exercise.id}>
              <button type="button" className="mobile-plan-exercise-trigger" aria-expanded={open} onClick={() => setExpandedExercise(open ? null : exercise.id)}>
                <span className="mobile-plan-exercise-index">{complete ? <Icon name="check" size={14} /> : index + 1}</span>
                <span><strong>{exercise.name}</strong><small>3 × {exercise.target} reps · Rest 1:30</small></span>
                <Icon name="down" size={17} />
              </button>
              {open && <div className="mobile-plan-exercise-details"><p>{exercise.description}</p><div className="mobile-plan-muscles">{exercise.muscles.map((muscle) => <span key={muscle}>{muscle}</span>)}</div><div className="mobile-plan-actions"><button type="button" onClick={() => swapExercise(index)}>Swap</button><button type="button" onClick={() => moveExercise(index, -1)} disabled={index === 0}>Move up</button><button type="button" onClick={() => moveExercise(index, 1)} disabled={index === exerciseList.length - 1}>Move down</button><button type="button" onClick={() => removeExercise(index)}>Remove</button></div></div>}
            </article>;
          })}
        </div>
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
  }, [open, confirmingLogout]);

  if (!open) return null;

  if (confirmingLogout) {
    return (
      <dialog className="mobile-profile-dialog mobile-logout-dialog" ref={dialogRef} aria-labelledby="logout-title"
        onCancel={(event) => { event.preventDefault(); closeDialog(); }}
        onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
        <div className="mobile-profile-card mobile-logout-confirm">
          <span className="mobile-dialog-mark mobile-dialog-mark-danger" aria-hidden="true">!</span>
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
        <span className="mobile-sheet-handle" aria-hidden="true" />
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

function MobileProfileEdit({ profile, onBack, onSave }) {
  const [draft, setDraft] = useState({
    name: profile?.name || "",
    age: profile?.age || "",
    height: profile?.height || "",
    weight: profile?.weight || "",
    goalW: profile?.goalW || "",
    frequency: profile?.frequency || 3,
    gender: profile?.gender || "male",
    objective: profile?.objective || "muscle",
  });

  const update = (key) => (event) => setDraft((value) => ({ ...value, [key]: event.target.value }));
  const save = (event) => {
    event.preventDefault();
    if (!draft.name.trim()) return;
    onSave({
      ...profile,
      name: draft.name.trim().split(/\s+/).filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`).join(" "),
      age: Number(draft.age),
      height: Number(draft.height),
      weight: Number(draft.weight),
      goalW: Number(draft.goalW),
      frequency: Number(draft.frequency),
      gender: draft.gender,
      objective: draft.objective,
    });
  };

  return (
    <main className="mobile-profile-edit-shell">
      <header className="mobile-flow-header">
        <button type="button" className="mobile-back-button" aria-label="Back to profile" onClick={onBack}><Icon name="left" size={22} /></button>
        <div><span>Your account</span><h1>Edit profile</h1></div>
      </header>
      <form className="mobile-profile-edit-form" onSubmit={save}>
        <p className="mobile-flow-copy">Update your details in one place.</p>
        <label><span>Name</span><input value={draft.name} onChange={update("name")} autoComplete="name" required /></label>
        <div className="mobile-profile-edit-grid">
          <label><span>Age</span><input type="number" min="10" max="90" value={draft.age} onChange={update("age")} /></label>
          <label><span>Height (cm)</span><input type="number" min="120" max="220" value={draft.height} onChange={update("height")} /></label>
          <label><span>Weight (kg)</span><input type="number" min="25" max="250" value={draft.weight} onChange={update("weight")} /></label>
          <label><span>Goal weight (kg)</span><input type="number" min="25" max="250" value={draft.goalW} onChange={update("goalW")} /></label>
        </div>
        <label><span>Training days per week</span><select value={draft.frequency} onChange={update("frequency")}>{[3, 4, 5, 6].map((value) => <option key={value} value={value}>{value} days</option>)}</select></label>
        <label><span>Goal</span><select value={draft.objective} onChange={update("objective")}><option value="muscle">Build muscle</option><option value="fat-loss">Burn fat</option><option value="strength">Get stronger</option><option value="fitness">Improve fitness</option></select></label>
        <div className="mobile-profile-edit-actions"><button type="button" className="secondary full" onClick={onBack}>Cancel</button><button type="submit" className="primary full">Save changes</button></div>
      </form>
    </main>
  );
}

export default function App() {
  const [state, setState] = useState(loadState);
  const [booting, setBooting] = useState(() => !hasCachedCriticalAssets());
  const [bootProgress, setBootProgress] = useState(0);
  const [bootStatus, setBootStatus] = useState("Preparing your experience");
  const [planGenerating, setPlanGenerating] = useState(false);
  const [resolvedTheme, setResolvedTheme] = useState("dark");
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 755px)").matches);
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
  const [mobileProfileEditOpen, setMobileProfileEditOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
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
  const mobileHistoryReady = useRef(false);

  useEffect(() => {
    let alive = true;
    const startedAt = performance.now();
    preloadCriticalAssets(
      (progress) => alive && setBootProgress(progress),
      (status) => alive && setBootStatus(status),
    ).finally(() => {
      const remaining = Math.max(0, 420 - (performance.now() - startedAt));
      window.setTimeout(() => {
        if (!alive) return;
        setBootProgress(100);
        setBootStatus("Almost ready");
        setBooting(false);
      }, remaining);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!isMobile) return undefined;

    const currentLocation = window.location.href;
    if (!mobileHistoryReady.current) {
      const baseState = { ...(window.history.state || {}), trackerApp: true, trackerRoot: true, tab: "today", mobileView: "home" };
      window.history.replaceState(baseState, "", currentLocation);
      window.history.pushState({ trackerApp: true, tab, mobileView }, "", currentLocation);
      mobileHistoryReady.current = true;
    }

    const handleBack = (event) => {
      const nextState = event.state;
      if (!nextState?.trackerApp) {
        window.history.pushState({ trackerApp: true, tab: "today", mobileView: "home" }, "", currentLocation);
        setTab("today");
        setMobileView("home");
        setMobileProfileOpen(false);
        return;
      }
      if (nextState.trackerRoot) {
        window.history.pushState({ trackerApp: true, tab: "today", mobileView: "home" }, "", currentLocation);
        setTab("today");
        setMobileView("home");
      } else {
        setTab(nextState.tab || "today");
        setMobileView(nextState.mobileView || "home");
        setMobileProfileOpen(false);
      }
    };

    window.addEventListener("popstate", handleBack);
    return () => window.removeEventListener("popstate", handleBack);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || !mobileHistoryReady.current) return;
    const current = window.history.state;
    if (current?.trackerApp && !current.trackerRoot && current.tab === tab && current.mobileView === mobileView) return;
    window.history.pushState({ trackerApp: true, tab, mobileView }, "", window.location.href);
  }, [isMobile, tab, mobileView]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 755px)");
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, _version: STORAGE_VERSION }));
    } catch {
      // Storage can be unavailable in private browsing or restricted webviews.
    }
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
  const historyEntries = [...state.log].sort((a, b) => new Date(b.d) - new Date(a.d));

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
    localStorage.removeItem(LEGACY_STORAGE_KEY);
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

  const finishPlanGeneration = useCallback(() => setPlanGenerating(false), []);

  if (booting) return <HTFPreloader progress={bootProgress} status={bootStatus} />;
  if (!state.profile) return <ProfileSetup state={state} setState={setState} onCancel={() => setTab("today")} onComplete={() => setPlanGenerating(true)} />;
  if (planGenerating) return <PlanGenerationScreen profile={state.profile} track={LEVEL_NAMES[state.track]} onFinished={finishPlanGeneration} />;
  if (setupOpen) return <ProfileSetup
    state={state}
    setState={setState}
    nameOnly={editingProfile || Boolean(state.profile && !String(state.profile.name || "").trim())}
    onCancel={() => { setSetupOpen(false); setEditingProfile(false); }}
    onComplete={() => { setSetupOpen(false); setEditingProfile(false); }}
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

  if (isMobile && tab === "today" && mobileProfileEditOpen) {
    return <MobileProfileEdit
      profile={state.profile}
      onBack={() => setMobileProfileEditOpen(false)}
      onSave={(profile) => { setState((value) => ({ ...value, profile })); setMobileProfileEditOpen(false); }}
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
      <Nav tab={tab} setTab={setTab} />
      <MobileProfileDialog
        open={mobileProfileOpen}
        profile={state.profile}
        onClose={() => setMobileProfileOpen(false)}
        onEdit={() => { setMobileProfileOpen(false); setMobileProfileEditOpen(true); }}
        onLogout={logout}
      />
    </>;
  }

  if (isMobile && tab === "plan" && !mobileProfileEditOpen) {
    return <>
      <MobilePlan
        state={state}
        target={sessionTarget}
        currentWeekLogs={currentWeekLogs}
        activeSession={activeSession}
        onOpenProfile={() => setMobileProfileOpen(true)}
        onStartWorkout={() => { setTab("today"); openMobileSession(activeSession); }}
      />
      <Nav tab={tab} setTab={setTab} />
      <MobileProfileDialog
        open={mobileProfileOpen}
        profile={state.profile}
        onClose={() => setMobileProfileOpen(false)}
        onEdit={() => { setMobileProfileOpen(false); setMobileProfileEditOpen(true); }}
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
          <header className="page-head"><div><span className="muted">{LEVEL_NAMES[state.track]} plan</span><h1>Week {planWeek}</h1></div><div className="page-head-actions"><span className="week-target">{sessionTarget} workouts / week</span><ProfileTrigger profile={state.profile} onOpen={() => setMobileProfileOpen(true)} /></div></header>
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
          <header className="page-head"><h1>Plan</h1><ProfileTrigger profile={state.profile} onOpen={() => setMobileProfileOpen(true)} /></header>
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
          <section className="card"><h2>Exercises</h2>{EXERCISES.map((item) => <div className="exercise-row" key={item.name}><div><b>{item.name}</b><span>{item.variation}</span></div><strong>3 — {item.target}</strong></div>)}</section>
        </>}
        {tab === "progress" && <>
          <header className="page-head"><h1>Progress</h1><ProfileTrigger profile={state.profile} onOpen={() => setMobileProfileOpen(true)} /></header>
          <section className="card"><div className="kpi-grid"><div><span>This week</span><b>{currentWeekLogs.length}/{sessionTarget}</b></div><div><span>Workouts</span><b>{state.log.length}</b></div><div><span>Sets logged</span><b>{state.log.reduce((total, entry) => total + (entry.sets || 0), 0)}</b></div></div></section>
          <ProgressCharts log={state.log} startedAt={state.profile?.planStartedAt || state.log[0]?.d} onStartWorkout={() => setTab("today")} />
          <section className="card"><h2>Training history</h2>{historyEntries.length ? historyEntries.slice(0, 8).map((entry) => <div className="exercise-row training-history-row" key={entry.d}><div><b>{new Date(entry.d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</b><span>Session {(entry.session ?? 0) + 1} · {entry.exercises?.length || 0} exercises</span></div><strong>{entry.dur ? formatElapsedTime(Math.round(entry.dur / 1000)) : "—"}</strong></div>) : <p className="muted">Complete a workout to build your history.</p>}</section>
        </>}
      </main>
      <Nav tab={tab} setTab={setTab} />
      <MobileProfileDialog
        open={mobileProfileOpen}
        profile={state.profile}
        onClose={() => setMobileProfileOpen(false)}
        onEdit={() => { setMobileProfileOpen(false); setMobileProfileEditOpen(true); }}
        onLogout={logout}
      />
    </>
  );
}






