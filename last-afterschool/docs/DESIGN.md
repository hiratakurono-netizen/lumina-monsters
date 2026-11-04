# Design notes (prototype ver.0.1)

## Concept
**"Isn't a cute girl swinging around a huge, flashy weapon just adorable?"**
- The more ordinary the object (bat, chair, desk), the bigger the gap when it becomes huge. That gap is where the "cute" and the "flashy" come from.
- Weapon size directly changes how combat feels.
  - S (chair-leg dagger): fast, high hit count, juggles
  - M (sand-coated bat): balanced, sand adds stun
  - L (desk greatsword): slow; the slam fills the screen with a burst, a follow-up input chains into a spin slash
- Special "Full Swing": the partner enlarges whatever weapon you are holding. The partner's power makes the weapons huge, which ties the concept into the story.

## Bringing out the sadness of the story
The PDF's theme, "keeping the world right" vs. "living with someone you care about", is foreshadowed throughout.
- STAGE 1: the abnormal-weather news and a crack in the sky slip into an ordinary morning (setting up Ending 1, where the planet slowly falls apart).
- STAGE 4-1: an empty classroom. "Yesterday we were all laughing here, like normal."
- The partner: "Why can I even do this?" hints at lost memories and the god-given origin of the power (revealed in STAGE 7).
- STAGE 5 closes on: "Will there still be school tomorrow?" / "The sunset was strangely beautiful. It would be a while before she learned it was the colour of the end."
- Visuals: a muted lavender palette overall, a tense red sky in combat stages, a dusk rooftop.

## Story → gameplay mapping (prototype scope)
| Outline | Implementation |
|---|---|
| STAGE 1 Everyday life | Walking stage. Event triggers by position (cat / TV / shop / crack in the sky) |
| STAGE 2 Attack | Kicks only. `scripted: 'overwhelm'` makes it an unwinnable fight that moves on to the next stage |
| STAGE 3 Partner | Pick up the bat item → weapon + sand element. Tutorial |
| STAGE 4 Escape | Corridor (chair / desk), home ec room (fire enchant), rooftop (mini boss) |
| STAGE 5 Three worlds | Story-only stage. A diagram of the three worlds overlays the dialogue |

## Data-driven
Stage layouts are arrays of `events` in `CHAPTERS` in `src/config.js`.
- `talk`: dialogue triggered by position
- `wave`: locks the camera and spawns waves of enemies. Clearing every wave shows GO ▶
- `item`: picking it up transforms it into a weapon or applies an enchant
- `boss`: boss fight
Adding new stages (STAGE 6 onwards, the demon world, the divine world) means adding to this array, plus a background in `backgrounds.js` and enemies in `ENEMIES`.

## Prepared for the next steps (open items from the PDF)
- Monster sheet sprites not used yet (knights, reapers, golems, wolves, skeletons, a succubus-type monster, a dragon, a castle, an eye-type demon king, and others) are already cut out under `assets/sprites/mon_*.png`. They can be used for the demon world and the demon king.
- The partner's awakening into a giant weapon (STAGE 10): `SPECIAL` can be expanded.
- The ENDING 1 / TRUE route split (the hidden story starts on the next launch): add a flag to the `localStorage` save data.
- Sprites still needed: jump, hurt, knockdown, and a portrait and sprites for the partner.

## Known issues / rough edges
- The sprites are cut out automatically, so a few frames have small transparent gaps (hair, legs) or leftover shadow.
- Some enemies are a single still image (bob and squash give them movement).
- Balance is a first pass (the boss takes about one to two minutes at Lv 4–5).
