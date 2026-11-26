const CRITICAL_ASSETS = [
  { url: "/models/push-up.glb", label: "Tuning your training space" },
];

const PRELOAD_CACHE_KEY = "htf:critical-assets:v1";

export function hasCachedCriticalAssets() {
  try {
    return window.localStorage.getItem(PRELOAD_CACHE_KEY) === "ready";
  } catch {
    return false;
  }
}

function cacheAssets() {
  try {
    window.localStorage.setItem(PRELOAD_CACHE_KEY, "ready");
  } catch {
    // Storage may be unavailable in private browsing or restricted webviews.
  }
}

export async function preloadCriticalAssets(onProgress, onStatus) {
  if (hasCachedCriticalAssets()) {
    onStatus?.("Your training space is ready");
    onProgress?.(100);
    return { failures: [], cached: true };
  }

  let completed = 0;
  const failures = [];
  onProgress?.(0);

  await Promise.all(CRITICAL_ASSETS.map(async ({ url, label }) => {
    onStatus?.(label);
    try {
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) throw new Error(`Asset request failed: ${response.status}`);
      const total = Number(response.headers.get("content-length")) || 0;
      let loaded = 0;
      if (response.body && total) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          loaded += value.byteLength;
          onProgress?.(Math.min(98, (loaded / total) * 100));
        }
      } else {
        await response.arrayBuffer();
      }
      completed += 1;
      onProgress?.((completed / CRITICAL_ASSETS.length) * 100);
    } catch (error) {
      failures.push({ url, error });
      completed += 1;
      onProgress?.((completed / CRITICAL_ASSETS.length) * 100);
    }
  }));

  if (!failures.length) cacheAssets();
  return { failures, cached: false };
}
