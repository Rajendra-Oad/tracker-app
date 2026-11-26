export function HTFPreloader({ progress = 0, status = "Preparing your experience" }) {
  return (
    <main className="htf-preloader" aria-live="polite" aria-busy="true">
      <div className="htf-preloader-brand">
        <strong>HTF</strong>
        <span />
      </div>
      <div className="htf-preloader-copy">
        <span>{status}</span>
        <div className="htf-preloader-track" role="progressbar" aria-label="Loading HTF" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress)}><i style={{ width: `${Math.max(8, progress)}%` }} /></div>
        <small>{Math.round(progress)}%</small>
      </div>
    </main>
  );
}
