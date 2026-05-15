/**
 * Wraps a promise with a timeout so UI never hangs on stuck network/DB calls.
 */
export function queryWithTimeout(promise, ms = 12000, label = 'Request') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}
