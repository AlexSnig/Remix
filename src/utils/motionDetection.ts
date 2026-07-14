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

export function calibratedThreshold(samples: number[], minimum = 0.5): number {
  if (samples.length === 0) return minimum;
  const sorted = samples.toSorted((a, b) => a - b);
  const percentileIndex = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return Math.min(25, Math.max(minimum, Number((sorted[percentileIndex] + 0.5).toFixed(1))));
}
