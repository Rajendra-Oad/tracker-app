import { useEffect, useRef, useState } from "react";

const LEVELS = ["A", "B", "C", "D"];
const LEVEL_NAMES = { A: "Beginner", B: "Intermediate", C: "Advanced", D: "Ultra" };

function normalizeName(value) {
  return value.trim().split(/\s+/).filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`).join(" ");
}

function SetupAlert({ alert, onDismiss }) {
  const alertRef = useRef(null);
  const startX = useRef(null);
  const startY = useRef(null);
  const currentX = useRef(0);
  const lastX = useRef(0);
  const lastTime = useRef(0);
  const frame = useRef(null);
  const pointerId = useRef(null);
  const dragging = useRef(false);
  const horizontal = useRef(false);
  const [interaction, setInteraction] = useState("");

  const paint = (x) => {
    const node = alertRef.current;
    if (!node) return;
    const rotation = Math.max(-7, Math.min(7, x * 0.035));
    const scale = 1 - Math.min(Math.abs(x) / 1800, 0.055);
    const opacity = 1 - Math.min(Math.abs(x) / 520, 0.42);
    node.style.setProperty("--drag-x", `${x}px`);
    node.style.setProperty("--drag-rotation", `${rotation}deg`);
    node.style.setProperty("--drag-scale", `${scale}`);
    node.style.setProperty("--drag-opacity", `${opacity}`);
    node.style.setProperty("--drag-shadow-x", `${Math.round(x * 0.12)}px`);
  };

  const schedulePaint = (x) => {
    currentX.current = x;
    if (frame.current) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = null;
      paint(currentX.current);
    });
  };

  const dismiss = (direction = 1) => {
    if (interaction.startsWith("exit")) return;
    if (frame.current) window.cancelAnimationFrame(frame.current);
    const node = alertRef.current;
    node?.style.setProperty("--dismiss-x", `${direction * 115}%`);
    node?.style.setProperty("--dismiss-rotation", `${direction * 5}deg`);
    dragging.current = false;
    horizontal.current = false;
    pointerId.current = null;
    setInteraction(direction > 0 ? "exit-right" : "exit-left");
    window.setTimeout(() => onDismiss(alert.id), 260);
  };

  const reset = () => {
    dragging.current = false;
    horizontal.current = false;
    pointerId.current = null;
    if (frame.current) window.cancelAnimationFrame(frame.current);
    currentX.current = 0;
    setInteraction("returning");
    paint(0);
    window.setTimeout(() => setInteraction(""), 320);
  };

  const handlePointerDown = (event) => {
    if (event.target.closest("button") || interaction.startsWith("exit")) return;
    startX.current = event.clientX;
    startY.current = event.clientY;
    lastX.current = event.clientX;
    lastTime.current = performance.now();
    pointerId.current = event.pointerId;
    dragging.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragging.current || pointerId.current !== event.pointerId) return;
    const dx = event.clientX - startX.current;
    const dy = event.clientY - startY.current;
    if (!horizontal.current) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        reset();
        return;
      }
      if (Math.abs(dx) < 3) return;
      horizontal.current = true;
      setInteraction("dragging");
    }
    event.preventDefault();
    const now = performance.now();
    lastX.current = event.clientX;
    lastTime.current = now;
    schedulePaint(dx);
  };

  const handlePointerUp = (event) => {
    if (!dragging.current || pointerId.current !== event.pointerId) return;
    const dx = currentX.current;
    const elapsed = Math.max(performance.now() - lastTime.current, 1);
    const velocity = (event.clientX - lastX.current) / elapsed;
    const shouldDismiss = horizontal.current && (Math.abs(dx) > 110 || Math.abs(velocity) > 0.65);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (shouldDismiss) dismiss(dx === 0 ? (velocity > 0 ? 1 : -1) : Math.sign(dx));
    else reset();
  };

  const handlePointerCancel = (event) => {
    if (!dragging.current) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    reset();
  };

  return (
    <div
      ref={alertRef}
      className={`setup-alert flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] via-[var(--surface-raised)] to-[var(--page)] px-2.5 py-2.5 pl-3.5 text-[.82rem] font-bold leading-[1.3] text-[var(--text)] shadow-[0_14px_36px_#00000055] backdrop-blur-md pointer-events-auto touch-pan-y will-change-transform ${interaction ? `setup-alert-${interaction}` : "setup-alert-idle animate-[setupAlertDrop_260ms_cubic-bezier(.16,1,.3,1)]"}`}
      role="alert"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--surface-raised)] text-xs font-black text-[var(--text)]" aria-hidden="true">!</span>
      <strong className="flex-1">{alert.message}</strong>
      <button className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border-0 bg-transparent text-xl leading-none text-[var(--muted)]" type="button" aria-label="Dismiss message" onClick={() => dismiss(1)}>×</button>
    </div>
  );
}

export function ProfileSetup({ state, setState, onCancel, onComplete, nameOnly = false }) {
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
  const [alerts, setAlerts] = useState([]);
  const [direction, setDirection] = useState("forward");
  const [heightUnit, setHeightUnit] = useState(state.profileDraft?.heightUnit || "cm");
  const [weightUnit, setWeightUnit] = useState(state.profileDraft?.weightUnit || "kg");
  const [rulerDirections, setRulerDirections] = useState({});
  const rulerDrag = useRef(null);
  const nameInputRef = useRef(null);
  const setupHistoryReady = useRef(false);
  const showError = (message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setAlerts((value) => [...value.slice(-2), { id, message }]);
    window.setTimeout(() => setAlerts((value) => value.filter((alert) => alert.id !== id)), 4200);
  };
  const dismissAlert = (id) => setAlerts((value) => value.filter((alert) => alert.id !== id));

  const keepNameInputVisible = () => {
    window.setTimeout(() => nameInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" }), 120);
  };

  useEffect(() => {
    const current = window.history.state;
    if (!current?.trackerApp) return undefined;
    if (!setupHistoryReady.current) {
      if (current.trackerSetup) {
        window.history.replaceState({ ...current, trackerSetup: true, setupStep: step }, "", window.location.href);
      } else {
        window.history.replaceState({ ...current, trackerSetup: true, setupStep: 1 }, "", window.location.href);
      }
      setupHistoryReady.current = true;
      if (!current.trackerSetup && step !== 1) window.history.pushState({ ...current, trackerSetup: true, setupStep: step }, "", window.location.href);
    } else if (current.setupStep !== step) {
      window.history.pushState({ ...current, trackerSetup: true, setupStep: step }, "", window.location.href);
    }
    return undefined;
  }, [step]);

  useEffect(() => {
    const handleSetupBack = (event) => {
      setDirection("back");
      const targetStep = event.state?.trackerSetup ? event.state.setupStep || 0 : event.state?.setupStep || 0;
      setStep((currentStep) => Math.max(1, targetStep === currentStep || !targetStep ? currentStep - 1 : targetStep));
    };
    window.addEventListener("popstate", handleSetupBack);
    return () => window.removeEventListener("popstate", handleSetupBack);
  }, []);

  useEffect(() => {
    const persistedDraft = { ...draft, heightUnit, weightUnit };
    setState((value) => {
      if (value.profileStep === step && JSON.stringify(value.profileDraft) === JSON.stringify(persistedDraft)) return value;
      return { ...value, profileStep: step, profileDraft: persistedDraft };
    });
  }, [draft, heightUnit, weightUnit, setState, step]);

  const goBack = () => {
    if (step === 1) {
      onCancel?.();
      return;
    }
    if (window.history.state?.trackerSetup && window.history.state.setupStep === step) {
      window.history.back();
      return;
    }
    setDirection("back");
    setStep((value) => Math.max(1, value - 1));
  };

  const next = (event) => {
    event.preventEvent?.();
    event.preventDefault();
    const persistedDraft = { ...draft, heightUnit, weightUnit };
    if (step === 1 && !draft.name.trim()) {
      showError("Enter your name to continue.");
      return;
    }
    if (nameOnly) {
      setState((value) => ({
        ...value,
        profile: value.profile ? { ...value.profile, name: normalizeName(draft.name) } : value.profile,
        profileDraft: null,
        profileStep: null,
      }));
      onComplete?.();
      return;
    }
    if (step === 4 && (!(+draft.age >= 10 && +draft.age <= 90) || !(+draft.height >= 120 && +draft.height <= 220))) {
      showError("Choose a valid age and height.");
      return;
    }
    if (step === 5 && (!(+draft.weight >= 25 && +draft.weight <= 250) || !(+draft.goalW >= 25 && +draft.goalW <= 250))) {
      showError("Choose a valid current and goal weight.");
      return;
    }
    if (step < 6) {
      const nextStep = step + 1;
      setDirection("forward");
      setStep(nextStep);
      setState((value) => ({ ...value, profileStep: nextStep, profileDraft: persistedDraft }));
      return;
    }
    const profile = {
      name: normalizeName(draft.name),
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
  const updateUnit = (key, setUnit, unit) => {
    setUnit(unit);
    setDraft((value) => ({ ...value, [key]: value[key], ...(key === "height" ? { heightUnit: unit } : { weightUnit: unit }) }));
  };
  const unitToggle = (value, setValue, options, draftKey) => (
    <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-1" role="group" aria-label={`${draftKey} unit`}>
      {options.map((option) => <button type="button" key={option} aria-pressed={value === option} className={`min-h-9 rounded-lg px-3 text-xs font-extrabold transition-colors duration-200 ${value === option ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-transparent text-[var(--muted)]"}`} onClick={() => updateUnit(draftKey === "height" ? "height" : "weight", setValue, option)}>{option}</button>)}
    </div>
  );
  const updateRuler = (key, value, onChange) => {
    setRulerDirections((current) => {
      const previous = Number(draft[key]);
      const next = Number(value);
      return next === previous ? current : { ...current, [key]: next > previous ? "increase" : "decrease" };
    });
    onChange(value);
  };
  const beginRulerDrag = (event, key, value, min, max, inputStep, onChange) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    rulerDrag.current = { pointerId: event.pointerId, key, startX: event.clientX, lastX: event.clientX, lastTime: performance.now(), rawValue: Number(value), value: Number(value), min, max, inputStep, onChange, active: false };
  };
  const moveRulerDrag = (event) => {
    const drag = rulerDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const now = performance.now();
    const distance = event.clientX - drag.lastX;
    if (!drag.active && Math.abs(event.clientX - drag.startX) < 8) return;
    drag.active = true;
    if (Math.abs(event.clientX - drag.lastX) < 1) return;
    const velocity = Math.abs(distance) / Math.max(16, now - drag.lastTime);
    const sensitivity = 1 + Math.min(2.5, velocity * 12);
    const movementStep = drag.inputStep < 1 ? 1 : drag.inputStep;
    drag.rawValue -= (distance / 18) * movementStep * sensitivity;
    drag.lastX = event.clientX;
    drag.lastTime = now;
    const next = Math.min(drag.max, Math.max(drag.min, Math.round(drag.rawValue / drag.inputStep) * drag.inputStep));
    if (next === drag.value) return;
    drag.value = next;
    updateRuler(drag.key, String(next), drag.onChange);
    event.preventDefault();
  };
  const endRulerDrag = (event) => {
    if (rulerDrag.current?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      rulerDrag.current = null;
    }
  };
  const ruler = ({ label, key, min, max, unit, value, displayValue, inputStep = 1, tickStep = inputStep, onChange, switcher, tickLabel = (mark) => mark }) => (
    <div className="ruler-field !grid-cols-1">
      <div className="col-span-full flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-[var(--muted)]">{label}</span>
        {switcher}
      </div>
      <b className="col-span-full flex items-baseline justify-center gap-2"><span className={`ruler-value ruler-value-${rulerDirections[key] || "idle"}`} key={`${key}-${value}`}>{displayValue}</span> <small>{unit}</small></b>
      <div className="ruler-control" style={{ "--ruler-offset": `${-(((+value - min) / tickStep) * 10 + 5)}px` }} onPointerDown={(event) => beginRulerDrag(event, key, value, min, max, inputStep, onChange)} onPointerMove={moveRulerDrag} onPointerUp={endRulerDrag} onPointerCancel={endRulerDrag}>
        <input
          type="range"
          min={min}
          max={max}
          step={inputStep}
          value={value}
          aria-label={`${label} picker`}
          onClick={(event) => event.preventDefault()}
          onChange={(event) => updateRuler(key, event.target.value, onChange)}
        />
        <div className="ruler-ticks" aria-hidden="true">
          <div className="ruler-ticks-static">{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((tick) => <i key={tick} />)}</div>
          <div className="ruler-tick-track">
            {Array.from({ length: Math.floor((max - min) / tickStep) + 1 }, (_, index) => {
              const mark = min + index * tickStep;
              const major = mark % 10 === 0;
              return <i className={major ? "ruler-tick major" : "ruler-tick"} data-value={major ? tickLabel(mark) : undefined} key={mark} />;
            })}
          </div>
          <i className="ruler-marker" />
        </div>
      </div>
    </div>
  );

  return (
    <main className="setup-shell">
      <section className={`setup-card setup-step-${step}`}>
        <div className="setup-topbar">
          <span aria-hidden="true" />
          <div className="brand">HTF</div>
          <span className="setup-count">{nameOnly ? "Profile" : `${step}/6`}</span>
        </div>
        {!nameOnly && <div className="progress-dots" role="progressbar" aria-label={`Setup progress, step ${step} of 6`} aria-valuemin={1} aria-valuemax={6} aria-valuenow={step}>{[1, 2, 3, 4, 5, 6].map((item) => <i key={item} className={item <= step ? "on" : ""} />)}</div>}
        <form onSubmit={next} className={`setup-form slide-${direction}${nameOnly ? " setup-name-only" : ""}`} key={step}>
          <div className={`setup-heading ${[3, 4, 6].includes(step) ? "pb-2" : ""}`}>
            <span>Personalize your plan</span>
            <h1>{titles[step - 1]}</h1>
          </div>
          {step === 1 && <label className="setup-name-field">
            <span>Your name</span>
            <input
              type="text"
              ref={nameInputRef}
              name="name"
              autoComplete="given-name"
              maxLength={40}
              placeholder="e.g. Raj"
              value={draft.name}
              onFocus={keepNameInputVisible}
              onChange={(event) => setDraft((item) => ({ ...item, name: event.target.value }))}
            />
            <small>We'll use this name in your Train greeting.</small>
          </label>}
          {step === 1 && !nameOnly && <section className="gender-selection" aria-labelledby="gender-heading">
            <h2 id="gender-heading">Gender</h2>
            <div className="gender-grid">
              {[["male", "Male", "/male_icon_smooth_rounded.svg"], ["female", "Female", "/female_icon_smooth_rounded.svg"], ["other", "Other / prefer not to say", null]].map(([value, label, image]) =>
                <button type="button" key={value} aria-pressed={draft.gender === value} className={`${draft.gender === value ? "gender-card on" : "gender-card"}${image ? "" : " gender-card-other"}`} onClick={() => setDraft((item) => ({ ...item, gender: value }))}>
                  {image ? <span className={`gender-figure ${value}`} aria-hidden="true"><img src={image} alt="" /></span> : null}
                  <strong>{label}</strong>
                  <span className="gender-check" aria-hidden="true">✓</span>
                </button>)}
            </div>
          </section>}
          {step === 2 && <div className="choice-grid">
            {[["3", "3 sessions a week"], ["4", "4 sessions a week"], ["5", "5 sessions a week"], ["6", "6 sessions a week"]].map(([value, label]) =>
              <button type="button" key={value} aria-pressed={draft.frequency === value} className={`choice !flex !min-h-[68px] items-center justify-between gap-3 transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2 ${draft.frequency === value ? "on !border-2 !border-black shadow-[0_0_0_3px_var(--accent-muted)]" : ""}`} onClick={() => setDraft((item) => ({ ...item, frequency: value }))}><span className="grid gap-1 text-left"><b>{label}</b><small className="text-xs font-medium text-[var(--muted)]">{value === "3" ? "Best for beginners" : value === "6" ? "For a more intensive routine" : "A balanced weekly routine"}</small></span><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-sm font-black transition-[background-color,border-color,color,transform] duration-200 ${draft.frequency === value ? "border-black bg-black text-white scale-105" : "border-[var(--border)] bg-transparent text-transparent"}`} aria-hidden="true">✓</span></button>)}
          </div>}
          {step === 3 && <div className="focus-grid">
            {[["muscle", "Build muscle", "Strength and size"], ["fat-loss", "Burn fat", "Lean and athletic"], ["strength", "Get stronger", "Power and performance"], ["fitness", "Improve fitness", "Move and feel better"]].map(([value, title, copy]) =>
              <button type="button" key={value} aria-pressed={draft.objective === value} className={`choice focus-choice !flex !min-h-[88px] items-center justify-between gap-3 transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2 ${draft.objective === value ? "on !border-2 !border-black shadow-[0_0_0_3px_var(--accent-muted)]" : ""}`} onClick={() => setDraft((item) => ({ ...item, objective: value }))}><span className="grid gap-1 text-left"><b>{title}</b><small className="text-xs font-medium text-[var(--muted)]">{copy}</small></span><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-sm font-black transition-[background-color,border-color,color,transform] duration-200 ${draft.objective === value ? "border-black bg-black text-white scale-105" : "border-[var(--border)] bg-transparent text-transparent"}`} aria-hidden="true">✓</span></button>)}
          </div>}
          {step === 4 && <div className="ruler-stack">
            {ruler({ label: "Age", key: "age", min: 10, max: 90, unit: "years", value: draft.age, displayValue: draft.age, onChange: (value) => setDraft((item) => ({ ...item, age: value })) })}
            {ruler({ label: "Height", key: "height", min: 120, max: 220, unit: heightUnit === "cm" ? "cm" : "ft / in", value: draft.height, displayValue: heightUnit === "cm" ? `${Math.round(+draft.height)}` : `${Math.floor(Math.round(+draft.height / 2.54) / 12)} ft ${Math.round(+draft.height / 2.54) % 12} in`, onChange: (value) => setDraft((item) => ({ ...item, height: value })), switcher: unitToggle(heightUnit, setHeightUnit, ["cm", "ft / in"], "height"), tickLabel: (mark) => heightUnit === "cm" ? mark : `${Math.floor(Math.round(mark / 2.54) / 12)}'${Math.round(mark / 2.54) % 12}"` })}
          </div>}
          {step === 5 && <div className="ruler-stack">
            {ruler({ label: "Current weight", key: "weight", min: 25, max: 250, unit: weightUnit, value: draft.weight, displayValue: weightUnit === "kg" ? `${Math.round(+draft.weight * 10) / 10}` : `${Math.round(+draft.weight * 2.2046226218 * 10) / 10}`, inputStep: 0.1, tickStep: 1, onChange: (value) => setDraft((item) => ({ ...item, weight: value })), switcher: unitToggle(weightUnit, setWeightUnit, ["kg", "lbs"], "weight"), tickLabel: (mark) => weightUnit === "kg" ? mark : Math.round(mark * 2.2046226218) })}
            {ruler({ label: "Goal weight", key: "goalW", min: 25, max: 250, unit: weightUnit, value: draft.goalW, displayValue: weightUnit === "kg" ? `${Math.round(+draft.goalW * 10) / 10}` : `${Math.round(+draft.goalW * 2.2046226218 * 10) / 10}`, inputStep: 0.1, tickStep: 1, onChange: (value) => setDraft((item) => ({ ...item, goalW: value })), tickLabel: (mark) => weightUnit === "kg" ? mark : Math.round(mark * 2.2046226218) })}
          </div>}
          {step === 6 && <div className="choice-grid">
            {LEVELS.map((level, index) => <button type="button" key={level} aria-pressed={draft.plan === index} className={`choice !flex !min-h-[68px] items-center justify-between gap-3 transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2 ${draft.plan === index ? "on !border-2 !border-black shadow-[0_0_0_3px_var(--accent-muted)]" : ""}`} onClick={() => setDraft((item) => ({ ...item, plan: index }))}>
              <span className="grid gap-1 text-left"><b>{LEVEL_NAMES[level]}</b><small className="text-xs font-medium text-[var(--muted)]">{["Table and chair versions", "Floor work", "Advanced variations", "Hardest variations"][index]}</small></span><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-sm font-black transition-[background-color,border-color,color,transform] duration-200 ${draft.plan === index ? "border-black bg-black text-white scale-105" : "border-[var(--border)] bg-transparent text-transparent"}`} aria-hidden="true">✓</span>
            </button>)}
          </div>}
          <div className="row !flex-col !items-stretch !justify-end !gap-3 setup-actions">
            <button className="primary setup-next" type="submit">{nameOnly ? "Save name" : step === 6 ? "Create my plan" : "Continue"}<span aria-hidden="true">→</span></button>
            {(step > 1 || state.profile) ? <button type="button" className="!min-h-11 !self-center !bg-transparent !text-[var(--muted)] text-sm font-bold transition-colors duration-200 hover:!text-[var(--text)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2" onClick={goBack}>Go back</button> : null}
          </div>
        </form>
      </section>
      <div className="fixed left-1/2 top-[max(12px,env(safe-area-inset-top))] z-40 grid w-[min(calc(100%-28px),410px)] -translate-x-1/2 gap-2 pointer-events-none" aria-live="assertive" aria-atomic="false">
        {alerts.map((alert) => <SetupAlert key={alert.id} alert={alert} onDismiss={dismissAlert} />)}
      </div>
    </main>
  );
}


