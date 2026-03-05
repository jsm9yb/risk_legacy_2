import { describe, expect, it } from 'vitest';
import {
  buildUnitStackRenderModel,
  decomposeTroopsToUnitPieces,
  getVisibleUnitPieces,
  UNIT_STACK_VISIBLE_PIECE_CAP,
} from '@/components/game/territory-units/unitStackLayout';
import { getTerritoryUnitLayoutOverride } from '@/data/territoryUnitLayoutOverrides';

describe('unitStackLayout', () => {
  it('decomposes counts 0-30 into max 3s then 1s', () => {
    for (let troops = 0; troops <= 30; troops += 1) {
      const pieces = decomposeTroopsToUnitPieces(troops);
      const total = pieces.reduce((sum, piece) => sum + piece, 0);
      expect(total).toBe(troops);

      const firstOneIndex = pieces.indexOf(1);
      if (firstOneIndex !== -1) {
        expect(pieces.slice(0, firstOneIndex).every((piece) => piece === 3)).toBe(true);
        expect(pieces.slice(firstOneIndex).every((piece) => piece === 1)).toBe(true);
      }
    }
  });

  it('caps visible pieces at 6 and overflow label reflects hidden troop value', () => {
    const visible = getVisibleUnitPieces(20, UNIT_STACK_VISIBLE_PIECE_CAP);
    expect(visible.length).toBe(6);
    expect(visible.filter((piece) => piece === 1)).toHaveLength(1);

    const renderModel = buildUnitStackRenderModel(20);
    expect(renderModel.hiddenTroops).toBe(4);
    expect(renderModel.overflowLabel).toBe('+4');
  });

  it('reserves a visible 1-unit slot when capped and remainder exists', () => {
    const visible = getVisibleUnitPieces(17);
    expect(visible).toEqual([3, 3, 3, 3, 3, 1]);

    const renderModel = buildUnitStackRenderModel(17);
    expect(renderModel.hiddenTroops).toBe(1);
    expect(renderModel.overflowLabel).toBe('+1');
  });

  it('returns no pieces for zero troops', () => {
    const renderModel = buildUnitStackRenderModel(0);
    expect(renderModel.pieces).toHaveLength(0);
    expect(renderModel.overflowLabel).toBeNull();
  });

  it('uses layout overrides when present and falls back when missing', () => {
    const japanOverride = getTerritoryUnitLayoutOverride('japan');
    const unknownOverride = getTerritoryUnitLayoutOverride('not_a_territory');

    expect(japanOverride).toBeDefined();
    expect(unknownOverride).toBeUndefined();
  });
});
