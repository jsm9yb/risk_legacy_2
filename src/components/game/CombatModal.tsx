import { useEffect, useState, useCallback } from 'react';
import { TerritoryId, TerritoryState } from '@/types/territory';
import { Player } from '@/types/player';
import { territoriesById } from '@/data/territories';
import { factionsById } from '@/data/factions';
import { CombatResult, DieResult } from '@/utils/combatResolution';
import { FactionEmblem } from '@/components/icons/FactionEmblems';
import { SubPhase } from '@/types/game';

interface CombatModalProps {
  isOpen: boolean;
  subPhase: SubPhase;
  attackingTerritory: TerritoryId;
  defendingTerritory: TerritoryId;
  territoryStates: Record<TerritoryId, TerritoryState>;
  attackingPlayer: Player;
  defendingPlayer: Player | null;
  attackerDiceCount: number | null;
  defenderDiceCount: number | null;
  availableDefenderDice: number[];
  combatResult: CombatResult | null;
  conquestTroopsToMove: number | null;
  conquestTroopRange: { min: number; max: number };
  onSelectDefenderDice: (count: number) => void;
  onResolveCombat: () => void;
  onSetConquestTroops: (troops: number) => void;
  onConfirmConquest: () => void;
  onContinueAttack: () => void;
  onCancel: () => void;
}

/**
 * Single die display component with value and modifiers
 */
function DieDisplay({
  die,
  isAttacker,
}: {
  die: DieResult;
  isAttacker: boolean;
}) {
  const hasModifiers = die.modifiers.length > 0;
  const bgColor = isAttacker ? 'bg-red-600' : 'bg-blue-600';

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`
          w-14 h-14 ${bgColor} rounded-lg flex items-center justify-center
          shadow-lg border-2 ${isAttacker ? 'border-red-400' : 'border-blue-400'}
          transition-all duration-300
        `}
      >
        <span className="font-numbers text-3xl text-white font-bold">
          {die.modifiedValue}
        </span>
      </div>
      {hasModifiers && (
        <div className="text-xs text-board-parchment/70 flex flex-col items-center">
          {die.modifiers.map((mod, i) => (
            <span key={i} className={mod.delta > 0 ? 'text-green-400' : 'text-red-400'}>
              {mod.delta > 0 ? '+' : ''}{mod.delta} {mod.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Comparison result display
 */
function ComparisonDisplay({
  attackerValue,
  defenderValue,
  attackerWins,
}: {
  attackerValue: number;
  defenderValue: number;
  attackerWins: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-lg font-body">
      <span className={attackerWins ? 'text-green-400 font-bold' : 'text-board-parchment/70'}>
        {attackerValue}
      </span>
      <span className="text-board-parchment/50">vs</span>
      <span className={!attackerWins ? 'text-green-400 font-bold' : 'text-board-parchment/70'}>
        {defenderValue}
      </span>
      <span className="mx-2">&rarr;</span>
      <span className={attackerWins ? 'text-red-400' : 'text-blue-400'}>
        {attackerWins ? 'Attacker wins' : 'Defender wins'}
      </span>
    </div>
  );
}

export function CombatModal({
  isOpen,
  subPhase,
  attackingTerritory,
  defendingTerritory,
  territoryStates,
  attackingPlayer,
  defendingPlayer,
  attackerDiceCount,
  defenderDiceCount,
  availableDefenderDice,
  combatResult,
  conquestTroopsToMove,
  conquestTroopRange,
  onSelectDefenderDice,
  onResolveCombat,
  onSetConquestTroops,
  onConfirmConquest,
  onContinueAttack,
  onCancel,
}: CombatModalProps) {
  const [showResults, setShowResults] = useState(false);

  const attackingTerritoryData = territoriesById[attackingTerritory];
  const defendingTerritoryData = territoriesById[defendingTerritory];
  const attackingTerritoryState = territoryStates[attackingTerritory];
  const defendingTerritoryState = territoryStates[defendingTerritory];

  const attackingFaction = factionsById[attackingPlayer.factionId];
  const defendingFaction = defendingPlayer ? factionsById[defendingPlayer.factionId] : null;

  // Auto-show results after combat resolution
  useEffect(() => {
    if (combatResult && subPhase === 'RESOLVE') {
      const timer = setTimeout(() => {
        setShowResults(true);
      }, 500);
      return () => clearTimeout(timer);
    }
    setShowResults(false);
  }, [combatResult, subPhase]);

  // Handle continue after seeing results
  const handleContinue = useCallback(() => {
    if (combatResult?.conquestRequired) {
      onResolveCombat();
    } else {
      onResolveCombat();
      onContinueAttack();
    }
  }, [combatResult, onResolveCombat, onContinueAttack]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={subPhase === 'DEFENDER_DICE' ? undefined : onCancel}
      />

      {/* Modal */}
      <div className="relative bg-board-border rounded-xl shadow-2xl border-4 border-board-wood max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-board-wood px-6 py-4 text-center">
          <h2 className="font-display text-2xl text-board-parchment flex items-center justify-center gap-2">
            <span className="text-red-400">&#9876;</span>
            COMBAT
            <span className="text-red-400">&#9876;</span>
          </h2>
          <div className="text-board-parchment/70 font-body mt-1">
            {attackingTerritoryData?.name} &rarr; {defendingTerritoryData?.name}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Territory Info */}
          <div className="flex justify-between items-start mb-6">
            {/* Attacker */}
            <div className="flex-1 text-center">
              <div className="text-sm text-board-parchment/60 font-body mb-2">ATTACKER</div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <FactionEmblem factionId={attackingPlayer.factionId} size={32} />
                <span className="font-display text-lg text-yellow-400">
                  {attackingFaction?.name}
                </span>
              </div>
              <div className="text-board-parchment font-body">
                {attackingTerritoryData?.name}
              </div>
              <div className="font-numbers text-2xl text-board-parchment mt-1">
                {attackingTerritoryState?.troopCount} troops
              </div>
              {attackerDiceCount && (
                <div className="text-sm text-red-400 mt-1">
                  {attackerDiceCount} {attackerDiceCount === 1 ? 'die' : 'dice'}
                </div>
              )}
            </div>

            {/* VS */}
            <div className="px-6 py-4">
              <div className="text-4xl text-red-400">&#9876;</div>
            </div>

            {/* Defender */}
            <div className="flex-1 text-center">
              <div className="text-sm text-board-parchment/60 font-body mb-2">DEFENDER</div>
              {defendingPlayer && defendingFaction ? (
                <>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <FactionEmblem factionId={defendingPlayer.factionId} size={32} />
                    <span className="font-display text-lg text-blue-400">
                      {defendingFaction.name}
                    </span>
                  </div>
                </>
              ) : (
                <div className="font-display text-lg text-board-parchment/50 mb-2">
                  Unoccupied
                </div>
              )}
              <div className="text-board-parchment font-body">
                {defendingTerritoryData?.name}
              </div>
              <div className="font-numbers text-2xl text-board-parchment mt-1">
                {defendingTerritoryState?.troopCount} troops
              </div>
              {defenderDiceCount && (
                <div className="text-sm text-blue-400 mt-1">
                  {defenderDiceCount} {defenderDiceCount === 1 ? 'die' : 'dice'}
                </div>
              )}
              {/* Scar info */}
              {defendingTerritoryState?.scarId && (
                <div className="text-xs text-yellow-400 mt-1">
                  {defendingTerritoryState.scarId === 'bunker' && '🛡 Bunker (+1 def)'}
                  {defendingTerritoryState.scarId === 'ammo_shortage' && '⚠ Ammo Shortage (-1 def)'}
                </div>
              )}
              {defendingTerritoryState?.fortified && (
                <div className="text-xs text-green-400 mt-1">
                  🏰 Fortified (+1 to all def dice)
                </div>
              )}
            </div>
          </div>

          {/* Defender Dice Selection */}
          {subPhase === 'DEFENDER_DICE' && (
            <div className="text-center py-6 border-t border-board-wood/50">
              <div className="font-display text-lg text-board-parchment mb-4">
                Defender: Select dice count
              </div>
              <div className="flex justify-center gap-4">
                {[1, 2].map((count) => {
                  const isAvailable = availableDefenderDice.includes(count);
                  return (
                    <button
                      key={count}
                      onClick={() => isAvailable && onSelectDefenderDice(count)}
                      disabled={!isAvailable}
                      className={`
                        w-20 h-20 rounded-xl font-display text-2xl font-bold
                        flex flex-col items-center justify-center gap-1
                        transition-all duration-150 border-2
                        ${
                          isAvailable
                            ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer border-blue-400 shadow-lg hover:scale-105'
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed border-gray-600'
                        }
                      `}
                    >
                      <span className="font-numbers text-3xl">{count}</span>
                      <span className="text-sm font-body opacity-80">
                        {count === 1 ? 'die' : 'dice'}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="text-sm text-board-parchment/60 mt-4 font-body">
                Max: {Math.max(...availableDefenderDice, 0)} dice
              </div>
            </div>
          )}

          {/* Combat Results */}
          {subPhase === 'RESOLVE' && combatResult && (
            <div className="border-t border-board-wood/50 pt-6">
              {/* Dice Display */}
              <div className="flex justify-between items-start mb-6">
                {/* Attacker Dice */}
                <div className="flex-1">
                  <div className="text-sm text-board-parchment/60 font-body mb-3 text-center">
                    Attacker Dice
                  </div>
                  <div className="flex justify-center gap-3">
                    {combatResult.attackerRolls.map((die, i) => (
                      <DieDisplay key={i} die={die} isAttacker={true} />
                    ))}
                  </div>
                </div>

                {/* Defender Dice */}
                <div className="flex-1">
                  <div className="text-sm text-board-parchment/60 font-body mb-3 text-center">
                    Defender Dice
                  </div>
                  <div className="flex justify-center gap-3">
                    {combatResult.defenderRolls.map((die, i) => (
                      <DieDisplay key={i} die={die} isAttacker={false} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Results */}
              {showResults && (
                <div className="bg-board-wood/30 rounded-lg p-4 mb-4">
                  <div className="text-center mb-4">
                    <div className="font-display text-lg text-board-parchment mb-2">Results</div>

                    {/* Comparisons */}
                    <div className="space-y-2 mb-4">
                      {combatResult.comparisons.map((comp, i) => (
                        <ComparisonDisplay
                          key={i}
                          attackerValue={comp.attackerValue}
                          defenderValue={comp.defenderValue}
                          attackerWins={comp.attackerWins}
                        />
                      ))}
                    </div>

                    {/* Casualties */}
                    <div className="flex justify-center gap-8 text-lg font-body">
                      {combatResult.attackerLosses > 0 && (
                        <div className="text-red-400">
                          Attacker loses {combatResult.attackerLosses} troop
                          {combatResult.attackerLosses !== 1 ? 's' : ''}
                        </div>
                      )}
                      {combatResult.defenderLosses > 0 && (
                        <div className="text-blue-400">
                          Defender loses {combatResult.defenderLosses} troop
                          {combatResult.defenderLosses !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>

                    {/* Conquest notification */}
                    {combatResult.conquestRequired && (
                      <div className="mt-4 text-green-400 font-display text-xl">
                        &#9733; TERRITORY CONQUERED! &#9733;
                      </div>
                    )}
                  </div>

                  {/* Continue button */}
                  <div className="flex justify-center">
                    <button
                      onClick={handleContinue}
                      className="px-8 py-3 rounded-lg font-display text-lg font-semibold
                        bg-green-600 hover:bg-green-500 text-white cursor-pointer shadow-lg
                        transition-all duration-150"
                    >
                      {combatResult.conquestRequired ? 'Move Troops' : 'Continue'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Troop Movement after Conquest */}
          {subPhase === 'TROOP_MOVE' && (
            <div className="border-t border-board-wood/50 pt-6">
              <div className="text-center mb-4">
                <div className="font-display text-xl text-green-400 mb-2">
                  Move troops to conquered territory
                </div>
                <div className="text-board-parchment/70 font-body">
                  Min: {conquestTroopRange.min} | Max: {conquestTroopRange.max}
                </div>
              </div>

              {/* Troop slider */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={() => onSetConquestTroops(Math.max(conquestTroopRange.min, (conquestTroopsToMove || conquestTroopRange.min) - 1))}
                  disabled={(conquestTroopsToMove || conquestTroopRange.min) <= conquestTroopRange.min}
                  className={`
                    w-12 h-12 rounded-lg font-display text-xl font-bold
                    transition-all duration-150
                    ${
                      (conquestTroopsToMove || conquestTroopRange.min) > conquestTroopRange.min
                        ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  -
                </button>

                <div className="w-32 text-center">
                  <span className="font-numbers text-4xl text-yellow-400">
                    {conquestTroopsToMove || conquestTroopRange.min}
                  </span>
                  <div className="text-sm text-board-parchment/60 font-body">troops</div>
                </div>

                <button
                  onClick={() => onSetConquestTroops(Math.min(conquestTroopRange.max, (conquestTroopsToMove || conquestTroopRange.min) + 1))}
                  disabled={(conquestTroopsToMove || conquestTroopRange.min) >= conquestTroopRange.max}
                  className={`
                    w-12 h-12 rounded-lg font-display text-xl font-bold
                    transition-all duration-150
                    ${
                      (conquestTroopsToMove || conquestTroopRange.min) < conquestTroopRange.max
                        ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  +
                </button>
              </div>

              {/* Confirm button */}
              <div className="flex justify-center">
                <button
                  onClick={onConfirmConquest}
                  className="px-8 py-3 rounded-lg font-display text-lg font-semibold
                    bg-green-600 hover:bg-green-500 text-white cursor-pointer shadow-lg
                    transition-all duration-150"
                >
                  Confirm Conquest
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Cancel button (only during certain phases) */}
        {subPhase === 'DEFENDER_DICE' && (
          <div className="bg-board-wood/30 px-6 py-4 flex justify-center">
            <button
              onClick={onCancel}
              className="px-6 py-2 rounded-lg font-display text-sm font-semibold
                bg-gray-600 hover:bg-gray-500 text-white cursor-pointer
                transition-all duration-150"
            >
              Cancel Attack
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CombatModal;
