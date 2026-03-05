export interface Point {
  x: number;
  y: number;
}

export function getManeuverAnimationDurationMs(pathSegmentCount: number): number {
  return Math.max(700, Math.min(1400, 700 + 120 * Math.max(0, pathSegmentCount - 1)));
}

export function interpolatePointAlongPath(points: Point[], progress: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  const clampedProgress = Math.max(0, Math.min(1, progress));
  const segmentLengths: number[] = [];
  let totalLength = 0;

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    segmentLengths.push(length);
    totalLength += length;
  }

  if (totalLength === 0) {
    return points[points.length - 1];
  }

  const targetLength = totalLength * clampedProgress;
  let walked = 0;

  for (let i = 0; i < segmentLengths.length; i += 1) {
    const segmentLength = segmentLengths[i];
    const nextWalked = walked + segmentLength;
    if (targetLength <= nextWalked || i === segmentLengths.length - 1) {
      const t = segmentLength === 0 ? 1 : (targetLength - walked) / segmentLength;
      const start = points[i];
      const end = points[i + 1];
      return {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      };
    }
    walked = nextWalked;
  }

  return points[points.length - 1];
}
