/**
 * Prevents the same site from being tested twice at the same time (double click on "Test Now",
 * "Run All" overlapping a single test, a cron call overlapping a manual one). Every real test
 * submits a real form and sends real emails, so an accidental duplicate run is never harmless.
 *
 * In-memory: it protects a single running server process, which is how this app is run.
 */
const running = new Set<string>();

export function tryAcquireSiteRun(siteId: string): boolean {
  if (running.has(siteId)) return false;
  running.add(siteId);
  return true;
}

export function releaseSiteRun(siteId: string): void {
  running.delete(siteId);
}
