import { useEffect, useMemo, useState } from 'react';
import { territoryCenters } from '@/data/territoryCenters';
import { buildUnitStackRenderModel } from './unitStackLayout';
import { UnitPieceSvg } from './UnitPieceSvg';
import { ManeuverAnimationEvent } from './types';
import { getManeuverAnimationDurationMs, interpolatePointAlongPath } from './pathInterpolation';

interface ManeuverUnitAnimationOverlayProps {
  event: ManeuverAnimationEvent;
  onComplete?: () => void;
}

export function ManeuverUnitAnimationOverlay({ event, onComplete }: ManeuverUnitAnimationOverlayProps) {
  const [progress, setProgress] = useState(0);

  const points = useMemo(
    () => event.path.map((territoryId) => territoryCenters[territoryId]).filter(Boolean),
    [event.path]
  );

  const durationMs = getManeuverAnimationDurationMs(Math.max(0, points.length - 1));

  useEffect(() => {
    let raf = 0;
    let completed = false;
    const start = performance.now();

    const tick = (now: number) => {
      const next = Math.min(1, (now - start) / durationMs);
      setProgress(next);
      if (next < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }
      if (!completed) {
        completed = true;
        onComplete?.();
      }
    };

    setProgress(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [event.timestamp, durationMs, onComplete]);

  if (points.length < 2) {
    return null;
  }

  const pos = interpolatePointAlongPath(points, progress);
  const opacity = progress >= 0.9 ? 1 - (progress - 0.9) / 0.1 : 1;
  const stack = buildUnitStackRenderModel(event.troopsMoved, { visiblePieceCap: 6 });

  return (
    <g pointerEvents="none" opacity={opacity}>
      <g transform={`translate(${pos.x}, ${pos.y})`}>
        {stack.pieces.map((piece, index) => (
          <g
            key={`move-${piece.kind}-${index}`}
            transform={`translate(${piece.x}, ${piece.y}) rotate(${piece.rotation}) scale(${piece.scale})`}
          >
            <UnitPieceSvg kind={piece.kind} factionId={event.factionId} size={30} opacity={0.95} />
          </g>
        ))}

        <g transform={`translate(${stack.overflowAnchor.x + 4}, ${stack.overflowAnchor.y - 2})`}>
          <rect
            x={-17}
            y={-8}
            width={34}
            height={16}
            rx={4}
            fill="#14532d"
            fillOpacity="0.92"
            stroke="#86efac"
            strokeWidth="0.8"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fill="#dcfce7"
            fontSize={7}
            fontWeight="bold"
            fontFamily="Oswald, sans-serif"
          >
            x{event.troopsMoved}
          </text>
        </g>
      </g>
    </g>
  );
}

export default ManeuverUnitAnimationOverlay;
