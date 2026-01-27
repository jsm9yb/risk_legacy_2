import { useEffect, useState, useCallback } from 'react';
import { TerritoryId, TerritoryState } from '@/types/territory';
import { Player } from '@/types/player';
import { territoriesById } from '@/data/territories';
import { factionsById } from '@/data/factions';
import { CombatResult, DieResult } from '@/utils/combatResolution';
import { FactionEmblem } from '@/components/icons/FactionEmblems';
import { SubPhase } from '@/types/game';
import { DiceRoller, DicePair } from '@/components/dice';

// Animation phase tracking - added 'pairing' phase for dice comparison animation
type AnimationPhase = 'idle' | 'rolling' | 'settling' | 'pairing' | 'showing-modifiers' | 'showing-results' | 'complete';

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
 * Single die display component with 3D dice and modifiers
 * Supports animation phases: rolling, settling, pairing, complete
 */
function DieDisplay({
  die,
  isAttacker,
  animationPhase,
  dieIndex,
}: {
  die: DieResult;
  isAttacker: boolean;
  animationPhase: AnimationPhase;
  dieIndex: number;
}) {
  const hasModifiers = die.modifiers.length > 0;
  const color = isAttacker ? 'red' : 'blue';

  // Staggered animation delay based on die index
  const appearDelay = `${dieIndex * 100}ms`;
  const modifierDelay = `${dieIndex * 100 + 200}ms`;

  const isRolling = animationPhase === 'rolling';
  const showModifiers = animationPhase === 'showing-modifiers' || animationPhase === 'showing-results' || animationPhase === 'complete';

  // Clamp value to valid die range (1-6)
  const safeValue = Math.max(1, Math.min(6, die.modifiedValue)) as 1 | 2 | 3 | 4 | 5 | 6;

  return (
    <div
      className={`
        flex flex-col items-center gap-1
        ${animationPhase === 'idle' ? 'animate-dice-appear' : ''}
      `}
      style={{ animationDelay: appearDelay }}
    >
      <DiceRoller
        value={safeValue}
        color={color}
        isRolling={isRolling}
        dieIndex={dieIndex}
        size={56}
      />
      {hasModifiers && showModifiers && (
        <div
          className="text-xs text-board-parchment/70 flex flex-col items-center animate-modifier-slide"
          style={{ animationDelay: modifierDelay }}
        >
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
 * Casualty display with pop animation
 */
function CasualtyDisplay({
  losses,
  isAttacker,
  delay,
}: {
  losses: number;
  isAttacker: boolean;
  delay: number;
}) {
  if (losses === 0) return null;

  return (
    <div
      className={`
        animate-casualty-pop
        ${isAttacker ? 'text-red-400' : 'text-blue-400'}
      `}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="font-numbers text-2xl font-bold mr-2">-{losses}</span>
      <span className="font-body">
        {isAttacker ? 'Attacker' : 'Defender'} troop{losses !== 1 ? 's' : ''}
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
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');

  const attackingTerritoryData = territoriesById[attackingTerritory];
  const defendingTerritoryData = territoriesById[defendingTerritory];
  const attackingTerritoryState = territoryStates[attackingTerritory];
  const defendingTerritoryState = territoryStates[defendingTerritory];

  const attackingFaction = factionsById[attackingPlayer.factionId];
  const defendingFaction = defendingPlayer ? factionsById[defendingPlayer.factionId] : null;

  // Animation sequence when combat result arrives
  useEffect(() => {
    if (combatResult && subPhase === 'RESOLVE') {
      // Reset animation state
      setAnimationPhase('idle');
      setShowResults(false);

      // Animation timeline (revised for 3D dice):
      // 0ms: Dice containers fade in (idle phase)
      // 100ms: 3D dice physics roll (drop, bounce, tumble)
      const rollTimer = setTimeout(() => {
        setAnimationPhase('rolling');
      }, 100);

      // 700ms: Dice land on final values (settling)
      const settleTimer = setTimeout(() => {
        setAnimationPhase('settling');
      }, 700);

      // 1100ms: Dice pairs slide toward center, VS appears (pairing)
      const pairingTimer = setTimeout(() => {
        setAnimationPhase('pairing');
      }, 1100);

      // 1900ms: Modifier badges animate in (longer pause to see pairing)
      const modifierTimer = setTimeout(() => {
        setAnimationPhase('showing-modifiers');
      }, 1900);

      // 2400ms: Winner/loser highlighting, casualties
      const resultsTimer = setTimeout(() => {
        setAnimationPhase('showing-results');
        setShowResults(true);
      }, 2400);

      // 3000ms: Animation complete, continue button appears
      const completeTimer = setTimeout(() => {
        setAnimationPhase('complete');
      }, 3000);

      return () => {
        clearTimeout(rollTimer);
        clearTimeout(settleTimer);
        clearTimeout(pairingTimer);
        clearTimeout(modifierTimer);
        clearTimeout(resultsTimer);
        clearTimeout(completeTimer);
      };
    }
    setShowResults(false);
    setAnimationPhase('idle');
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
              {/* Initial Dice Display (before pairing) */}
              {(animationPhase === 'idle' || animationPhase === 'rolling' || animationPhase === 'settling') && (
                <div className="flex justify-between items-start mb-6">
                  {/* Attacker Dice */}
                  <div className="flex-1">
                    <div className="text-sm text-board-parchment/60 font-body mb-3 text-center">
                      Attacker Dice
                    </div>
                    <div className="flex justify-center gap-3">
                      {combatResult.attackerRolls.map((die, i) => (
                        <DieDisplay
                          key={i}
                          die={die}
                          isAttacker={true}
                          animationPhase={animationPhase}
                          dieIndex={i}
                        />
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
                        <DieDisplay
                          key={i}
                          die={die}
                          isAttacker={false}
                          animationPhase={animationPhase}
                          dieIndex={i}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Dice Pair Comparisons (after pairing phase) */}
              {(animationPhase === 'pairing' || animationPhase === 'showing-modifiers' || animationPhase === 'showing-results' || animationPhase === 'complete') && (
                <div className="mb-6">
                  <div className="text-sm text-board-parchment/60 font-body mb-4 text-center">
                    Dice Comparisons
                  </div>
                  <div className="space-y-4">
                    {combatResult.comparisons.map((comp, i) => (
                      <DicePair
                        key={i}
                        attackerValue={comp.attackerValue}
                        defenderValue={comp.defenderValue}
                        attackerWins={comp.attackerWins}
                        pairIndex={i}
                        isPairing={animationPhase === 'pairing' || animationPhase === 'showing-modifiers' || animationPhase === 'showing-results' || animationPhase === 'complete'}
                        showResult={animationPhase === 'showing-results' || animationPhase === 'complete'}
                      />
                    ))}
                  </div>

                  {/* Show modifiers below dice pairs */}
                  {(animationPhase === 'showing-modifiers' || animationPhase === 'showing-results' || animationPhase === 'complete') && (
                    <div className="flex justify-between mt-4 px-8">
                      {/* Attacker modifiers */}
                      <div className="flex-1 text-center">
                        {combatResult.attackerRolls.some(d => d.modifiers.length > 0) && (
                          <div className="text-xs text-board-parchment/70 animate-modifier-slide">
                            {combatResult.attackerRolls.flatMap((die, i) =>
                              die.modifiers.map((mod, j) => (
                                <span key={`${i}-${j}`} className={`block ${mod.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {mod.delta > 0 ? '+' : ''}{mod.delta} {mod.name}
                                </span>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                      {/* Defender modifiers */}
                      <div className="flex-1 text-center">
                        {combatResult.defenderRolls.some(d => d.modifiers.length > 0) && (
                          <div className="text-xs text-board-parchment/70 animate-modifier-slide">
                            {combatResult.defenderRolls.flatMap((die, i) =>
                              die.modifiers.map((mod, j) => (
                                <span key={`${i}-${j}`} className={`block ${mod.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {mod.delta > 0 ? '+' : ''}{mod.delta} {mod.name}
                                </span>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Results */}
              {showResults && (
                <div className="bg-board-wood/30 rounded-lg p-4 mb-4 animate-fade-in-up">
                  <div className="text-center mb-4">
                    <div className="font-display text-lg text-board-parchment mb-2">Battle Outcome</div>

                    {/* Casualties with pop animation */}
                    <div className="flex justify-center gap-8 text-lg">
                      <CasualtyDisplay
                        losses={combatResult.attackerLosses}
                        isAttacker={true}
                        delay={0}
                      />
                      <CasualtyDisplay
                        losses={combatResult.defenderLosses}
                        isAttacker={false}
                        delay={100}
                      />
                    </div>

                    {/* Conquest notification with pulse animation */}
                    {combatResult.conquestRequired && (
                      <div
                        className="mt-4 text-green-400 font-display text-xl animate-conquest-pulse"
                        style={{ animationDelay: '300ms' }}
                      >
                        &#9733; TERRITORY CONQUERED! &#9733;
                      </div>
                    )}
                  </div>

                  {/* Continue button with fade in */}
                  <div
                    className="flex justify-center animate-fade-in-up"
                    style={{ animationDelay: '400ms' }}
                  >
                    <button
                      onClick={handleContinue}
                      className="px-8 py-3 rounded-lg font-display text-lg font-semibold
                        bg-green-600 hover:bg-green-500 text-white cursor-pointer shadow-lg
                        transition-all duration-150 hover:scale-105"
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
                <div className="font-display text-xl text-green-400 mb-2 animate-conquest-pulse">
                  Move troops to conquered territory
                </div>
                <div className="text-board-parchment/70 font-body">
                  From: {attackingTerritoryData?.name} → {defendingTerritoryData?.name}
                </div>
              </div>

              {/* Troop count display */}
              <div className="text-center mb-4">
                <span className="font-numbers text-5xl text-yellow-400">
                  {conquestTroopsToMove || conquestTroopRange.min}
                </span>
                <div className="text-sm text-board-parchment/60 font-body mt-1">
                  troops to move
                </div>
              </div>

              {/* Range slider with +/- buttons */}
              <div className="flex items-center justify-center gap-4 mb-4 px-8">
                <button
                  onClick={() => onSetConquestTroops(Math.max(conquestTroopRange.min, (conquestTroopsToMove || conquestTroopRange.min) - 1))}
                  disabled={(conquestTroopsToMove || conquestTroopRange.min) <= conquestTroopRange.min}
                  className={`
                    w-10 h-10 rounded-lg font-display text-xl font-bold
                    transition-all duration-150 flex-shrink-0
                    ${
                      (conquestTroopsToMove || conquestTroopRange.min) > conquestTroopRange.min
                        ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer'
                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  -
                </button>

                {/* Range slider */}
                <div className="flex-1 max-w-xs">
                  <input
                    type="range"
                    min={conquestTroopRange.min}
                    max={conquestTroopRange.max}
                    value={conquestTroopsToMove || conquestTroopRange.min}
                    onChange={(e) => onSetConquestTroops(parseInt(e.target.value, 10))}
                    disabled={conquestTroopRange.min === conquestTroopRange.max}
                    className={`
                      w-full h-3 rounded-lg appearance-none cursor-pointer
                      bg-board-wood/50
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-6
                      [&::-webkit-slider-thumb]:h-6
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-yellow-400
                      [&::-webkit-slider-thumb]:border-2
                      [&::-webkit-slider-thumb]:border-yellow-600
                      [&::-webkit-slider-thumb]:cursor-pointer
                      [&::-webkit-slider-thumb]:shadow-lg
                      [&::-webkit-slider-thumb]:transition-transform
                      [&::-webkit-slider-thumb]:hover:scale-110
                      [&::-moz-range-thumb]:w-6
                      [&::-moz-range-thumb]:h-6
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-yellow-400
                      [&::-moz-range-thumb]:border-2
                      [&::-moz-range-thumb]:border-yellow-600
                      [&::-moz-range-thumb]:cursor-pointer
                      ${conquestTroopRange.min === conquestTroopRange.max ? 'opacity-50' : ''}
                    `}
                  />
                  <div className="flex justify-between text-xs text-board-parchment/50 font-body mt-1">
                    <span>Min: {conquestTroopRange.min}</span>
                    <span>Max: {conquestTroopRange.max}</span>
                  </div>
                </div>

                <button
                  onClick={() => onSetConquestTroops(Math.min(conquestTroopRange.max, (conquestTroopsToMove || conquestTroopRange.min) + 1))}
                  disabled={(conquestTroopsToMove || conquestTroopRange.min) >= conquestTroopRange.max}
                  className={`
                    w-10 h-10 rounded-lg font-display text-xl font-bold
                    transition-all duration-150 flex-shrink-0
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

              {/* Territory troop preview */}
              <div className="flex justify-center gap-8 mb-6 text-sm font-body">
                <div className="text-center">
                  <div className="text-board-parchment/60">
                    {attackingTerritoryData?.name}
                  </div>
                  <div className="font-numbers text-lg text-red-400">
                    {(attackingTerritoryState?.troopCount || 0) - (conquestTroopsToMove || conquestTroopRange.min)} troops left
                  </div>
                </div>
                <div className="text-board-parchment/30 self-center">→</div>
                <div className="text-center">
                  <div className="text-board-parchment/60">
                    {defendingTerritoryData?.name}
                  </div>
                  <div className="font-numbers text-lg text-green-400">
                    {conquestTroopsToMove || conquestTroopRange.min} troops
                  </div>
                </div>
              </div>

              {/* Confirm button */}
              <div className="flex justify-center">
                <button
                  onClick={onConfirmConquest}
                  className="px-8 py-3 rounded-lg font-display text-lg font-semibold
                    bg-green-600 hover:bg-green-500 text-white cursor-pointer shadow-lg
                    transition-all duration-150 hover:scale-105"
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
