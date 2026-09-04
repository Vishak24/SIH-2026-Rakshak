import { useState, useEffect, useRef } from 'react';

/**
 * Hook to animate a numeric value with a smooth tween.
 * Cancels and replaces in-flight animations when a new target arrives (e.g. 3s poller ticks),
 * avoiding queued or overlapping animations.
 *
 * @param targetValue The target number to animate towards (or null if empty/unknown)
 * @param durationMs Duration of the animation in ms (default 300ms)
 * @returns The currently interpolated number (or null if targetValue is null)
 */
export function useAnimatedNumber(
  targetValue: number | null | undefined,
  durationMs = 300
): number | null {
  const [displayValue, setDisplayValue] = useState<number | null>(
    targetValue ?? null
  );

  const currentValRef = useRef<number | null>(targetValue ?? null);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValRef = useRef<number | null>(targetValue ?? null);

  useEffect(() => {
    if (targetValue === null || targetValue === undefined || isNaN(targetValue)) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      currentValRef.current = null;
      setDisplayValue(null);
      return;
    }

    // First time receiving a valid value
    if (currentValRef.current === null) {
      currentValRef.current = targetValue;
      setDisplayValue(targetValue);
      return;
    }

    // If target equals current value, no animation needed
    if (currentValRef.current === targetValue) {
      return;
    }

    // Cancel any in-flight animation to prevent stacking
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    const fromVal = currentValRef.current;
    const toVal = targetValue;
    startTimeRef.current = performance.now();
    startValRef.current = fromVal;

    const step = (now: number) => {
      const elapsed = now - (startTimeRef.current ?? now);
      const progress = Math.min(elapsed / durationMs, 1);

      // Ease-out quad interpolation: 1 - (1 - t)^2
      const ease = 1 - (1 - progress) * (1 - progress);
      const interpolated = fromVal + (toVal - fromVal) * ease;

      currentValRef.current = interpolated;
      setDisplayValue(interpolated);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        currentValRef.current = toVal;
        setDisplayValue(toVal);
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [targetValue, durationMs]);

  return displayValue;
}
