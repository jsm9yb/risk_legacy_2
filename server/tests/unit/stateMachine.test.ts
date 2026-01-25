/**
 * State Machine Unit Tests
 * Tests for: phase transitions, state validation, turn management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createGameState,
  transition,
  validateAction,
  getValidActions,
  advanceTurn,
} from '../../src/engine/stateMachine';
import { GameState, GamePhase, SubPhase, Action } from '../../src/types';

describe('State Machine', () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = createGameState({
      players: [
        { id: 1, name: 'Player 1', factionId: 'khan' },
        { id: 2, name: 'Player 2', factionId: 'bear' },
        { id: 3, name: 'Player 3', factionId: 'mechaniker' },
      ],
    });
  });

  // ============================================
  // TOP-LEVEL STATE TRANSITIONS
  // ============================================
  describe('Top-Level States', () => {
    it('should start in LOBBY state', () => {
      const newGame = createGameState({ players: [] });
      expect(newGame.status).toBe('lobby');
    });

    it('should transition LOBBY -> SETUP when game starts', () => {
      gameState.status = 'lobby';

      const result = transition(gameState, { type: 'START_GAME' });

      expect(result.status).toBe('setup');
      expect(result.phase).toBe('SCAR_PLACEMENT');
    });

    it('should transition SETUP -> ACTIVE when setup completes', () => {
      gameState.status = 'setup';
      gameState.phase = 'HQ_PLACEMENT';
      gameState.setupComplete = true;

      const result = transition(gameState, { type: 'COMPLETE_SETUP' });

      expect(result.status).toBe('active');
      expect(result.phase).toBe('TURN_START');
    });

    it('should transition ACTIVE -> FINISHED on victory', () => {
      gameState.status = 'active';

      const result = transition(gameState, { type: 'VICTORY', winnerId: 1 });

      expect(result.status).toBe('finished');
      expect(result.winnerId).toBe(1);
    });

    it('should transition FINISHED -> WRITE_PHASE for campaign games', () => {
      gameState.status = 'finished';
      gameState.isCampaign = true;

      const result = transition(gameState, { type: 'START_WRITE_PHASE' });

      expect(result.phase).toBe('WINNER_REWARDS');
    });
  });

  // ============================================
  // SETUP PHASE TRANSITIONS
  // ============================================
  describe('Setup Phase Transitions', () => {
    beforeEach(() => {
      gameState.status = 'setup';
    });

    describe('Pre-Draft Flow', () => {
      it('should follow: SCAR_PLACEMENT -> ROLL_FOR_ORDER -> FACTION_SELECTION -> HQ_PLACEMENT', () => {
        gameState.phase = 'SCAR_PLACEMENT';
        gameState.scarPlacementComplete = true;

        let result = transition(gameState, { type: 'COMPLETE_SCAR_PLACEMENT' });
        expect(result.phase).toBe('ROLL_FOR_ORDER');

        result.rollsComplete = true;
        result = transition(result, { type: 'COMPLETE_ROLLS' });
        expect(result.phase).toBe('FACTION_SELECTION');

        result.factionSelectionComplete = true;
        result = transition(result, { type: 'COMPLETE_FACTION_SELECTION' });
        expect(result.phase).toBe('HQ_PLACEMENT');
      });
    });

    describe('Post-Draft Flow (after 9th Minor City)', () => {
      beforeEach(() => {
        gameState.draftPacketOpened = true;
      });

      it('should follow: SCAR_PLACEMENT -> DRAFT_PHASE -> HQ_PLACEMENT', () => {
        gameState.phase = 'SCAR_PLACEMENT';
        gameState.scarPlacementComplete = true;

        let result = transition(gameState, { type: 'COMPLETE_SCAR_PLACEMENT' });
        expect(result.phase).toBe('DRAFT_PHASE');

        result.draftComplete = true;
        result = transition(result, { type: 'COMPLETE_DRAFT' });
        expect(result.phase).toBe('HQ_PLACEMENT');
      });

      it('should handle snake draft order correctly', () => {
        gameState.phase = 'DRAFT_PHASE';
        gameState.draftRound = 1;
        gameState.draftPosition = 0; // Player A picks first

        // Round 1: A -> B -> C -> D -> E
        const picks = ['A', 'B', 'C', 'D', 'E'];
        picks.forEach((_, i) => {
          expect(gameState.draftPosition).toBe(i);
          gameState = transition(gameState, { type: 'DRAFT_PICK' });
        });

        // Round 2: E -> D -> C -> B -> A (reversed)
        expect(gameState.draftRound).toBe(2);
        expect(gameState.draftPosition).toBe(4); // E picks first in round 2
      });
    });
  });

  // ============================================
  // ACTIVE PHASE TRANSITIONS
  // ============================================
  describe('Active Phase Transitions', () => {
    beforeEach(() => {
      gameState.status = 'active';
      gameState.activePlayerId = 1;
    });

    describe('Turn Start', () => {
      it('should process BIOHAZARD_ATTRITION before other actions', () => {
        gameState.phase = 'TURN_START';
        gameState.territories = new Map([
          [1, { ownerId: 1, scarId: 'biohazard', troopCount: 5 }],
        ]);

        const result = transition(gameState, { type: 'PROCESS_TURN_START' });

        expect(result.territories.get(1)!.troopCount).toBe(4); // Lost 1 troop
      });

      it('should handle JOIN_WAR for eliminated players', () => {
        gameState.phase = 'TURN_START';
        gameState.players[0].isEliminated = true;
        gameState.players[0].canRejoin = true;

        const result = transition(gameState, { type: 'PROCESS_TURN_START' });

        expect(result.subPhase).toBe('JOIN_WAR');
      });

      it('should skip to RECRUIT if player is not eliminated', () => {
        gameState.phase = 'TURN_START';

        const result = transition(gameState, { type: 'PROCESS_TURN_START' });

        expect(result.phase).toBe('RECRUIT');
      });
    });

    describe('Recruit Phase', () => {
      beforeEach(() => {
        gameState.phase = 'RECRUIT';
      });

      it('should allow BUY_STARS with 4 cards', () => {
        gameState.subPhase = 'BUY_STARS';
        gameState.players[0].cards = [1, 2, 3, 4];

        const result = validateAction(gameState, {
          type: 'TRADE_FOR_STAR',
          cardIds: [1, 2, 3, 4],
          playerId: 1,
        });

        expect(result.valid).toBe(true);
      });

      it('should progress: CALCULATE -> CARD_TRADE -> PLACE_TROOPS', () => {
        gameState.subPhase = 'CALCULATE';

        let result = transition(gameState, { type: 'COMPLETE_CALCULATION' });
        expect(result.subPhase).toBe('CARD_TRADE');

        result = transition(result, { type: 'SKIP_TRADE' });
        expect(result.subPhase).toBe('PLACE_TROOPS');

        result.troopsToPlace = 0;
        result = transition(result, { type: 'COMPLETE_PLACEMENT' });
        expect(result.phase).toBe('ATTACK');
      });

      it('should require all troops placed before advancing', () => {
        gameState.subPhase = 'PLACE_TROOPS';
        gameState.troopsToPlace = 5;

        const result = transition(gameState, { type: 'COMPLETE_PLACEMENT' });

        expect(result.phase).toBe('RECRUIT'); // Stays in recruit
        expect(result.error).toBe('Must place all troops');
      });
    });

    describe('Attack Phase', () => {
      beforeEach(() => {
        gameState.phase = 'ATTACK';
        gameState.subPhase = 'IDLE';
      });

      it('should follow combat flow: IDLE -> SELECT -> ATTACKER_DICE -> DEFENDER_DICE -> MISSILE_WINDOW -> RESOLVE', () => {
        // Declare attack
        let result = transition(gameState, {
          type: 'DECLARE_ATTACK',
          fromId: 1,
          toId: 2,
        });
        expect(result.subPhase).toBe('SELECT_ATTACK');

        // Attacker chooses dice
        result = transition(result, { type: 'CHOOSE_ATTACK_DICE', count: 3 });
        expect(result.subPhase).toBe('DEFENDER_DICE');

        // Defender chooses dice
        result = transition(result, { type: 'CHOOSE_DEFEND_DICE', count: 2 });
        expect(result.subPhase).toBe('MISSILE_WINDOW');

        // Missile window expires
        result = transition(result, { type: 'MISSILE_WINDOW_EXPIRE' });
        expect(result.subPhase).toBe('RESOLVE');
      });

      it('should transition to TROOP_MOVE after conquest', () => {
        gameState.subPhase = 'RESOLVE';
        gameState.combatResult = { conquered: true };

        const result = transition(gameState, { type: 'RESOLVE_COMBAT' });

        expect(result.subPhase).toBe('TROOP_MOVE');
      });

      it('should return to IDLE after non-conquest combat', () => {
        gameState.subPhase = 'RESOLVE';
        gameState.combatResult = { conquered: false };

        const result = transition(gameState, { type: 'RESOLVE_COMBAT' });

        expect(result.subPhase).toBe('IDLE');
      });

      it('should check victory after each combat resolution', () => {
        gameState.subPhase = 'RESOLVE';
        gameState.players[0].redStars = 4;

        const result = transition(gameState, { type: 'RESOLVE_COMBAT' });

        expect(result.status).toBe('finished');
        expect(result.winnerId).toBe(1);
      });

      it('should check mission completion after combat', () => {
        gameState.subPhase = 'RESOLVE';
        gameState.activeMissions = [{ id: 1, predicate: 'CITIES_OWNED >= 4' }];
        gameState.players[0].citiesOwned = 4;

        const result = transition(gameState, { type: 'RESOLVE_COMBAT' });

        expect(result.subPhase).toBe('CHECK_MISSION');
      });

      it('should allow ending attack phase from IDLE', () => {
        gameState.subPhase = 'IDLE';

        const result = transition(gameState, { type: 'END_ATTACK_PHASE' });

        expect(result.phase).toBe('MANEUVER');
      });

      it('should NOT allow ending attack phase mid-combat', () => {
        gameState.subPhase = 'DEFENDER_DICE';

        const result = validateAction(gameState, { type: 'END_ATTACK_PHASE', playerId: 1 });

        expect(result.valid).toBe(false);
      });
    });

    describe('Maneuver Phase', () => {
      beforeEach(() => {
        gameState.phase = 'MANEUVER';
      });

      it('should allow one maneuver per turn', () => {
        gameState.maneuverUsed = false;

        let result = validateAction(gameState, {
          type: 'EXECUTE_MANEUVER',
          fromId: 1,
          toId: 2,
          count: 3,
          playerId: 1,
        });
        expect(result.valid).toBe(true);

        gameState.maneuverUsed = true;
        result = validateAction(gameState, {
          type: 'EXECUTE_MANEUVER',
          fromId: 1,
          toId: 2,
          count: 3,
          playerId: 1,
        });
        expect(result.valid).toBe(false);
      });

      it('should allow skipping maneuver', () => {
        const result = transition(gameState, { type: 'SKIP_MANEUVER' });

        expect(result.phase).toBe('TURN_END');
      });

      describe('Saharan Republic Scattered Power', () => {
        it('should allow maneuver during attack phase instead', () => {
          gameState.phase = 'ATTACK';
          gameState.subPhase = 'IDLE';
          gameState.players[0].activePower = 'scattered';
          gameState.scatteredManeuverUsed = false;

          const result = validateAction(gameState, {
            type: 'EXECUTE_MANEUVER',
            fromId: 1,
            toId: 2,
            count: 3,
            playerId: 1,
          });

          expect(result.valid).toBe(true);
        });

        it('should only allow one scattered maneuver per turn', () => {
          gameState.phase = 'ATTACK';
          gameState.players[0].activePower = 'scattered';
          gameState.scatteredManeuverUsed = true;

          const result = validateAction(gameState, {
            type: 'EXECUTE_MANEUVER',
            playerId: 1,
          });

          expect(result.valid).toBe(false);
        });
      });
    });

    describe('Turn End', () => {
      beforeEach(() => {
        gameState.phase = 'TURN_END';
      });

      it('should draw card if player conquered this turn', () => {
        gameState.players[0].conqueredThisTurn = true;
        gameState.deck = { drawPile: [1, 2, 3] };

        const result = transition(gameState, { type: 'PROCESS_TURN_END' });

        expect(result.players[0].cards).toContain(expect.any(Number));
        expect(result.players[0].conqueredThisTurn).toBe(false);
      });

      it('should NOT draw card if player only expanded (not conquered)', () => {
        gameState.players[0].conqueredThisTurn = false;

        const result = transition(gameState, { type: 'PROCESS_TURN_END' });

        expect(result.players[0].cards.length).toBe(0);
      });

      it('should check for event card trigger', () => {
        gameState.eventDeckActive = true;
        gameState.players[0].conqueredThisTurn = true;
        gameState.lastDrawnCard = { coinValue: 4 }; // >= threshold of 3

        const result = transition(gameState, { type: 'PROCESS_TURN_END' });

        expect(result.eventCardDrawn).toBeDefined();
      });

      it('should check packet triggers', () => {
        gameState.campaign = {
          minorCitiesCount: 9, // Triggers draft packet
          packetStates: { MINOR_CITIES_9: 'sealed' },
        };

        const result = transition(gameState, { type: 'PROCESS_TURN_END' });

        expect(result.packetOpened).toBe('MINOR_CITIES_9');
      });

      it('should advance to next player', () => {
        gameState.activePlayerId = 1;
        gameState.turnOrder = [1, 2, 3];

        const result = transition(gameState, { type: 'ADVANCE_TURN' });

        expect(result.activePlayerId).toBe(2);
        expect(result.phase).toBe('TURN_START');
      });

      it('should wrap around to first player after last', () => {
        gameState.activePlayerId = 3;
        gameState.turnOrder = [1, 2, 3];
        gameState.currentTurn = 1;

        const result = transition(gameState, { type: 'ADVANCE_TURN' });

        expect(result.activePlayerId).toBe(1);
        expect(result.currentTurn).toBe(2);
      });

      it('should skip eliminated players', () => {
        gameState.activePlayerId = 1;
        gameState.turnOrder = [1, 2, 3];
        gameState.players[1].isEliminated = true;
        gameState.players[1].canRejoin = false;

        const result = transition(gameState, { type: 'ADVANCE_TURN' });

        expect(result.activePlayerId).toBe(3); // Skipped player 2
      });
    });
  });

  // ============================================
  // WRITE PHASE TRANSITIONS
  // ============================================
  describe('Write Phase Transitions', () => {
    beforeEach(() => {
      gameState.status = 'finished';
      gameState.isCampaign = true;
      gameState.winnerId = 1;
    });

    it('should follow: WINNER_REWARDS -> LOSER_REWARDS -> SIGN_BOARD -> PREPARE_NEXT_GAME', () => {
      gameState.phase = 'WINNER_REWARDS';

      let result = transition(gameState, { type: 'COMPLETE_WINNER_REWARDS' });
      expect(result.phase).toBe('LOSER_REWARDS');

      result.loserRewardsComplete = true;
      result = transition(result, { type: 'COMPLETE_LOSER_REWARDS' });
      expect(result.phase).toBe('SIGN_BOARD');

      result = transition(result, { type: 'COMPLETE_SIGNING' });
      expect(result.phase).toBe('PREPARE_NEXT_GAME');
    });

    it('should trigger CAMPAIGN_END after game 15', () => {
      gameState.campaign = { gameCount: 15 };
      gameState.phase = 'SIGN_BOARD';

      const result = transition(gameState, { type: 'COMPLETE_SIGNING' });

      expect(result.phase).toBe('NAME_PLANET');
    });
  });

  // ============================================
  // ACTION VALIDATION
  // ============================================
  describe('validateAction', () => {
    beforeEach(() => {
      gameState.status = 'active';
      gameState.activePlayerId = 1;
    });

    it('should reject actions from non-active player', () => {
      const result = validateAction(gameState, {
        type: 'DEPLOY_TROOP',
        territoryId: 1,
        count: 1,
        playerId: 2, // Not active player
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('NOT_YOUR_TURN');
    });

    it('should reject actions invalid for current phase', () => {
      gameState.phase = 'RECRUIT';

      const result = validateAction(gameState, {
        type: 'DECLARE_ATTACK',
        fromId: 1,
        toId: 2,
        playerId: 1,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_PHASE');
    });

    it('should provide list of valid actions for current state', () => {
      gameState.phase = 'ATTACK';
      gameState.subPhase = 'IDLE';

      const actions = getValidActions(gameState);

      expect(actions).toContain('DECLARE_ATTACK');
      expect(actions).toContain('END_ATTACK_PHASE');
      expect(actions).not.toContain('EXECUTE_MANEUVER');
    });

    it('should allow defender to respond during DEFENDER_DICE', () => {
      gameState.phase = 'ATTACK';
      gameState.subPhase = 'DEFENDER_DICE';
      gameState.currentCombat = { defenderId: 2 };

      const result = validateAction(gameState, {
        type: 'CHOOSE_DEFEND_DICE',
        count: 2,
        playerId: 2, // Defender, not active player
      });

      expect(result.valid).toBe(true);
    });

    it('should allow any player to use missile during MISSILE_WINDOW', () => {
      gameState.phase = 'ATTACK';
      gameState.subPhase = 'MISSILE_WINDOW';
      gameState.players[1].missiles = 1; // Player 2 has missiles

      const result = validateAction(gameState, {
        type: 'USE_MISSILE',
        dieIndex: 0,
        playerId: 2,
      });

      expect(result.valid).toBe(true);
    });
  });

  // ============================================
  // TIMEOUT HANDLING
  // ============================================
  describe('Timeout Handling', () => {
    it('should auto-select max dice for defender after 10s', () => {
      gameState.phase = 'ATTACK';
      gameState.subPhase = 'DEFENDER_DICE';
      gameState.currentCombat = { defenderTroops: 5 };

      const result = transition(gameState, { type: 'DEFENDER_TIMEOUT' });

      expect(result.currentCombat.defenderDice).toBe(2); // Max allowed
      expect(result.subPhase).toBe('MISSILE_WINDOW');
    });

    it('should auto-select 1 die for defender with 1 troop', () => {
      gameState.phase = 'ATTACK';
      gameState.subPhase = 'DEFENDER_DICE';
      gameState.currentCombat = { defenderTroops: 1 };

      const result = transition(gameState, { type: 'DEFENDER_TIMEOUT' });

      expect(result.currentCombat.defenderDice).toBe(1);
    });

    it('should proceed without missiles after window expires', () => {
      gameState.phase = 'ATTACK';
      gameState.subPhase = 'MISSILE_WINDOW';

      const result = transition(gameState, { type: 'MISSILE_WINDOW_EXPIRE' });

      expect(result.subPhase).toBe('RESOLVE');
    });

    it('should reset missile window to 3s after missile use', () => {
      gameState.phase = 'ATTACK';
      gameState.subPhase = 'MISSILE_WINDOW';
      gameState.missileWindowDuration = 5000;

      const result = transition(gameState, { type: 'USE_MISSILE', dieIndex: 0 });

      expect(result.missileWindowDuration).toBe(3000);
      expect(result.subPhase).toBe('MISSILE_WINDOW'); // Stays in window
    });
  });

  // ============================================
  // VICTORY CONDITIONS
  // ============================================
  describe('Victory Conditions', () => {
    beforeEach(() => {
      gameState.status = 'active';
    });

    it('should trigger victory at 4 red stars', () => {
      gameState.players[0].redStars = 3;

      const result = transition(gameState, {
        type: 'AWARD_STAR',
        playerId: 1,
        source: 'HQ_CAPTURE',
      });

      expect(result.players[0].redStars).toBe(4);
      expect(result.status).toBe('finished');
      expect(result.winnerId).toBe(1);
    });

    it('should trigger victory when only one player remains', () => {
      gameState.players[1].isEliminated = true;
      gameState.players[1].canRejoin = false;
      gameState.players[2].isEliminated = true;
      gameState.players[2].canRejoin = false;

      const result = transition(gameState, { type: 'CHECK_VICTORY' });

      expect(result.status).toBe('finished');
      expect(result.winnerId).toBe(1);
    });

    it('should trigger victory immediately, even mid-combat', () => {
      gameState.phase = 'ATTACK';
      gameState.subPhase = 'RESOLVE';
      gameState.players[0].redStars = 3;

      // Combat results in star gain (e.g., capturing HQ)
      const result = transition(gameState, {
        type: 'RESOLVE_COMBAT',
        starGained: true,
      });

      expect(result.status).toBe('finished');
    });
  });

  // ============================================
  // ELIMINATION & JOIN THE WAR
  // ============================================
  describe('Elimination & Respawn', () => {
    it('should mark player as eliminated when losing all territories', () => {
      gameState.players[0].territories = [];

      const result = transition(gameState, { type: 'CHECK_ELIMINATION', playerId: 1 });

      expect(result.players[0].isEliminated).toBe(true);
    });

    it('should allow eliminated player to rejoin if legal territory exists', () => {
      gameState.players[0].isEliminated = true;
      gameState.territories = new Map([
        [1, { ownerId: null, scarId: null, cityTier: 0 }], // Legal territory
      ]);

      const result = transition(gameState, { type: 'CHECK_REJOIN_ELIGIBILITY', playerId: 1 });

      expect(result.players[0].canRejoin).toBe(true);
    });

    it('should NOT allow rejoin if no legal territories exist', () => {
      gameState.players[0].isEliminated = true;
      // All territories have marks or are occupied
      gameState.territories = new Map([
        [1, { ownerId: 2, scarId: null }],
        [2, { ownerId: null, scarId: 'bunker' }],
      ]);

      const result = transition(gameState, { type: 'CHECK_REJOIN_ELIGIBILITY', playerId: 1 });

      expect(result.players[0].canRejoin).toBe(false);
    });

    it('should place half starting troops (rounded down) on rejoin', () => {
      gameState.players[0].isEliminated = true;
      gameState.players[0].canRejoin = true;
      gameState.players[0].startingTroops = 8;

      const result = transition(gameState, {
        type: 'JOIN_WAR',
        playerId: 1,
        territoryId: 5,
      });

      expect(result.territories.get(5)!.troopCount).toBe(4); // floor(8/2)
      expect(result.territories.get(5)!.ownerId).toBe(1);
      expect(result.players[0].isEliminated).toBe(false);
    });

    it('should transfer cards to eliminator on elimination', () => {
      gameState.players[1].cards = [1, 2, 3];

      const result = transition(gameState, {
        type: 'ELIMINATE_PLAYER',
        eliminatedId: 2,
        eliminatorId: 1,
      });

      expect(result.players[0].cards).toContain(1);
      expect(result.players[0].cards).toContain(2);
      expect(result.players[0].cards).toContain(3);
      expect(result.players[1].cards).toHaveLength(0);
    });
  });
});
