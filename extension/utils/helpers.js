// API base URL
const BASE_URL = "http://localhost:8000/api";

// API endpoints
export const ENDPOINTS = {
  TRAIN: (uuid) => `${BASE_URL}/train/${uuid}`,
  SCORE: (uuid) => `${BASE_URL}/score/${uuid}`,
  ENROLL: (uuid) => `${BASE_URL}/enroll/${uuid}`,
  VERIFY_PASSWORD: (uuid) => `${BASE_URL}/verify_password/${uuid}`,
  CHANGE_PASSWORD: (uuid) => `${BASE_URL}/change_password/${uuid}`,
  RESET_PROFILE: (uuid) => `${BASE_URL}/reset_profile/${uuid}`,
};

// Storage Getters
export async function getProfileUUID() {
  const result = await chrome.storage.local.get("profile_uuid");
  return result.profile_uuid;
}

export async function getSystemState() {
  const result = await chrome.storage.local.get("system_state");
  return result.system_state || "enrollment";
}

// Storage Setters
export async function setSystemState(newState) {
  await chrome.storage.local.set({ system_state: newState });
  console.log(`System state set to: ${newState}`);
}

// Store the detailed progress object from the backend
export async function setProfilingProgress(progress) {
  await chrome.storage.local.set({ profiling_progress: progress });
}

// Clear the profiling progress on reset.
export async function clearProfilingProgress() {
  await chrome.storage.local.remove("profiling_progress");
  console.log("Profiling progress has been cleared.");
}
