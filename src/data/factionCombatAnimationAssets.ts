import { FactionId } from '@/types/game';

import mechanikerAttackerPrep from '@/assets/unit-animations/combat/mechaniker/attacker-prep.svg?raw';
import mechanikerAttackerResolve from '@/assets/unit-animations/combat/mechaniker/attacker-resolve.svg?raw';
import mechanikerDefenderPrep from '@/assets/unit-animations/combat/mechaniker/defender-prep.svg?raw';
import mechanikerDefenderResolve from '@/assets/unit-animations/combat/mechaniker/defender-resolve.svg?raw';

import enclaveAttackerPrep from '@/assets/unit-animations/combat/enclave/attacker-prep.svg?raw';
import enclaveAttackerResolve from '@/assets/unit-animations/combat/enclave/attacker-resolve.svg?raw';
import enclaveDefenderPrep from '@/assets/unit-animations/combat/enclave/defender-prep.svg?raw';
import enclaveDefenderResolve from '@/assets/unit-animations/combat/enclave/defender-resolve.svg?raw';

import balkaniaAttackerPrep from '@/assets/unit-animations/combat/balkania/attacker-prep.svg?raw';
import balkaniaAttackerResolve from '@/assets/unit-animations/combat/balkania/attacker-resolve.svg?raw';
import balkaniaDefenderPrep from '@/assets/unit-animations/combat/balkania/defender-prep.svg?raw';
import balkaniaDefenderResolve from '@/assets/unit-animations/combat/balkania/defender-resolve.svg?raw';

import khanAttackerPrep from '@/assets/unit-animations/combat/khan/attacker-prep.svg?raw';
import khanAttackerResolve from '@/assets/unit-animations/combat/khan/attacker-resolve.svg?raw';
import khanDefenderPrep from '@/assets/unit-animations/combat/khan/defender-prep.svg?raw';
import khanDefenderResolve from '@/assets/unit-animations/combat/khan/defender-resolve.svg?raw';

import saharanAttackerPrep from '@/assets/unit-animations/combat/saharan/attacker-prep.svg?raw';
import saharanAttackerResolve from '@/assets/unit-animations/combat/saharan/attacker-resolve.svg?raw';
import saharanDefenderPrep from '@/assets/unit-animations/combat/saharan/defender-prep.svg?raw';
import saharanDefenderResolve from '@/assets/unit-animations/combat/saharan/defender-resolve.svg?raw';

export interface FactionCombatAnimationAssetSet {
  attackerPrep: string;
  attackerResolve: string;
  defenderPrep: string;
  defenderResolve: string;
  factionKey: FactionId;
  isFallback: boolean;
}

const registry: Record<FactionId, Omit<FactionCombatAnimationAssetSet, 'isFallback'>> = {
  mechaniker: {
    attackerPrep: mechanikerAttackerPrep,
    attackerResolve: mechanikerAttackerResolve,
    defenderPrep: mechanikerDefenderPrep,
    defenderResolve: mechanikerDefenderResolve,
    factionKey: 'mechaniker',
  },
  enclave: {
    attackerPrep: enclaveAttackerPrep,
    attackerResolve: enclaveAttackerResolve,
    defenderPrep: enclaveDefenderPrep,
    defenderResolve: enclaveDefenderResolve,
    factionKey: 'enclave',
  },
  balkania: {
    attackerPrep: balkaniaAttackerPrep,
    attackerResolve: balkaniaAttackerResolve,
    defenderPrep: balkaniaDefenderPrep,
    defenderResolve: balkaniaDefenderResolve,
    factionKey: 'balkania',
  },
  khan: {
    attackerPrep: khanAttackerPrep,
    attackerResolve: khanAttackerResolve,
    defenderPrep: khanDefenderPrep,
    defenderResolve: khanDefenderResolve,
    factionKey: 'khan',
  },
  saharan: {
    attackerPrep: saharanAttackerPrep,
    attackerResolve: saharanAttackerResolve,
    defenderPrep: saharanDefenderPrep,
    defenderResolve: saharanDefenderResolve,
    factionKey: 'saharan',
  },
};

const warned = new Set<string>();

export function getFactionCombatAnimationAssets(factionId: string | null | undefined): FactionCombatAnimationAssetSet {
  if (factionId && factionId in registry) {
    return {
      ...registry[factionId as FactionId],
      isFallback: false,
    };
  }

  if (factionId && !warned.has(factionId) && import.meta.env.DEV) {
    warned.add(factionId);
    console.warn(`[combat-animations] Missing combat animation assets for faction "${factionId}". Using placeholder fallback.`);
  }

  return {
    ...registry.mechaniker,
    isFallback: true,
  };
}
