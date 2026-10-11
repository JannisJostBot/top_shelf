// A tiny synchronous event bus. The simulation (game/) announces what happened, such as a sound to play, a banner
// to show or a camera cut, and the presentation (render/, audio/, ui/) subscribes. Handlers run immediately and
// in the order they were added, so an emit behaves exactly like the direct call it replaces. With nothing
// subscribed (in tests, or a headless run) the simulation still runs, it just shows and plays nothing.
type Handler = (...args: any[]) => void;
const handlers = new Map<string, Handler[]>();

/** Subscribes `fn` to `name`; returns a function that unsubscribes it again. */
export function on(name: string, fn: Handler): () => void {
  const list = handlers.get(name) || [];
  list.push(fn);
  handlers.set(name, list);
  return () => {
    const l = handlers.get(name);
    if (l) l.splice(l.indexOf(fn) >>> 0, 1);
  };
}
export function emit(name: string, ...args: any[]): void {
  const list = handlers.get(name);
  if (list) for (const fn of list) fn(...args);
}
/** Drops every subscription (for tests). */
export function clearEvents(): void {
  handlers.clear();
}
