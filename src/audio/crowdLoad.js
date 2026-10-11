// Starts rendering the crowd sounds in a worker as soon as the page loads, so the game never stalls to make them.
// Where workers are not available, each sound is rendered the first time it is needed instead.
import { acceptRaw, hasSound } from './crowd';

const waiting = new Map(); // key -> callbacks waiting for those samples
let worker = null;
try {
  if (typeof Worker !== 'undefined') {
    worker = new Worker(new URL('./crowdWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = e => {
      const { key, L, R } = e.data;
      acceptRaw(key, L, R);
      for (const cb of waiting.get(key) || []) cb();
      waiting.delete(key);
    };
    worker.onerror = () => flush();
  }
} catch (e) {
  worker = null;
}
/** The worker failed: whoever is waiting renders their sound on the spot. */
function flush() {
  worker = null;
  for (const cbs of waiting.values()) for (const cb of cbs) cb();
  waiting.clear();
}
/** Calls cb once the samples for `key` are at hand (right away if they are, or if there is no worker). */
export function whenSound(key, cb) {
  if (!worker || hasSound(key)) return cb();
  if (!waiting.has(key)) waiting.set(key, []);
  waiting.get(key).push(cb);
}
