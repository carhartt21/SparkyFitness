import geometry from "./progressionX.geometry.json" with { type: "json" };

export { geometry as progressionXGeometry };

export type ProgressValue = number | null | undefined;

/** Unknown and invalid inputs stay unknown; numeric corrections may decrease. */
export function normalizeProgress(value: ProgressValue): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, value));
}

/** Approximate cubic arc length rather than reveal by a geometric wipe. */
export function measureTrackPath(path: string): number {
  const tokens = path.match(/[MLC]|-?\d+(?:\.\d+)?/g) ?? [];
  let index = 0;
  let x = 0;
  let y = 0;
  let length = 0;
  while (index < tokens.length) {
    const command = tokens[index++];
    if (command === "M" || command === "L") {
      const nextX = Number(tokens[index++]);
      const nextY = Number(tokens[index++]);
      if (command === "L") length += Math.hypot(nextX - x, nextY - y);
      x = nextX;
      y = nextY;
    } else if (command === "C") {
      const x1 = Number(tokens[index++]);
      const y1 = Number(tokens[index++]);
      const x2 = Number(tokens[index++]);
      const y2 = Number(tokens[index++]);
      const x3 = Number(tokens[index++]);
      const y3 = Number(tokens[index++]);
      let previousX = x;
      let previousY = y;
      for (let step = 1; step <= 64; step++) {
        const t = step / 64;
        const inv = 1 - t;
        const px =
          inv ** 3 * x +
          3 * inv ** 2 * t * x1 +
          3 * inv * t ** 2 * x2 +
          t ** 3 * x3;
        const py =
          inv ** 3 * y +
          3 * inv ** 2 * t * y1 +
          3 * inv * t ** 2 * y2 +
          t ** 3 * y3;
        length += Math.hypot(px - previousX, py - previousY);
        previousX = px;
        previousY = py;
      }
      x = x3;
      y = y3;
    } else {
      throw new Error(`Unsupported progression X path command: ${command}`);
    }
  }
  return length;
}

export const progressionXSegmentLengths = geometry.segments.map((segment) =>
  measureTrackPath(segment.guide),
);

export const progressionXTotalLength = progressionXSegmentLengths.reduce(
  (sum, length) => sum + length,
  0,
);

/** One scalar spans all ordered subpaths, with each color anchored to its full path. */
export function getProgressionXReveal(value: ProgressValue): number[] {
  const progress = normalizeProgress(value);
  if (progress == null) return geometry.segments.map(() => 0);
  let remaining = (progress / 100) * progressionXTotalLength;
  return progressionXSegmentLengths.map((length) => {
    const visible = Math.min(length, Math.max(0, remaining));
    remaining -= visible;
    return visible;
  });
}
