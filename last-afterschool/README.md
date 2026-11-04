# さいごの放課後 / THE LAST AFTERSCHOOL（仮題）— Prototype ver.0.1

A pixel-art 2D battle action game about a cute girl swinging huge weapons around. The story underneath is quietly sad.

> 「世界が終わるまでの、ほんの少しの放課後。」

## How to play
- Open `index.html` in a browser. It also runs straight from `file://`.
  - BGM uses the existing tracks in the repository root (`../0X_*.mp3`) as placeholders.
  - A local server also works: `python3 -m http.server` (from the repository root) → `http://localhost:8000/last-afterschool/`
- Keyboard / gamepad / touch (landscape)

| Key | Action |
|---|---|
| ← → | Move (Shift or double-tap to dash) |
| C / Space | Jump |
| Z | Weapon attack (mash for combos; the desk greatsword chains into a spin slash) |
| X | Kick (also cancels the late part of a weapon swing) |
| V | Special: Full Swing (25 MP; your partner enlarges the weapon and you slam it down) |
| Q | Switch weapon |
| Esc / P | Pause (skips dialogue while it is showing) |
| M | Mute |

For debugging, run `Game.debugJump(n)` in the console to jump to any stage (0 = STAGE 1 … 6 = STAGE 5).

## What the prototype covers
STAGE 1–5 of the story outline (`docs/game_story_outline_v1.pdf`), playable start to finish.

| Stage | Content | Gameplay |
|---|---|---|
| 1 Everyday life | Morning walk to school. A cat, a TV news report on abnormal weather, a crepe shop, a crack in the sky | Movement only; the foreshadowing is in the scenery |
| 2 Attack on the school | Monsters in the schoolyard | Kicks only. A scripted battle you cannot win (you get surrounded) |
| 3 Meeting the partner | The partner appears and grants the power to turn objects into weapons | Baseball bat → **sand-coated bat** (medium; adds stun), tutorial |
| 4-1 School building | Chairs and desks become weapons | **Chair-leg dagger** (small, fast) / **Desk greatsword** (large; slam + burst + spin slash) |
| 4-2 Home economics room | Ghosts. The gas stove's flame is enchanted onto the weapons | **Fire enchant** (bonus damage, burn; strong against ghosts) |
| 4-3 Rooftop | Mini boss: Gareki Golem | Telegraphed slam / shockwaves / charge / rock throw, enrage, BREAK |
| 5 The three worlds | The partner explains the present world, the demon world and the divine world | Story scene with a diagram → "To be continued" |

Combat feel: hitstop, screen shake, flashes, slash arcs, the burst effect, combo counter, damage numbers and critical hits.
Growth: level and EXP (max HP and attack go up). Enemies sometimes drop a strawberry milk that restores HP (she likes sweet things).

## Layout
```
last-afterschool/
  index.html            entry point (Canvas 960x540 + touch buttons)
  src/config.js         names, weapons, enemies, stage layouts, all scenario text (balance and writing changes go here)
  src/world.js          stage runtime: camera, waves, hit detection, items, effects
  src/entities.js       player, partner, enemy AI, boss, projectiles, particles
  src/game.js           scenes (title / stage card / game over / ending), dialogue, HUD
  src/backgrounds.js    procedurally drawn parallax backgrounds (street / schoolyard / corridor / home ec room / rooftop)
  src/audio.js          BGM playback and synthesized SFX (WebAudio)
  src/input.js          keyboard, touch and gamepad input
  src/sprite_data.js    auto-generated (frame rects and foot anchors)
  assets/source/        the original concept sheets you provided
  assets/sprites/       sprites cut out of those sheets
  tools/extract_sprites.py  sprite cutting script (to re-run: `python3 -I tools/extract_sprites.py`)
  docs/                 story outline and design notes
```

The sprites are cut automatically from the provided concept sheets: the panel background is made transparent and a foot anchor is computed for each frame. When the final sprite sheets are ready, swap them in with the same filenames, or change the coordinates in `tools/extract_sprites.py`.

## Placeholders
- All names are placeholders: protagonist "Yuki", partner "Ruu", friend "Mio". Change them in `NAMES` in `src/config.js`.
- The title "さいごの放課後" is also a working title.
- BGM reuses the Lumina Monsters tracks as placeholders.
- The partner graphic uses the white winged monster from the monster sheet.

See `docs/DESIGN.md` for details.
