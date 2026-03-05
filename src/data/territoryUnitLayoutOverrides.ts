import { TerritoryId } from '@/types/territory';
import { TerritoryUnitLayoutOverride } from '@/components/game/territory-units/types';

export const territoryUnitLayoutOverrides: Partial<Record<TerritoryId, TerritoryUnitLayoutOverride>> = {
  greenland: { dy: 6, fanStepX: 4.2 },
  iceland: { dy: 6, pieceScale: 0.56, fanStepX: 3.6 },
  japan: { dx: 4, dy: 4, pieceScale: 0.56, fanStepX: 3.5 },
  madagascar: { dy: 4, pieceScale: 0.56, fanStepX: 3.6 },
  indonesia: { dy: 4, pieceScale: 0.56, fanStepX: 3.6 },
  new_guinea: { dy: 3, pieceScale: 0.56, fanStepX: 3.6 },
};

export function getTerritoryUnitLayoutOverride(territoryId: TerritoryId): TerritoryUnitLayoutOverride | undefined {
  return territoryUnitLayoutOverrides[territoryId];
}
