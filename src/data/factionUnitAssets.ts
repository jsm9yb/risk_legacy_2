import { FactionId } from '@/types/game';

import neutralPiece1 from '@/assets/units/_neutral/piece-1.svg';
import neutralPiece3 from '@/assets/units/_neutral/piece-3.svg';
import mechanikerPiece1 from '@/assets/units/mechaniker/piece-1.svg';
import mechanikerPiece3 from '@/assets/units/mechaniker/piece-3.svg';
import enclavePiece1 from '@/assets/units/enclave/piece-1.svg';
import enclavePiece3 from '@/assets/units/enclave/piece-3.svg';
import balkaniaPiece1 from '@/assets/units/balkania/piece-1.svg';
import balkaniaPiece3 from '@/assets/units/balkania/piece-3.svg';
import khanPiece1 from '@/assets/units/khan/piece-1.svg';
import khanPiece3 from '@/assets/units/khan/piece-3.svg';
import saharanPiece1 from '@/assets/units/saharan/piece-1.svg';
import saharanPiece3 from '@/assets/units/saharan/piece-3.svg';

export interface FactionUnitAssetSet {
  piece1Src: string;
  piece3Src: string;
  factionKey: FactionId | '_neutral';
  isFallback: boolean;
}

const FACTION_UNIT_ASSET_REGISTRY: Record<FactionId, Omit<FactionUnitAssetSet, 'isFallback'>> = {
  mechaniker: { piece1Src: mechanikerPiece1, piece3Src: mechanikerPiece3, factionKey: 'mechaniker' },
  enclave: { piece1Src: enclavePiece1, piece3Src: enclavePiece3, factionKey: 'enclave' },
  balkania: { piece1Src: balkaniaPiece1, piece3Src: balkaniaPiece3, factionKey: 'balkania' },
  khan: { piece1Src: khanPiece1, piece3Src: khanPiece3, factionKey: 'khan' },
  saharan: { piece1Src: saharanPiece1, piece3Src: saharanPiece3, factionKey: 'saharan' },
};

const neutralAssets: FactionUnitAssetSet = {
  piece1Src: neutralPiece1,
  piece3Src: neutralPiece3,
  factionKey: '_neutral',
  isFallback: true,
};

const warnedFactionIds = new Set<string>();

export function getFactionUnitAssets(factionId: string | null | undefined): FactionUnitAssetSet {
  if (factionId && factionId in FACTION_UNIT_ASSET_REGISTRY) {
    return {
      ...FACTION_UNIT_ASSET_REGISTRY[factionId as FactionId],
      isFallback: false,
    };
  }

  if (factionId && !warnedFactionIds.has(factionId) && import.meta.env.DEV) {
    warnedFactionIds.add(factionId);
    console.warn(`[territory-units] Missing unit SVG assets for faction "${factionId}". Using neutral fallback.`);
  }

  return neutralAssets;
}
