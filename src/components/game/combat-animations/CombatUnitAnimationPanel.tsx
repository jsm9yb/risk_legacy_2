import { FactionId, SubPhase } from '@/types/game';
import { CombatResult } from '@/utils/combatResolution';
import { getFactionCombatAnimationAssets } from '@/data/factionCombatAnimationAssets';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { AnimatedSvgClip } from './AnimatedSvgClip';
import { UnitPieceSvg } from '@/components/game/territory-units/UnitPieceSvg';

type CombatAnimationPhase = 'idle' | 'rolling' | 'settling' | 'pairing' | 'showing-modifiers' | 'showing-results' | 'complete';

interface CombatUnitAnimationPanelProps {
  subPhase: SubPhase;
  animationPhase: CombatAnimationPhase;
  attackerFactionId: FactionId;
  defenderFactionId?: FactionId | null;
  combatResult: CombatResult | null;
}

function SideFallback({ label, factionId }: { label: string; factionId?: string | null }) {
  return (
    <div className="rounded-lg border border-board-wood/60 bg-board-wood/30 p-3 h-full flex flex-col items-center justify-center gap-2">
      <svg viewBox="0 0 80 44" className="w-full h-20">
        <g transform="translate(28,22) scale(1)">
          <UnitPieceSvg kind={3} factionId={factionId} size={28} />
        </g>
        <g transform="translate(50,26) scale(0.9)">
          <UnitPieceSvg kind={1} factionId={factionId} size={24} />
        </g>
      </svg>
      <div className="text-xs text-board-parchment/70 font-body">{label}</div>
    </div>
  );
}

export function CombatUnitAnimationPanel({
  subPhase,
  animationPhase,
  attackerFactionId,
  defenderFactionId,
  combatResult,
}: CombatUnitAnimationPanelProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const showResolveClip = animationPhase === 'showing-results' || animationPhase === 'complete';
  const attackerAssets = getFactionCombatAnimationAssets(attackerFactionId);
  const defenderAssets = getFactionCombatAnimationAssets(defenderFactionId ?? undefined);
  const clipPhaseLabel = showResolveClip ? 'Resolve' : 'Prepare';
  const replayKey = `${subPhase ?? 'none'}:${animationPhase}:${combatResult ? 'has-result' : 'no-result'}:${clipPhaseLabel}`;

  const attackerMarkup = showResolveClip ? attackerAssets.attackerResolve : attackerAssets.attackerPrep;
  const defenderMarkup = showResolveClip ? defenderAssets.defenderResolve : defenderAssets.defenderPrep;

  return (
    <div className="mb-6 rounded-xl border border-board-wood/60 bg-black/20 p-3">
      <div className="flex items-center justify-between text-xs font-body text-board-parchment/60 mb-2 px-1">
        <span>Combat Animation</span>
        <span>{clipPhaseLabel}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-red-300 font-body mb-1 text-center">Attacker</div>
          {prefersReducedMotion ? (
            <SideFallback label="Reduced motion" factionId={attackerFactionId} />
          ) : (
            <AnimatedSvgClip
              markup={attackerMarkup}
              replayKey={`${replayKey}:attacker`}
              className="rounded-lg overflow-hidden border border-red-500/30 bg-black/20 [&>svg]:w-full [&>svg]:h-auto"
            />
          )}
          {showResolveClip && combatResult && (
            <div className="mt-1 text-center text-xs text-red-300 font-body">
              -{combatResult.attackerLosses} loss{combatResult.attackerLosses === 1 ? '' : 'es'}
            </div>
          )}
        </div>
        <div>
          <div className="text-xs text-blue-300 font-body mb-1 text-center">Defender</div>
          {prefersReducedMotion ? (
            <SideFallback label="Reduced motion" factionId={defenderFactionId ?? null} />
          ) : (
            <AnimatedSvgClip
              markup={defenderMarkup}
              replayKey={`${replayKey}:defender`}
              className="rounded-lg overflow-hidden border border-blue-500/30 bg-black/20 [&>svg]:w-full [&>svg]:h-auto"
            />
          )}
          {showResolveClip && combatResult && (
            <div className="mt-1 text-center text-xs text-blue-300 font-body">
              -{combatResult.defenderLosses} loss{combatResult.defenderLosses === 1 ? '' : 'es'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CombatUnitAnimationPanel;
