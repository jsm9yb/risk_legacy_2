# Custom Territory Unit SVGs + Combat/Maneuver Animation Plan

## Summary

Implement this in 2 phases.

1. Phase 1 adds faction-specific territory unit SVG stacks that replace the current numeric troop badge on the map.
2. Phase 2 adds custom animated SVGs in CombatModal for attack/defend (augmenting existing dice UI) and a board-overlay maneuver animation for troop movement paths.

This plan assumes placeholder assets first, with a strict asset contract so final art/animations from another model can be dropped in later.

## Scope and Decisions Locked

- Delivery: 2 phases
- Territory rendering: decomposed 3-unit + 1-unit SVG pieces
- Territory readability: hybrid cap + overflow, cap = 6 visible pieces
- Board numeric counts: overflow only (no always-visible main badge)
- Combat animations: CombatModal only, augment existing dice UI
- Combat style: pre-roll + resolution
- Combat animation assets: animated SVG files
- Combat asset granularity: faction + side clip sets (no count-specific variants)
- Maneuver animations: board overlay, animated unit pieces move along path
- Reduced motion: static fallback

## Phase 1: Territory Unit SVG Stacks

## Implementation Goals

- Replace territory troop count circles/text in `src/components/game/GameBoard.tsx` with faction-themed unit piece stacks.
- Preserve readability on cramped territories.
- Preserve current pending deployment indicator and HQ markers.
- Keep exact counts visible via overflow label and existing tooltip.

## Rendering Rules (Decision Complete)

- Decomposition rule: maximize 3s, then 1s.
- Formula: `threes = Math.floor(troopCount / 3)`, `ones = troopCount % 3`.
- Piece list values: `[3, 3, ..., 3, 1, 1]`.
- Visible piece cap: 6.
- If total pieces <= 6: render all pieces.
- If total pieces > 6: reserve 1 slot for a 1-unit piece if `ones > 0`, fill remaining visible slots with 3-unit pieces.
- Overflow label shows hidden troop value, not hidden piece count (example: `+11`).
- No main numeric badge is shown when no overflow exists.
- If troop count is 0, render nothing.
- If territory owner/faction art is missing, render a neutral placeholder unit set and log a development warning (no runtime crash).

## Visual Layout Rules

- Render stacks centered on `territoryCenters[territoryId]`.
- Use a deterministic fan/stack layout with slight offsets so pieces are visible.
- Default layout uses small diagonal offsets and z-order back-to-front.
- Add a per-territory optional layout override map for cramped territories (offset/scale tweaks).
- Overflow label anchors near the stack top-right.
- Pending deployment badge remains as a small green numeric badge and is rendered above stack visuals.
- HQ markers remain above unit stacks.
- Maneuver path polyline remains above base stacks (Phase 2 adds moving units above it).

## Files/Modules to Add or Refactor

- `src/components/game/GameBoard.tsx`
- `src/components/game/territory-units/TerritoryUnitStack.tsx` (new)
- `src/components/game/territory-units/UnitPieceSvg.tsx` (new)
- `src/components/game/territory-units/unitStackLayout.ts` (new, decomposition + cap + offsets)
- `src/components/game/territory-units/types.ts` (new)
- `src/data/factionUnitAssets.ts` (new asset registry)
- `src/assets/units/...` (placeholder static SVGs)
- `src/data/territoryUnitLayoutOverrides.ts` (new, optional overrides)

## Asset Contract (Phase 1 Static Pieces)

- One 1-unit and one 3-unit static SVG per faction.
- Placeholder files can be generic/simple now.
- Final art drop-in path convention:
  - `src/assets/units/{factionId}/piece-1.svg`
  - `src/assets/units/{factionId}/piece-3.svg`
- Neutral fallback:
  - `src/assets/units/_neutral/piece-1.svg`
  - `src/assets/units/_neutral/piece-3.svg`
- SVG coordinate system standard: `viewBox="0 0 64 64"` (normalize all pieces to same box for scaling consistency).

## Public APIs / Types Changes (Phase 1)

- Add `FactionUnitAssetSet` registry type in `src/data/factionUnitAssets.ts`.
- Add stack decomposition types:
  - `UnitPieceKind = 1 | 3`
  - `VisibleUnitPiece`
  - `UnitStackRenderModel`
- GameBoard internal rendering changes only (no required external prop change in Phase 1).

## Phase 2: CombatModal Attack/Defend Animated SVGs + Maneuver Board Animation

## 2A. CombatModal Animated SVGs (Attack/Defend)

### Goals

- Add faction-specific animated SVG clips to CombatModal.
- Keep current dice UI/flow intact.
- Add visual storytelling in two beats:
  - Pre-roll (pose/engage)
  - Resolution (casualty/result reaction)

### Integration Strategy

- Insert a new combat unit animation panel in `src/components/game/CombatModal.tsx` inside the existing content area, above the dice/result sections.
- Show attacker and defender animated SVG clips side-by-side, matching current attacker/defender metadata sections.
- Use key remounting to restart clip playback when animation phase changes.
- Clip playback is driven by existing modal state transitions (`subPhase`, `animationPhase`, `combatResult`).

### Trigger Mapping (Decision Complete)

- Pre-roll clip trigger:
  - Start when entering `ATTACKER_DICE` or `DEFENDER_DICE`
  - Replay when `combatResult` arrives and modal enters result animation sequence (`MISSILE_WINDOW`/`RESOLVE`)
- Resolution clip trigger:
  - Start at modal `animationPhase === 'showing-results'`
- Casualty/result data overlays remain app-rendered text (do not encode casualties in SVG assets)
- Dice animations remain unchanged and synchronized visually, not frame-perfect coupled to SVG internals

### Combat Asset Contract (Animated SVG Files)

- Per faction, per side animated clip set (no count variants).
- File convention:
  - `src/assets/unit-animations/combat/{factionId}/attacker-prep.svg`
  - `src/assets/unit-animations/combat/{factionId}/attacker-resolve.svg`
  - `src/assets/unit-animations/combat/{factionId}/defender-prep.svg`
  - `src/assets/unit-animations/combat/{factionId}/defender-resolve.svg`
- Placeholder animated SVGs allowed initially (shared/generic visuals).
- Implementation target supports local animated SVG files imported as raw markup and inlined.
- Asset constraints:
  - No embedded JavaScript
  - CSS/SMIL animation only
  - Transparent background
  - Standardized viewBox (recommend `0 0 256 128`)
  - Self-contained styles to avoid leaking into app CSS

### New Components/Helpers (Combat)

- `src/components/game/combat-animations/CombatUnitAnimationPanel.tsx` (new)
- `src/components/game/combat-animations/AnimatedSvgClip.tsx` (new inline/raw renderer with remount replay)
- `src/data/factionCombatAnimationAssets.ts` (new registry)

## 2B. Maneuver Board Overlay Animation

### Goals

- When maneuver is confirmed, show animated unit pieces moving along the selected path on the main board.
- Preserve current instant game-state correctness while adding a transient UI animation layer.

### Trigger Strategy (Decision Complete)

- Capture maneuver animation payload in `App.tsx` immediately before executing maneuver confirm action.
- Payload includes:
  - `factionId`
  - `sourceTerritoryId`
  - `targetTerritoryId`
  - `path`
  - `troopsMoved`
  - `timestamp`
- Pass payload to GameBoard as a transient prop (queue or single active animation state).
- GameBoard renders a moving overlay independent of territory state updates, so it can animate even after store clears `currentManeuverPath`.

### Maneuver Visual Rules

- Animate a small number of moving piece instances along the path (not one per troop).
- Moving piece decomposition follows same 3/1 logic but capped separately for animation readability (use same cap 6).
- Display moved total as a compact label near moving group (`xN` or `+N moving`) during animation.
- Existing green maneuver path polyline remains visible during animation and fades after animation completes.
- Default animation duration: `700ms + 120ms * (pathSegments - 1)`, clamped to `700-1400ms`.
- End state is authoritative from store counts; animation is purely visual.

### New Components/Helpers (Maneuver)

- `src/components/game/territory-units/ManeuverUnitAnimationOverlay.tsx` (new)
- `src/components/game/territory-units/pathInterpolation.ts` (new)
- GameBoard prop addition for transient maneuver animation payload(s)

## Public APIs / Types Changes (Phase 2)

- `GameBoardProps` additions:
  - `maneuverAnimation?: ManeuverAnimationEvent | null`
  - Optional `prefersReducedMotion?: boolean` if centralized; otherwise component-local hook
- New UI-only type:
  - `ManeuverAnimationEvent`
- No server/state schema changes required (client-only presentation feature)

## Reduced Motion Behavior

- When reduced motion is enabled:
  - Combat animated SVG clips replaced by static frame/placeholder image or hidden in favor of static stack panel
  - Maneuver board animation disabled; optionally show a brief static highlighted path pulse and immediate state update only

## Testing and Validation

### Unit Tests

- `unitStackLayout` decomposition and visible-cap overflow math
  - Exact decomposition for counts `0-30`
  - Overflow label troop value correctness
  - Reserved 1-unit visible slot behavior when capped and remainder exists
- layout override fallback behavior for missing territory override
- maneuver animation render model decomposition for moved troop counts

### Component Tests

- GameBoard renders piece stacks for owned territories using faction asset registry
- GameBoard hides old troop badge and shows overflow label only when needed
- GameBoard keeps pending deployment badge visible and correctly layered
- CombatModal mounts prep clip in pre-roll phases and resolve clip during `showing-results`
- CombatModal still renders existing dice UI and result text unchanged
- reduced-motion mode renders static fallback instead of animated clip/movement
- Maneuver confirm triggers transient board animation payload from `App.tsx` and animation completes without blocking turn progression
- Conquest troop move flow remains unchanged (no maneuver animation accidentally triggers)
- Missing faction assets fall back gracefully (no crash)

## Manual Acceptance Scenarios

- Dense territory counts (e.g., `17`, `22`, `30`) remain readable on small territories
- Mixed faction ownership across board shows correct faction piece art
- Combat modal shows attacker/defender animated clips while existing dice animations still function
- Maneuver over long multi-hop path visibly travels along path and ends with correct updated stacks
- Reduced-motion OS setting disables animated playback/movement

## Assumptions / Non-Goals

- You will provide or generate final SVG assets later; implementation starts with placeholders.
- Asset licensing/provenance for sourced visuals is handled outside this implementation plan.
- Animated SVG files are trusted local assets and will not contain JavaScript.
- No server protocol changes are needed for this feature.
- Existing tooltip remains the canonical always-available exact troop count display.
- `useMemo` currently used in GameBoard can remain during this feature unless separately refactored.

## Implementation Order (Recommended)

1. Add static unit asset registry + placeholder assets.
2. Build `unitStackLayout` logic and tests.
3. Swap GameBoard troop badge rendering for `TerritoryUnitStack`.
4. Add territory layout overrides for visually problematic territories.
5. Add reduced-motion utility.
6. Add combat animation asset registry + `AnimatedSvgClip` + `CombatUnitAnimationPanel`.
7. Integrate combat clips into CombatModal state timeline.
8. Add `ManeuverAnimationEvent` capture in `App.tsx` and overlay rendering in GameBoard.
9. Add tests for maneuver animation trigger/fallback behavior.
10. Final polish pass with real assets and per-territory tuning.
