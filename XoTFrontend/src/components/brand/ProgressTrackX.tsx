import { useEffect, useId, useRef, useState } from 'react';
import {
  getProgressionXReveal,
  normalizeProgress,
  progressionXGeometry,
  progressionXSegmentLengths,
  type ProgressValue,
} from '@workspace/shared';

interface ProgressTrackXProps {
  progress: ProgressValue;
  label: string;
  unknownLabel: string;
  size?: number;
  light?: boolean;
  showValue?: boolean;
}

export default function ProgressTrackX({
  progress,
  label,
  unknownLabel,
  size = 120,
  light = false,
  showValue = true,
}: ProgressTrackXProps) {
  const target = normalizeProgress(progress);
  const [rendered, setRendered] = useState({ target, value: target ?? 0 });
  const current = useRef(target ?? 0);
  const instanceId = useId().replace(/:/g, '');

  // A genuine unknown interval starts a fresh visual track. React applies
  // this guarded state adjustment before committing the unknown render, so a
  // later known value cannot briefly show the prior session's percentage.
  if (target == null && rendered.target != null) {
    setRendered({ target: null, value: 0 });
  }

  useEffect(() => {
    if (target == null) {
      current.current = 0;
      return;
    }
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    if (reduced) {
      const frame = requestAnimationFrame(() => {
        current.current = target;
        setRendered({ target, value: target });
      });
      return () => cancelAnimationFrame(frame);
    }
    let frame = 0;
    const start = current.current;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const fraction = Math.min(1, (now - startedAt) / 480);
      const eased = 1 - (1 - fraction) ** 3;
      const next = start + (target - start) * eased;
      current.current = next;
      setRendered({ target, value: next });
      if (fraction < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  const visibleProgress =
    target == null ? null : rendered.target == null ? 0 : rendered.value;
  const visible = getProgressionXReveal(visibleProgress);
  const valueText =
    visibleProgress == null ? unknownLabel : `${Math.round(visibleProgress)}%`;
  const baseline = light
    ? progressionXGeometry.baselineLight
    : progressionXGeometry.baselineDark;

  return (
    <span
      className="inline-flex flex-col items-center gap-1"
      role="img"
      aria-label={`${label}: ${valueText}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={progressionXGeometry.viewBox}
        aria-hidden="true"
      >
        <defs>
          {progressionXGeometry.segments.map((segment, index) => (
            <g key={segment.id}>
              <linearGradient
                id={`${instanceId}-gradient-${index}`}
                x1={segment.gradient.x1}
                y1={segment.gradient.y1}
                x2={segment.gradient.x2}
                y2={segment.gradient.y2}
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor={segment.gradient.from} />
                <stop offset="1" stopColor={segment.gradient.to} />
              </linearGradient>
              <mask
                id={`${instanceId}-mask-${index}`}
                maskUnits="userSpaceOnUse"
                x="0"
                y="0"
                width="320"
                height="320"
              >
                <path
                  d={segment.guide}
                  fill="none"
                  stroke="white"
                  strokeWidth={segment.revealWidth}
                  strokeLinecap="round"
                  strokeDasharray={`${visible[index] ?? 0} ${(progressionXSegmentLengths[index] ?? 0) + 1}`}
                />
              </mask>
            </g>
          ))}
        </defs>
        <g opacity={visibleProgress == null ? 0.62 : 1}>
          {progressionXGeometry.segments.map((segment) =>
            segment.kind === 'stroke' ? (
              <g key={`base-${segment.id}`}>
                <path
                  d={segment.path}
                  fill="none"
                  stroke={baseline}
                  strokeWidth={segment.strokeWidth}
                  strokeLinecap={
                    'linecap' in segment && segment.linecap === 'butt'
                      ? 'butt'
                      : 'round'
                  }
                  strokeLinejoin="round"
                />
                {'taperPath' in segment && (
                  <path d={segment.taperPath} fill={baseline} />
                )}
              </g>
            ) : (
              <path
                key={`base-${segment.id}`}
                d={segment.path}
                fill={baseline}
              />
            )
          )}
          {visibleProgress != null &&
            progressionXGeometry.segments.map((segment, index) => {
              if ((visible[index] ?? 0) <= 0) return null;
              const fill = `url(#${instanceId}-gradient-${index})`;
              const mask =
                visibleProgress >= 100
                  ? undefined
                  : `url(#${instanceId}-mask-${index})`;
              return segment.kind === 'stroke' ? (
                <g key={`active-${segment.id}`} mask={mask}>
                  <path
                    d={segment.path}
                    fill="none"
                    stroke={fill}
                    strokeWidth={segment.strokeWidth}
                    strokeLinecap={
                      'linecap' in segment && segment.linecap === 'butt'
                        ? 'butt'
                        : 'round'
                    }
                    strokeLinejoin="round"
                  />
                  {'taperPath' in segment && (
                    <path d={segment.taperPath} fill={fill} />
                  )}
                </g>
              ) : (
                <path
                  key={`active-${segment.id}`}
                  d={segment.path}
                  fill={fill}
                  mask={mask}
                />
              );
            })}
        </g>
      </svg>
      {showValue && (
        <span
          className="text-xs tabular-nums text-muted-foreground"
          aria-hidden="true"
        >
          {valueText}
        </span>
      )}
    </span>
  );
}
