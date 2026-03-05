import { buildUnitStackRenderModel } from './unitStackLayout';
import { TerritoryUnitLayoutOverride } from './types';
import { UnitPieceSvg } from './UnitPieceSvg';

interface TerritoryUnitStackProps {
  troopCount: number;
  factionId?: string | null;
  layoutOverride?: TerritoryUnitLayoutOverride;
}

export function TerritoryUnitStack({ troopCount, factionId, layoutOverride }: TerritoryUnitStackProps) {
  const model = buildUnitStackRenderModel(troopCount, { layoutOverride });

  if (troopCount <= 0 || model.pieces.length === 0) {
    return null;
  }

  return (
    <g pointerEvents="none">
      {model.pieces.map((piece, index) => (
        <g
          key={`${piece.kind}-${index}`}
          transform={`translate(${piece.x}, ${piece.y}) rotate(${piece.rotation}) scale(${piece.scale})`}
        >
          <UnitPieceSvg kind={piece.kind} factionId={factionId} size={34} />
        </g>
      ))}

      {model.overflowLabel && (
        <g transform={`translate(${model.overflowAnchor.x}, ${model.overflowAnchor.y})`}>
          <rect
            x={-12}
            y={-8}
            width={24}
            height={16}
            rx={4}
            fill="#111827"
            fillOpacity="0.92"
            stroke="#f8fafc"
            strokeWidth="0.8"
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fill="#f8fafc"
            fontSize={7}
            fontWeight="bold"
            fontFamily="Oswald, sans-serif"
          >
            {model.overflowLabel}
          </text>
        </g>
      )}
    </g>
  );
}

export default TerritoryUnitStack;
