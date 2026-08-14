import {DetectionZone} from '../types';

export interface MotionAnalysis {
  percentageChanged: number;
  changedPixels: number;
  bounds: {minX: number; minY: number; maxX: number; maxY: number} | null;
}

export function analyzeMotion(
  current: Uint8ClampedArray,
  previous: Uint8ClampedArray,
  width: number,
  height: number,
  sensitivity: number,
  zone: DetectionZone,
): MotionAnalysis {
  const startX = Math.floor(zone.x * width);
  const startY = Math.floor(zone.y * height);
  const endX = Math.min(width, Math.ceil((zone.x + zone.width) * width));
  const endY = Math.min(height, Math.ceil((zone.y + zone.height) * height));
  const threshold = Math.max(10, 100 - sensitivity * 0.9);
  let changedPixels = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = (y * width + x) * 4;
      const averageDifference = (
        Math.abs(current[index] - previous[index])
        + Math.abs(current[index + 1] - previous[index + 1])
        + Math.abs(current[index + 2] - previous[index + 2])
      ) / 3;
      if (averageDifference <= threshold) continue;
      changedPixels += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  const totalPixels = Math.max(1, (endX - startX) * (endY - startY));
  return {
    percentageChanged: changedPixels / totalPixels * 100,
    changedPixels,
    bounds: changedPixels > 0 ? {minX, minY, maxX, maxY} : null,
  };
}

export function shouldTriggerMotion(
  percentageChanged: number,
  threshold: number,
  globalChangeCeiling: number,
  consecutiveFrames: number,
  requiredConsecutiveFrames: number,
): boolean {
  return percentageChanged >= threshold
    && percentageChanged < globalChangeCeiling
    && consecutiveFrames >= requiredConsecutiveFrames;
}

export interface CalibrationResult {
  threshold: number;
  /** The estimate before clamping, so a noisy scene can be reported instead of
   * quietly becoming a poor calibration. */
  rawThreshold: number;
  clamped: boolean;
}

export const MAX_CALIBRATED_THRESHOLD = 10;

export function calibratedThreshold(samples: number[], minimum = 0.5): number {
  return calibrate(samples, minimum).threshold;
}

/** Mirrors MotionMath.calibrate on the Kotlin side. */
export function calibrate(samples: number[], minimum = 0.5): CalibrationResult {
  if (samples.length === 0) return {threshold: minimum, rawThreshold: minimum, clamped: false};
  const sorted = samples.toSorted((a, b) => a - b);
  const median = medianOfSorted(sorted);
  const deviations = sorted.map(value => Math.abs(value - median)).toSorted((a, b) => a - b);
  const medianAbsoluteDeviation = medianOfSorted(deviations);
  const raw = Number((median + 6 * medianAbsoluteDeviation + 0.5).toFixed(1));
  return {
    threshold: Math.min(MAX_CALIBRATED_THRESHOLD, Math.max(minimum, raw)),
    rawThreshold: raw,
    clamped: raw > MAX_CALIBRATED_THRESHOLD,
  };
}

function medianOfSorted(values: number[]): number {
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? (values[middle - 1] + values[middle]) / 2
    : values[middle];
}
