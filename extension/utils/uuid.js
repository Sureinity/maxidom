// Generates UUID for browser profile.
// Used by service-worker.js on every installation.

export function generateUUID() {
  return crypto.randomUUID();
}
