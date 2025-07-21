// Helper functions & configs used by service_worker.

// API base URL
const BASE_URL = "http://127.0.0.1:8000/api";

// API endpoints
export const ENDPOINTS = {
  TRAIN: (uuid) => `${BASE_URL}/train/${uuid}`,
  SCORE: (uuid) => `${BASE_URL}/score/${uuid}`,
};

// Get the UUID from storage
export async function getProfileUUID() {
  const result = await chrome.storage.local.get("profile_uuid");
  return result.profile_uuid;
}

// Get the current system state
export async function getSystemState() {
  const result = await chrome.storage.local.get("system_state");
  return result.system_state || "profiling"; // Default to profiling if not set
}

// Get the count of samples collected so far
export async function getSampleCount() {
  const result = await chrome.storage.local.get("sample_count");
  return result.sample_count || 0;
}

// Check if model is trained
export async function getModelStatus() {
  const result = await chrome.storage.local.get("model_trained");
  return result.model_trained || false;
}

// Update the sample count based on backend response
export async function updateSampleCount(count) {
  await chrome.storage.local.set({ sample_count: count });
  console.log(`Sample count updated to ${count}`);
  return count;
}

// Update model status
export async function updateModelStatus(status) {
  await chrome.storage.local.set({ model_trained: status });
  console.log(`Model status updated to ${status}`);
  return status;
}
