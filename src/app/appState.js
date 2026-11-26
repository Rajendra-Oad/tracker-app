export const STORAGE_KEY = "bw-tracker-v2";
export const LEGACY_STORAGE_KEY = "bw-tracker-v1";
export const STORAGE_VERSION = 2;

export const defaultState = {
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

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaultState;
    if (Number.isInteger(parsed._version) && parsed._version > STORAGE_VERSION) return defaultState;
    const profileStep = Number.isInteger(parsed.profileStep) ? Math.min(6, Math.max(1, parsed.profileStep)) : 1;
    const profileDraft = parsed.profileDraft && typeof parsed.profileDraft === "object" && !Array.isArray(parsed.profileDraft) ? parsed.profileDraft : null;
    return { ...defaultState, ...parsed, profileStep, profileDraft };
  } catch {
    return defaultState;
  }
}
