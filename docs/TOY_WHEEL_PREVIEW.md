# Toy wheel preview

Visit `/wheel-toy-preview/`. This isolated route leaves all existing routes unchanged.

Twenty equal phrase sectors are a visual suspense device. The student is chosen independently and uniformly from the entire eligible class with crypto rejection sampling; the independently chosen sector decelerates beneath the fixed pointer, then flips to the same student shown at right. No fake student names are placed around the wheel.

No-repeat history is per open document and per class/roster, matching the main app's session semantics. Reload starts a fresh round; class switches retain the current document's round; roster changes invalidate it. Only a completed draw counts. The preview reads an initial local class snapshot but stores its changes in `toy-wheel-preview:` keys and never uploads rosters. Fresh visitors see explicitly labeled example students only.

The user-provided sound plays naturally in full (6.687 seconds). The animation follows decoded media duration, falling back to 6687 ms if unavailable. Local Chinese speech starts after sound completion and the sector reveal; no remote voice fallback is allowed. Cancel/new draw/class switch/page hide stop sound and speech. The mute button disables both.

Timer offers 1–10 minutes, default 2; start/restart, stop on a new draw; duration changes apply only to the next start. Fullscreen uses the browser API. The layout adapts to portrait screens; 16:9 is the intended classroom display.

Validation: `node tests/wheel-toy-preview.mjs`, `npm test`, `npm run build`. Browser visual QA is performed against the deployed isolated route because the current local server and browser do not share a reachable network namespace.

## Layout refinement

The decorative phrases are all exactly four Chinese characters, painted with one font size/weight and a shared radial baseline/radius. The phrase is rendered as one string rather than individually wrapped glyphs. Left-facing baselines are flipped as a group to stay readable. The selected name may be inset and compressed to fit safely below the pointer.

The pedestal is removed. Wheel diameter follows the actual free height above the controls (observed with ResizeObserver). The main page's footer markup and original stylesheet are reused within a CSS scope in `shared-controls.css`, keeping existing routes unchanged. Container height is content-driven to avoid wasting drawing space. Main button/control sizes and labels are inherited, not recreated as a toy-style pill panel. Only class selection is shown in the preview dialog; its link opens the established roster manager. Theme buttons return to the established main views.
