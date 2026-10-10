# Blue Line Blitz

3-on-3 pixel-art arcade hockey for the browser: Canvas 2D rendering, synthesized Web Audio, keyboard/mouse/touch controls.

## Commands

```bash
npm install
npm run dev        # dev server with hot reload (http://localhost:5173)
npm run build      # static build into dist/ (deployable anywhere)
npm run preview    # serve the production build
npm test           # unit tests (Vitest)
npm run typecheck  # TypeScript check
npm run format     # Prettier
```

## Layout

```
index.html            markup: HUD, stage, touch pad, menus
src/
  main.js             bootstrap: wires listeners, applies saved prefs, starts the loop
  config.ts           world size, rink/net geometry, physics constants
  settings.ts         user options (difficulty, jerseys, arena, toggles)
  core/               loop, math helpers, clock, DOM helper, localStorage
  data/               pure tables: teams/colors, pucks, stadiums, difficulty, roster names
  game/               simulation
    world.js          G (game state), puck, referee, particles, replay buffer
    players.js        player factory + roster generation
    kit.js            active team colors/palettes and puck style
    physics/          rink & net collisions, steering, integration
    ai/               team tactics, goalies, referee
    states/           faceoff, celebrate, brawl, zamboni
    match.js          start/end game, goals, periods, pause
    practice.js       training modes
    update.js         per-tick state dispatch
  render/             canvas drawing: sprites, ice, stands, players, puck, effects, mode-7 replay cam
  audio/              Web Audio engine, procedural skate sounds, synth voices, SFX table, goal songs
  input/              shared input state + keyboard, mouse, touch, haptics
  ui/                 DOM UI: HUD, menu, customization, player card, touch pad
  styles/             CSS split by area
tests/                Vitest specs
```

## Conventions

- **Shared mutable state lives in objects**, because ES module imports are read-only:
  `G` (match state), `settings`, `view` (canvas context, size, zoom), `kit`, `clock`, `mixer`, `touchState`.
  To change one from another module, assign the property (`view.camZ = 2`).
- **Modules only declare things at load time.** Event listeners are registered in `init*()` functions that `main.js` calls in order.
- **TypeScript is adopted gradually.** `allowJs` is on, so convert a module by renaming it to `.ts` and adding types. Start with leaf modules (`data/`, `game/physics/`), then work up.

## Next refactoring steps

1. Decouple simulation from presentation: `game/` currently calls into `render/`, `audio/` and `ui/` directly (e.g. `S('steal')`, `banner(...)`). An event emitter would let the simulation run headless and be unit-tested.
2. Pass `ctx` explicitly to draw functions instead of swapping `view.ctx` (done today in `ui/preview.js` and `render/mode7.js`).
3. Use a seeded RNG so replays and AI tests are deterministic.
