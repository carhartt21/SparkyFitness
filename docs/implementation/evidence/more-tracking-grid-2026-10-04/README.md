# More tracking grid evidence

Final native Simulator screenshots use synthetic data only:

- [390-point German dark](390-de-dark.png).
- [390-point German light](390-de-light.png).
- [430-point German accessibility-extra-large](430-de-large.png).
- [Runner results](results.json): all three render and wellness interaction cases passed.

The runner revision names the parent commit; captures include the uncommitted
More grid changes on `fix/more-tracking-grid-20261004`. The large-text capture
shows the last two full-width rows after scrolling, while normal text shows the
four paired rows. Native assertions check widths, row separation, horizontal
bounds and 44-point targets. The existing tour also logs and undoes a dated
wellness entry against an in-memory fixture. Mobility navigation retains its
existing route; this tour does not exercise the mobility runner or server sync.
Physical-device and Android checks were not performed.
