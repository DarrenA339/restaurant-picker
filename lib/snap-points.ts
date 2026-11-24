/** A flick: faster than this (px per ms) at release goes to the next point instead of the nearest. */
export const FLICK_VELOCITY = 0.4;

/**
 * Where a dragged sheet lands. `points` are heights in ascending order,
 * `height` is where it was let go, and `velocityUp` is the release speed in
 * px/ms (positive grows the sheet). A flick goes to the next point in its
 * direction; anything slower goes to the nearest point.
 */
export function releasePoint(height: number, velocityUp: number, points: readonly number[]): number {
  if (points.length === 0) return height;
  if (velocityUp > FLICK_VELOCITY) return points.find((p) => p > height + 1) ?? points[points.length - 1];
  if (velocityUp < -FLICK_VELOCITY) return points.findLast((p) => p < height - 1) ?? points[0];
  return points.reduce((best, p) => (Math.abs(p - height) < Math.abs(best - height) ? p : best));
}
