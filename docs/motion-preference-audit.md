# OS-independent animation audit

The app always uses its existing full-motion presentation. It no longer reads or subscribes to the operating system's reduced-motion preference. This does not change the operating system setting.

## Audited runtime scope

On base `bcbd6ab3bf2fd00e1bf3ff1a9fa7a6e70aa65b11`, `src/` contains the root three-theme app and the independent `orbit-preview/`. Each has six affected files:

- `space-card-model.js`: remove frozen idle time and its unused motion setter/state. In orbit, also remove sphere suppression, dim-only draw substitution, and instant result reveal.
- `space-meteors.js`: always sample the original shared timeline.
- `space-cards.js`: remove preference query, listener, and unused debug state.
- `paper-cards.js`: remove preference query/listener/debug state. In orbit, also restore the original result flip and paint-cache progression.
- `scene.js`: retain the existing 1500 ms board camera flight and resize refit under either preference.
- `style.css`: remove the global transition/scroll override.

No speed, easing, geometry, colors, draw deadlines, adaptive resolution, visibility suspension, audio, or winner selection was changed. `space-audio-preview/` and `wheel-toy-preview/` are not present on this base; unpublished/other-branch previews must be audited separately rather than imported wholesale.

## Regression coverage

The all-source audit rejects reduced-motion queries and dead state in every first-party JS/CSS/HTML source, including future preview directories. The root host tests start with both preference values and switch them live while exercising idle cards, sphere draw, paper flip, classroom camera, cancellation, and countdown takeover. Orbit tests use both preference values, check full sphere geometry and original-card result continuity, and cover 1–128 students. Meteor tests verify clock advancement and rendering on Canvas and the WebGL fixture. Camera takeover tests now require the same smooth flight with the OS preference enabled. Existing static fingerprints and approved asset/source manifests are explicitly refreshed for these reviewed changes.

These tests execute deterministic DOM, projection, Canvas and renderer fixtures, not visual browser/GPU inspection. The existing delayed-first-RAF behavior after the draw deadline is characterized and intentionally unchanged.
