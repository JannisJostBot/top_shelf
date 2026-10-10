// Typed as `any` until the UI modules move to TypeScript; narrow at call sites when converting them.
export const $ = (id: string): any => document.getElementById(id);
