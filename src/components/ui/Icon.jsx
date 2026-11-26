export function Icon({ name, size = 20 }) {
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
    plus: <><path d="M12 5v14M5 12h14" /></>,
    down: <path d="m5 9 7 7 7-7" />,
    slow: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || null}</svg>;
}
