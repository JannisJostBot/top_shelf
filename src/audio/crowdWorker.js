// Renders the crowd sounds in the background (see "rendering off the main thread" in crowd.js) and sends each one
// back as soon as it is done, the bed first since it starts playing with the first click.
import { PRERENDER } from './crowd';

for (const [key, render] of PRERENDER) {
  const [L, R] = render();
  postMessage({ key, L, R }, [L.buffer, R.buffer]);
}
