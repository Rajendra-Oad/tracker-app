import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

const STEPS = ["Reading your goals", "Shaping your routine", "Choosing your exercises", "Balancing your week", "Finishing your plan"];

export function PlanGenerationScreen({ onFinished }) {
  const [completed, setCompleted] = useState(0);
  const [ready, setReady] = useState(false);
  const startedAt = useRef(performance.now());
  const brandRef = useRef(null);
  const contentRef = useRef(null);
  const stepsRef = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => setCompleted((value) => Math.min(STEPS.length, value + 1)), 1400);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (completed !== STEPS.length) return undefined;
    const timer = window.setTimeout(() => setReady(true), 300);
    return () => window.clearTimeout(timer);
  }, [completed]);

  useEffect(() => {
    if (!ready) return undefined;
    const rows = stepsRef.current ? [...stepsRef.current.children] : [];
    const heading = contentRef.current ? [...contentRef.current.children].slice(0, 2) : [];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeline = gsap.timeline();
    timeline.to(rows, { opacity: 0, y: reducedMotion ? 0 : 24, duration: reducedMotion ? 0.01 : 0.42, stagger: reducedMotion ? 0 : 0.12, ease: "power2.in" });
    timeline.to(heading, { opacity: 0, y: reducedMotion ? 0 : 22, duration: reducedMotion ? 0.01 : 0.38, stagger: reducedMotion ? 0 : 0.1, ease: "power2.in" }, reducedMotion ? "+=0" : "-=0.08");
    timeline.to(brandRef.current, { scale: 1.22, duration: reducedMotion ? 0.01 : 0.7, ease: "power2.out" }, reducedMotion ? "+=0" : "-=0.18");
    const remaining = Math.max(0, 10000 - (performance.now() - startedAt.current));
    const timer = window.setTimeout(onFinished, remaining);
    return () => {
      window.clearTimeout(timer);
      timeline.kill();
    };
  }, [ready, onFinished]);

  useEffect(() => {
    if (!completed || !stepsRef.current) return undefined;
    const row = stepsRef.current.children[completed - 1];
    if (!row) return undefined;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tween = gsap.fromTo(row, { opacity: reducedMotion ? 1 : 0.25, y: reducedMotion ? 0 : -12 }, { opacity: 1, y: 0, duration: reducedMotion ? 0.01 : 0.5, ease: "power2.out" });
    return () => tween.kill();
  }, [completed]);

  return (
    <main className={`plan-generation ${ready ? "is-ready" : ""}`} aria-live="polite">
      <div ref={brandRef} className="plan-generation-brand">HTF</div>
      <div ref={contentRef} className="plan-generation-content" aria-hidden={ready}>
        <span className="plan-generation-kicker">Personalized for you</span>
        <h1>Creating your plan</h1>
        <div ref={stepsRef} className="plan-generation-steps" aria-label="Plan creation progress">
          {STEPS.map((step, index) => (
            <div className={index < completed ? "done" : index === completed ? "active" : "pending"} key={step}>
              <i aria-hidden="true">{index < completed ? "✓" : ""}</i>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
