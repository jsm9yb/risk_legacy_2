# Implementation Summary: Custom Territory Units + Combat/Maneuver Animations

Timestamp: 2026-02-26

## Completed

- Replaced map troop number badges with faction-specific SVG unit stacks (3-unit and 1-unit pieces) plus overflow labels.
- Preserved pending deployment badges and HQ markers on the board overlay.
- Added unit stack decomposition/cap/overflow layout logic and territory-specific layout overrides for cramped territories.
- Added placeholder static unit SVG assets for all factions and neutral fallback under `src/assets/units/...`.
- Added faction unit asset registry with neutral fallback + dev warning behavior.
- Added maneuver board overlay animation with moving unit pieces along the selected path.
- Added reduced-motion handling for maneuver animation (static/fade path behavior).
- Captured transient maneuver animation payload in `App.tsx` before `confirmManeuver` is sent and passed it to `GameBoard`.
- Added placeholder animated combat SVG clips (attacker/defender prep + resolve) for all factions under `src/assets/unit-animations/combat/...`.
- Added combat animation asset registry and inline animated SVG renderer (sanitized raw SVG markup, remount replay behavior).
- Integrated a combat animation panel into `CombatModal` above the existing dice/results UI without changing dice flow logic.
- Added reduced-motion fallback in combat panel (static unit visuals instead of animated clips).
- Added unit tests for unit stack decomposition/cap/overflow/layout override fallback.

## New Files / Modules Added

- `src/components/game/territory-units/types.ts`
- `src/components/game/territory-units/unitStackLayout.ts`
- `src/components/game/territory-units/UnitPieceSvg.tsx`
- `src/components/game/territory-units/TerritoryUnitStack.tsx`
- `src/components/game/territory-units/pathInterpolation.ts`
- `src/components/game/territory-units/ManeuverUnitAnimationOverlay.tsx`
- `src/components/game/combat-animations/AnimatedSvgClip.tsx`
- `src/components/game/combat-animations/CombatUnitAnimationPanel.tsx`
- `src/data/factionUnitAssets.ts`
- `src/data/factionCombatAnimationAssets.ts`
- `src/data/territoryUnitLayoutOverrides.ts`
- `src/hooks/usePrefersReducedMotion.ts`
- `tests/unit/unitStackLayout.test.ts`
- Placeholder assets in `src/assets/units/` and `src/assets/unit-animations/combat/`

## Files Updated

- `src/components/game/GameBoard.tsx`
- `src/components/game/CombatModal.tsx`
- `src/App.tsx`

## Validation Run

- `npm run build` ✅
- `npm run test:unit -- tests/unit/unitStackLayout.test.ts` ✅

## Remaining / Not Yet Implemented

- Full component/integration test coverage from the plan (GameBoard/CombatModal/App maneuver flow).
- Final art/animation asset replacement (currently placeholders).
- Optional expanded layout tuning for more territories after visual QA.
