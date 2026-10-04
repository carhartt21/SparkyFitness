# Dashboard motion evidence

All data is synthetic and confined to the existing development-simulator review host. Captures include the working-tree changes on `feat/dashboard-motion-20261004`, based on `d0dbb161b`; the base revision in runner results is not a claim that it already contained this implementation.

- [Motion recording, light](widget-transitions-light.mov): real production components in the isolated gallery, including continuous X/gauge changes, completion, correction, unknown restoration, button feedback, macro and water updates. The gallery's outer background is review scaffolding, not the production Dashboard.
- [Light completed state](light-completed.png) and [hydration](light-hydration.png).
- [Enlarged German completed state](large-completed.png) and [hydration](large-hydration.png).
- [Native Reduce Motion state](reduced-completed.png) and [hydration](reduced-hydration.png).
- `*-results.json`: case-specific render and native interaction results. All retained cases passed. OCR is a smoke check, not a visual-fidelity score.
- `dashboard-*-results.json` and `dashboard-*.png`: separate production Dashboard layout/navigation checks, with actual category destinations and whole-card taps preserved.

Failed harness startup/accessibility-query attempts were excluded. Screenshots show settled states; the video and behavioral tests verify transitions. No personal account, health data or production endpoint is used. Physical-device frame rates, Android, live persistence, Watch hosting and VoiceOver speech timing remain separate checks.
