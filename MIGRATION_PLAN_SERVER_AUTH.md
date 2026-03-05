# Server Authority Migration Plan (Remaining Local Client Flow)

## Scope
This plan covers migration of still-local game flow to server-authoritative actions.
Already migrated: setup, recruit, attack source/target/dice selection, defender dice, resolve combat, confirm conquest.
Remaining local flow (target in this plan):
- `endAttackPhase`
- Maneuver phase: `selectManeuverSource`, `selectManeuverTarget`, `confirmManeuver`, `skipManeuver`, `returnToAttackPhase`
- Turn progression: `endTurn`
- Related derived state resets (first attack flag, selections, UI/server sync boundaries)

## Goals
1. All shared game-rule mutations happen on server only.
2. Client sends intents and renders server patches/full state.
3. No `stateChanges`-style bypasses anywhere.
4. Regression-safe rollout with deterministic tests.

## Architecture End-State
- Client:
  - UI-only local state: hover, modal open/close, slider position, toasts.
  - Intent dispatch via `sendGameAction(...)`.
  - Domain state hydrated from `game:stateUpdate` / `game:fullState`.
- Server:
  - Single authoritative reducer in `server/gameState.ts`.
  - Phase/subphase validation + ownership/path validation.
  - Deterministic transitions and patch emission.

## Phase Plan

### Phase A: End Attack Phase Migration
#### A1. Server reducer
- Implement `endAttackPhase` in `server/gameState.ts`:
  - Validate phase/subphase is attack-compatible (`IDLE`, `SELECT_ATTACK`, possibly post-combat idle states).
  - Transition to maneuver phase (`phase: MANEUVER`, `subPhase: SELECT_MANEUVER_SOURCE`).
  - Clear attack/combat transient fields.
- Include patch updates for all touched fields.

#### A2. Client wiring
- In `src/App.tsx`, replace local `endAttackPhase` call with:
  - `sendGameAction('endAttackPhase', {})`

#### A3. Tests
- Add server test cases:
  - happy path transition ATTACK -> MANEUVER
  - invalid phase rejection
  - transient state cleanup assertion

---

### Phase B: Maneuver Source/Target Selection Migration
#### B1. Server helpers
- Port/replicate maneuver validation logic server-side:
  - source ownership + troops >= 2
  - target ownership
  - pathfinding through owned territories only
- Reuse `src/data/territories.ts` graph (single source).

#### B2. Server reducers
- Implement:
  - `selectManeuverSource`
  - `selectManeuverTarget`
- Server stores selected source/target (and optional maneuver path for client display).
- Transition subphases:
  - `SELECT_MANEUVER_SOURCE` -> `SELECT_MANEUVER_TARGET` -> `SET_MANEUVER_TROOPS`

#### B3. Client wiring
- Replace local maneuver source/target calls in `App.tsx` with intents.
- Keep troop slider value as UI-local only until confirm.

#### B4. Tests
- Add cases:
  - valid source/target path
  - no-path rejection
  - same-territory rejection
  - enemy/unoccupied traversal rejection

---

### Phase C: Confirm/Skip Maneuver + End Turn Migration
#### C1. Server reducers
- Implement `confirmManeuver`:
  - Validate source/target/troop count.
  - Move troops.
  - Clear maneuver state.
  - Trigger end-turn progression server-side.
- Implement `skipManeuver`:
  - Clear maneuver state.
  - Trigger end-turn progression server-side.

#### C2. End-turn reducer
- Implement `endTurn` server-side (called directly or internally):
  - Advance to next non-eliminated player.
  - Increment turn counter when wrapping.
  - Recompute reinforcements.
  - Reset turn-lifecycle flags (`conqueredThisTurn`, first attack flag, transient selection states).
  - Return phase to recruit (`PLACE_TROOPS`).

#### C3. Client wiring
- Replace local `confirmManeuver`, `skipManeuver`, `endTurn` usage with intents.
- Remove local mutation dependencies from `App.tsx` and store actions for these flows.

#### C4. Tests
- Add multi-step turn-cycle tests:
  - maneuver confirm -> next player recruit
  - maneuver skip -> next player recruit
  - elimination skip logic in turn rotation
  - turn counter wrap behavior

---

### Phase D: Cleanup and Hardening
#### D1. Store cleanup
- Mark local mutation actions as legacy/deprecated where migrated.
- Ensure no UI path can mutate domain state directly for migrated flows.

#### D2. Type and protocol hardening
- Narrow action payload types (discriminated union payloads).
- Add runtime schema validation (Zod) for incoming server actions.

#### D3. Observability
- Add structured logs around action apply failures.
- Include action type + player + phase/subphase in rejection logs.

#### D4. Optional safety
- Add idempotency/replay guards for duplicate action submissions.

## Testing Strategy

### Unit tests (server reducer)
- Continue `tests/unit/serverGameActions.test.ts` and split by phase if needed.
- Deterministic dice via `vi.spyOn(Math, 'random')` where combat is involved.

### Integration tests (next step)
- Add socket-driven tests:
  - client intent -> server patch -> client state convergence.
- Verify out-of-turn and stale-version rejection behavior.

### Regression checks each phase
- `npm run test:unit`
- `npx tsc -p server/tsconfig.json`
- `npm run build`

## Rollout Order (Recommended)
1. Phase A (end attack)
2. Phase B (maneuver select)
3. Phase C (confirm/skip + end turn)
4. Phase D (cleanup/hardening)

This order minimizes churn while preserving playable flow after each step.

## Risk Notes
- Biggest risk: mixed local/server mutation during transition.
  - Mitigation: migrate complete action families together and remove local call sites immediately.
- Biggest gameplay risk: turn progression bugs.
  - Mitigation: explicit end-turn test matrix before moving to next phase.

## Definition of Done
- All shared gameplay transitions from recruit through end-turn are server-authoritative.
- Client only dispatches intents and renders server state.
- No remaining local reducer calls for migrated actions in `src/App.tsx` path.
- Tests cover happy path + invalid actions for each migrated action.
