import { getFactionUnitAssets } from '@/data/factionUnitAssets';
import { UnitPieceKind } from './types';

interface UnitPieceSvgProps {
  kind: UnitPieceKind;
  factionId?: string | null;
  size?: number;
  opacity?: number;
}

export function UnitPieceSvg({ kind, factionId, size = 28, opacity = 1 }: UnitPieceSvgProps) {
  const assets = getFactionUnitAssets(factionId);
  const href = kind === 3 ? assets.piece3Src : assets.piece1Src;
  const half = size / 2;

  return (
    <image
      href={href}
      x={-half}
      y={-half}
      width={size}
      height={size}
      opacity={opacity}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

export default UnitPieceSvg;
