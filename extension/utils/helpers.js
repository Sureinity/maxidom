// API base URL
const BASE_URL = "http://127.0.0.1:8000/api";

// API endpoints
export const ENDPOINTS = {
  TRAIN: (uuid) => `${BASE_URL}/train/${uuid}`,
  SCORE: (uuid) => `${BASE_URL}/score/${uuid}`,
  ENROLL: (uuid) => `${BASE_URL}/enroll/${uuid}`,
  VERIFY_PASSWORD: (uuid) => `${BASE_URL}/verify_password/${uuid}`,
  RESET_PROFILE: (uuid) => `${BASE_URL}/reset_profile/${uuid}`,
  CHANGE_PASSWORD: (uuid) => `${BASE_URL}/profile/${uuid}/password`,
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

// Lock Management Functions
export async function getProfilingLockStatus() {
  // Defaults to FALSE (Locked) if not set
  const result = await chrome.storage.local.get("is_profiling_unlocked");
  return result.is_profiling_unlocked === true;
}

export async function setProfilingLockStatus(isUnlocked) {
  await chrome.storage.local.set({ is_profiling_unlocked: isUnlocked });
  console.log(
    `Profiling lock status set to: ${isUnlocked ? "UNLOCKED" : "LOCKED"}`,
  );
}
