/** Prefixed, timestamped server-side logging so pipeline progress is visible in the `npm run dev` terminal. */
export function serverLog(label: string, data?: unknown) {
  const time = new Date().toISOString().slice(11, 23);
  if (data !== undefined) {
    console.log(`[VedaAI ${time}] ${label}`, data);
  } else {
    console.log(`[VedaAI ${time}] ${label}`);
  }
}

/** Wraps an async step with start/done/failed logs and timing, for one route handler. */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  serverLog(`${label}: started`);
  try {
    const result = await fn();
    serverLog(`${label}: done in ${Date.now() - start}ms`);
    return result;
  } catch (err) {
    serverLog(`${label}: FAILED after ${Date.now() - start}ms`, err instanceof Error ? err.message : err);
    throw err;
  }
}
