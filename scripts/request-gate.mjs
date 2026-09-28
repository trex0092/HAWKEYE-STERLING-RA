/* Shared request gate for public endpoints with per-IP rate limits.
   It caps concurrent in-flight calls and spaces request starts across all callers
   in the process. This matters when the screening engine runs many subjects in
   parallel: per-subject concurrency alone multiplies into a large host-level
   burst and trips public API throttles. */

export function createRequestGate({ concurrency = 1, minIntervalMs = 0 } = {}) {
  const width = Math.max(1, Math.floor(Number(concurrency) || 1));
  const spacing = Math.max(0, Math.floor(Number(minIntervalMs) || 0));
  const queue = [];
  let active = 0;
  let nextStartAt = 0;
  let timer = null;

  const pump = () => {
    if (active >= width || !queue.length) return;

    const wait = Math.max(0, nextStartAt - Date.now());
    if (wait > 0) {
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          pump();
        }, wait);
      }
      return;
    }

    const job = queue.shift();
    active++;
    nextStartAt = Date.now() + spacing;

    Promise.resolve()
      .then(job.fn)
      .then(job.resolve, job.reject)
      .finally(() => {
        active--;
        pump();
      });

    if (active < width) pump();
  };

  return function run(fn) {
    if (typeof fn !== 'function') return Promise.reject(new TypeError('request gate requires a function'));
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      pump();
    });
  };
}
