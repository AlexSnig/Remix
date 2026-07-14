import {describe, expect, it} from 'vitest';
import {analyzeMotion, calibratedThreshold, shouldTriggerMotion} from './motionDetection';
import {DEFAULT_DETECTION_ZONE} from './settings';

const frame = (pixels: number[]) => new Uint8ClampedArray(pixels.flatMap(value => [value, value, value, 255]));

describe('motion detection', () => {
  it('reports no change for identical frames', () => {
    const data = frame([10, 10, 10, 10]);
    expect(analyzeMotion(data, data, 2, 2, 70, DEFAULT_DETECTION_ZONE)).toEqual({
      percentageChanged: 0,
      changedPixels: 0,
      bounds: null,
    });
  });

  it('measures local motion and respects the detection zone', () => {
    const previous = frame([0, 0, 0, 0]);
    const current = frame([255, 0, 0, 0]);
    const full = analyzeMotion(current, previous, 2, 2, 70, DEFAULT_DETECTION_ZONE);
    const excluded = analyzeMotion(current, previous, 2, 2, 70, {x: 0.5, y: 0, width: 0.5, height: 1});
    expect(full.percentageChanged).toBe(25);
    expect(full.bounds).toEqual({minX: 0, minY: 0, maxX: 0, maxY: 0});
    expect(excluded.percentageChanged).toBe(0);
  });

  it('requires consecutive frames and rejects global lighting changes', () => {
    expect(shouldTriggerMotion(5, 1.5, 70, 1, 2)).toBe(false);
    expect(shouldTriggerMotion(5, 1.5, 70, 2, 2)).toBe(true);
    expect(shouldTriggerMotion(80, 1.5, 70, 2, 2)).toBe(false);
    expect(shouldTriggerMotion(1, 1.5, 70, 2, 2)).toBe(false);
  });

  it('derives a stable threshold from the 95th percentile', () => {
    expect(calibratedThreshold([])).toBe(0.5);
    expect(calibratedThreshold([0.1, 0.2, 0.3, 0.4, 2])).toBe(2.5);
    expect(calibratedThreshold([100])).toBe(25);
  });
});
