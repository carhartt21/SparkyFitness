# Wellness navigation evidence

Synthetic simulator data only. More → Wellness supports presets, custom activity
names, the selected calendar day and 30-day history; Diary shows recorded entries
with undo and no creation controls. PNGs are resized to logical viewport widths.

German dark and light: 390×844. Largest Dynamic Type in dark: 430×932.
Each case tests logging from More, expanding history, returning to Diary,
absence of creation controls, and removal from that day. Native interactions use
a gated in-memory fixture; they do not establish real-server persistence or
physical-device behavior.

The dark and enlarged-text cases confirm the final full-width More tile. The
light captures retain the first-pass logging/Diary screens; those screens were
unchanged by the final tile correction. The early half-width light More capture
is intentionally omitted. Unrelated pre-existing Diary summary rings and older
More tiles crowd/truncate at the largest text size; this narrow change does not
claim those surfaces pass a whole-app accessibility audit.
