# Top Shelf: notes for working on this repo

See README.md for commands, layout and conventions.

## Keep the player-facing docs in step with the game

Whenever a change adds, removes or changes something a player can notice (a mechanic, a number such as a
timer, speed or chance, a control, a setting, a mode, a menu page), update the docs that describe it in the
same change:

- **Guide** (`index.html`, section `#p-guide`): how the game works. Check the paragraph that covers the topic
  still matches the code; add a section for anything new.
- **Keys** (`index.html`, section `#p-help`, plus `src/ui/keyhint.js` for the keyboard and controller maps and
  the in-match hints): every control and what it does in each situation.
- **Side panel controls** (`src/ui/side.js`) and the touch button labels (`src/ui/pad.js`) if controls change.
- **README.md** if the layout (new folders or modules) or the commands change.

Before finishing, read the affected guide paragraphs against the code, so numbers in the text match the
constants they describe.
