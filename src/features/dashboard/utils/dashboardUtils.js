import { EXERCISES } from "../../../data/training";

export const BODY_PARTS = [
  { name: "Chest", keywords: ["chest", "pectoral"] },
  { name: "Back", keywords: ["back", "lat", "trap"] },
  { name: "Shoulders", keywords: ["shoulder", "deltoid"] },
  { name: "Arms", keywords: ["bicep", "tricep", "forearm", "arm"] },
  { name: "Core", keywords: ["core", "abs", "oblique", "hip flexor"] },
  { name: "Legs", keywords: ["quad", "glute", "hamstring", "calf", "leg"] },
];

export const LEVEL_NAMES = { A: "Beginner", B: "Intermediate", C: "Advanced", D: "Ultra" };

export function startOfWeek(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return value;
}

export function dateKey(date) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function matchesBodyPart(part, muscle) {
  const value = muscle.toLowerCase();
  return part.keywords.some((keyword) => value.includes(keyword));
}

export function exercisesForBodyPart(part) {
  return EXERCISES.map((exercise, index) => ({ exercise, index }))
    .filter(({ exercise }) => exercise.muscles.some((muscle) => matchesBodyPart(part, muscle)));
}

export function getWeekNumber(startedAt) {
  const start = startOfWeek(startedAt);
  const current = startOfWeek(new Date());
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const currentUtc = Date.UTC(current.getFullYear(), current.getMonth(), current.getDate());
  return Math.max(1, Math.floor((currentUtc - startUtc) / 604800000) + 1);
}

export function getSuggestedDay(index, target) {
  const daySets = { 3: [0, 2, 4], 4: [0, 2, 4, 6], 5: [0, 1, 3, 5, 6], 6: [0, 1, 2, 4, 5, 6] };
  return (daySets[target] || daySets[3])[index] ?? 6;
}

export function getGreeting(name) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = name?.trim().split(/\s+/)[0];
  const normalizedName = firstName ? `${firstName.charAt(0).toUpperCase()}${firstName.slice(1).toLowerCase()}` : "";
  return normalizedName ? `${greeting}, ${normalizedName}` : greeting;
}

export function formatElapsedTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
