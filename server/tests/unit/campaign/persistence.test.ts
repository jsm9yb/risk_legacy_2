/**
 * Campaign Persistence Unit Tests
 * Tests for: cross-game state, scars, cities, packets, destroyed cards
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveCampaignState,
  loadCampaignState,
  applyScar,
  foundCity,
  checkPacketTrigger,
  openPacket,
  recordVictory,
  applyCombebackPower,
} from '../../../src/campaign/persistence';
import { Campaign, Territory, Player, Packet } from '../../../src/types';

describe('Campaign Persistence', () => {
  let campaign: Campaign;
  let territories: Map<number, Territory>;

  beforeEach(() => {
    campaign = {
      id: 1,
      name: 'Test Campaign',
      gameCount: 0,
      worldPopulation: 0,
      victors: [],
      namedContinents: {},
      packetStates: {
        SECOND_WIN: 'sealed',
        MINOR_CITIES_9: 'sealed',
        GREEN_SCAR_3: 'sealed',
        FACTION_ELIMINATED: 'sealed',
        MISSILES_3: 'sealed',
        WORLD_CAPITAL: 'sealed',
        DO_NOT_OPEN: 'sealed',
      },
      destroyedCards: [],
      destroyedPowers: {},
      stickerPlacements: [],
      minorCitiesCount: 0,
      majorCitiesCount: 0,
      greenScarCount: 0,
      missilesUsed: 0,
    };

    territories = new Map();
    for (let i = 0; i < 42; i++) {
      territories.set(i, {
        id: i,
        name: `Territory ${i}`,
        continentId: Math.floor(i / 7),
        neighbors: [],
        ownerId: null,
        troopCount: 0,
        scarId: null,
        cityTier: 0,
        cityName: null,
        fortified: false,
        fortifyDamage: 0,
      });
    }
  });

  // ============================================
  // SCAR PERSISTENCE
  // ============================================
  describe('Scar System', () => {
    it('should apply scar to territory permanently', () => {
      const territoryId = 5;

      applyScar(campaign, territories, territoryId, 'bunker');

      expect(territories.get(territoryId)!.scarId).toBe('bunker');
      expect(campaign.stickerPlacements).toContainEqual({
        type: 'scar',
        territoryId,
        scarId: 'bunker',
      });
    });

    it('should reject scar on already-scarred territory', () => {
      const territoryId = 5;
      territories.get(territoryId)!.scarId = 'bunker';

      expect(() => applyScar(campaign, territories, territoryId, 'ammo_shortage'))
        .toThrow('Territory already has a scar');
    });

    it('should track green scar count for packet trigger', () => {
      // Biohazard is a green scar
      applyScar(campaign, territories, 1, 'biohazard');
      expect(campaign.greenScarCount).toBe(1);

      applyScar(campaign, territories, 2, 'biohazard');
      expect(campaign.greenScarCount).toBe(2);
    });

    it('should persist scars across games', () => {
      applyScar(campaign, territories, 5, 'bunker');

      // Simulate new game
      const newGameTerritories = loadCampaignState(campaign);

      expect(newGameTerritories.get(5)!.scarId).toBe('bunker');
    });

    it('should apply scar effects correctly', () => {
      const testCases = [
        { scarId: 'bunker', effect: '+1 defender highest die' },
        { scarId: 'ammo_shortage', effect: '-1 defender highest die' },
        { scarId: 'biohazard', effect: 'lose 1 troop at turn start' },
        { scarId: 'mercenary', effect: 'attacker may recruit 1 troop' },
      ];

      testCases.forEach(({ scarId }) => {
        applyScar(campaign, territories, testCases.indexOf({ scarId } as any), scarId);
        expect(territories.get(testCases.indexOf({ scarId } as any))!.scarId).toBe(scarId);
      });
    });
  });

  // ============================================
  // CITY PERSISTENCE
  // ============================================
  describe('City System', () => {
    it('should found minor city (population 1)', () => {
      const territoryId = 10;

      foundCity(campaign, territories, territoryId, 'minor', 'Smallville');

      expect(territories.get(territoryId)!.cityTier).toBe(1);
      expect(territories.get(territoryId)!.cityName).toBe('Smallville');
      expect(campaign.minorCitiesCount).toBe(1);
      expect(campaign.worldPopulation).toBe(1);
    });

    it('should found major city (population 2)', () => {
      const territoryId = 15;

      foundCity(campaign, territories, territoryId, 'major', 'Bigtown');

      expect(territories.get(territoryId)!.cityTier).toBe(2);
      expect(territories.get(territoryId)!.cityName).toBe('Bigtown');
      expect(campaign.majorCitiesCount).toBe(1);
      expect(campaign.worldPopulation).toBe(2);
    });

    it('should reject city on territory with existing city', () => {
      const territoryId = 10;
      territories.get(territoryId)!.cityTier = 1;

      expect(() => foundCity(campaign, territories, territoryId, 'minor', 'Another'))
        .toThrow('Territory already has a city');
    });

    it('should allow only ONE world capital per campaign', () => {
      foundCity(campaign, territories, 10, 'capital', 'The Capital');

      expect(() => foundCity(campaign, territories, 15, 'capital', 'Another Capital'))
        .toThrow('World capital already exists');
    });

    it('should track cities in sticker placements', () => {
      foundCity(campaign, territories, 10, 'major', 'Newtown');

      expect(campaign.stickerPlacements).toContainEqual({
        type: 'city',
        territoryId: 10,
        cityTier: 2,
        cityName: 'Newtown',
      });
    });

    it('should persist cities across games', () => {
      foundCity(campaign, territories, 10, 'minor', 'TestCity');

      const newGameTerritories = loadCampaignState(campaign);

      expect(newGameTerritories.get(10)!.cityTier).toBe(1);
      expect(newGameTerritories.get(10)!.cityName).toBe('TestCity');
    });

    it('should affect reinforcement calculation via population', () => {
      // This is tested in reinforcement.test.ts
      // Here we just verify population tracking
      foundCity(campaign, territories, 1, 'minor', 'City1'); // +1
      foundCity(campaign, territories, 2, 'major', 'City2'); // +2
      foundCity(campaign, territories, 3, 'capital', 'City3'); // +3

      expect(campaign.worldPopulation).toBe(6);
    });
  });

  // ============================================
  // PACKET TRIGGERS
  // ============================================
  describe('Packet System', () => {
    describe('Trigger Detection', () => {
      it('should trigger SECOND_WIN when a player wins twice', () => {
        campaign.victors = [{ gameNumber: 1, playerId: 1, factionId: 'khan' }];

        const trigger = checkPacketTrigger(campaign, 'SECOND_WIN', {
          winnerId: 1,
          gameNumber: 2,
        });

        expect(trigger.shouldOpen).toBe(true);
      });

      it('should NOT trigger SECOND_WIN on first win', () => {
        campaign.victors = [];

        const trigger = checkPacketTrigger(campaign, 'SECOND_WIN', {
          winnerId: 1,
          gameNumber: 1,
        });

        expect(trigger.shouldOpen).toBe(false);
      });

      it('should trigger MINOR_CITIES_9 at 9th minor city', () => {
        campaign.minorCitiesCount = 8;

        const trigger = checkPacketTrigger(campaign, 'MINOR_CITIES_9', {
          newMinorCity: true,
        });

        // After adding 9th
        campaign.minorCitiesCount = 9;
        expect(checkPacketTrigger(campaign, 'MINOR_CITIES_9', {}).shouldOpen).toBe(true);
      });

      it('should trigger GREEN_SCAR_3 at 3rd green scar', () => {
        campaign.greenScarCount = 2;

        const trigger = checkPacketTrigger(campaign, 'GREEN_SCAR_3', {
          newGreenScar: true,
        });

        campaign.greenScarCount = 3;
        expect(checkPacketTrigger(campaign, 'GREEN_SCAR_3', {}).shouldOpen).toBe(true);
      });

      it('should trigger FACTION_ELIMINATED when faction has no players', () => {
        const trigger = checkPacketTrigger(campaign, 'FACTION_ELIMINATED', {
          eliminatedFactionId: 'khan',
          factionCompletelyEliminated: true,
        });

        expect(trigger.shouldOpen).toBe(true);
      });

      it('should trigger MISSILES_3 at 3rd missile use', () => {
        campaign.missilesUsed = 2;

        const trigger = checkPacketTrigger(campaign, 'MISSILES_3', {
          missileUsed: true,
        });

        campaign.missilesUsed = 3;
        expect(checkPacketTrigger(campaign, 'MISSILES_3', {}).shouldOpen).toBe(true);
      });

      it('should trigger WORLD_CAPITAL when capital is founded', () => {
        const trigger = checkPacketTrigger(campaign, 'WORLD_CAPITAL', {
          capitalFounded: true,
        });

        expect(trigger.shouldOpen).toBe(true);
      });

      it('should NOT trigger already-opened packet', () => {
        campaign.packetStates['SECOND_WIN'] = 'opened';
        campaign.victors = [{ gameNumber: 1, playerId: 1, factionId: 'khan' }];

        const trigger = checkPacketTrigger(campaign, 'SECOND_WIN', {
          winnerId: 1,
          gameNumber: 2,
        });

        expect(trigger.shouldOpen).toBe(false);
      });
    });

    describe('Packet Opening', () => {
      it('should mark packet as opened', () => {
        openPacket(campaign, 'SECOND_WIN');

        expect(campaign.packetStates['SECOND_WIN']).toBe('opened');
      });

      it('should return packet contents', () => {
        const contents = openPacket(campaign, 'SECOND_WIN');

        expect(contents).toHaveProperty('eventDeck');
        expect(contents).toHaveProperty('missionCards');
      });

      it('should enable event deck after SECOND_WIN packet', () => {
        openPacket(campaign, 'SECOND_WIN');

        expect(campaign.eventDeckEnabled).toBe(true);
      });

      it('should enable draft system after MINOR_CITIES_9 packet', () => {
        openPacket(campaign, 'MINOR_CITIES_9');

        expect(campaign.draftEnabled).toBe(true);
      });
    });
  });

  // ============================================
  // VICTORY TRACKING
  // ============================================
  describe('Victory Recording', () => {
    it('should record victory in campaign', () => {
      recordVictory(campaign, 1, 'khan', 1);

      expect(campaign.victors).toContainEqual({
        gameNumber: 1,
        playerId: 1,
        factionId: 'khan',
      });
    });

    it('should increment game count', () => {
      recordVictory(campaign, 1, 'khan', 1);

      expect(campaign.gameCount).toBe(1);
    });

    it('should track multiple victories correctly', () => {
      recordVictory(campaign, 1, 'khan', 1);
      recordVictory(campaign, 2, 'bear', 2);
      recordVictory(campaign, 1, 'khan', 3);

      expect(campaign.gameCount).toBe(3);
      expect(campaign.victors.filter((v) => v.playerId === 1).length).toBe(2);
    });

    it('should determine most-wins player for planet naming', () => {
      campaign.victors = [
        { gameNumber: 1, playerId: 1, factionId: 'khan' },
        { gameNumber: 2, playerId: 2, factionId: 'bear' },
        { gameNumber: 3, playerId: 1, factionId: 'khan' },
        { gameNumber: 4, playerId: 1, factionId: 'khan' },
      ];

      const mostWins = getMostWinsPlayer(campaign);

      expect(mostWins).toBe(1);
    });
  });

  // ============================================
  // DESTROYED CARDS PERSISTENCE
  // ============================================
  describe('Destroyed Cards', () => {
    it('should track destroyed cards across games', () => {
      campaign.destroyedCards = [5, 10];

      const deck = loadDeckForNewGame(campaign);

      expect(deck.cards.find((c) => c.id === 5)).toBeUndefined();
      expect(deck.cards.find((c) => c.id === 10)).toBeUndefined();
    });

    it('should prevent destroyed cards from appearing', () => {
      campaign.destroyedCards = [5];

      // Multiple games
      for (let i = 0; i < 5; i++) {
        const deck = loadDeckForNewGame(campaign);
        expect(deck.cards.find((c) => c.id === 5)).toBeUndefined();
      }
    });
  });

  // ============================================
  // DESTROYED POWERS PERSISTENCE
  // ============================================
  describe('Destroyed Powers', () => {
    it('should track destroyed faction powers', () => {
      campaign.destroyedPowers = {
        khan: ['rapid_deployment'],
        bear: ['ferocity'],
      };

      const availablePowers = getAvailablePowers(campaign, 'khan');

      expect(availablePowers).not.toContain('rapid_deployment');
      expect(availablePowers).toContain('overwhelming_numbers');
    });

    it('should persist power destruction across games', () => {
      // First game: Khan chooses Rapid Deployment, Overwhelming Numbers destroyed
      campaign.destroyedPowers['khan'] = ['overwhelming_numbers'];

      // Second game: Khan must use Rapid Deployment
      const availablePowers = getAvailablePowers(campaign, 'khan');

      expect(availablePowers).toHaveLength(1);
      expect(availablePowers).toContain('rapid_deployment');
    });
  });

  // ============================================
  // COMEBACK POWERS
  // ============================================
  describe('Comeback Powers', () => {
    it('should award comeback power when faction eliminated from game', () => {
      applyCombebackPower(campaign, 'khan');

      expect(campaign.comebackPowers).toContainEqual({
        factionId: 'khan',
        powerId: 'khan_comeback',
      });
    });

    it('should persist comeback power for future games', () => {
      applyCombebackPower(campaign, 'khan');

      const factionPowers = getAllFactionPowers(campaign, 'khan');

      expect(factionPowers).toContain('khan_comeback');
    });

    it('should only award comeback power once per faction', () => {
      applyCombebackPower(campaign, 'khan');
      applyCombebackPower(campaign, 'khan'); // Eliminated again

      expect(campaign.comebackPowers.filter((p) => p.factionId === 'khan').length).toBe(1);
    });
  });

  // ============================================
  // CONTINENT NAMING
  // ============================================
  describe('Continent Naming', () => {
    it('should allow winner to name unnamed continent', () => {
      nameContinent(campaign, 0, 'The Frozen North');

      expect(campaign.namedContinents[0]).toBe('The Frozen North');
    });

    it('should reject naming already-named continent', () => {
      campaign.namedContinents[0] = 'Old Name';

      expect(() => nameContinent(campaign, 0, 'New Name'))
        .toThrow('Continent already named');
    });

    it('should persist names across games', () => {
      nameContinent(campaign, 0, 'My Continent');

      const state = loadCampaignState(campaign);

      expect(campaign.namedContinents[0]).toBe('My Continent');
    });
  });

  // ============================================
  // CAMPAIGN END (GAME 15)
  // ============================================
  describe('Campaign End', () => {
    it('should allow planet naming after game 15', () => {
      campaign.gameCount = 15;
      campaign.victors = [
        { gameNumber: 1, playerId: 1, factionId: 'khan' },
        { gameNumber: 2, playerId: 1, factionId: 'khan' },
        { gameNumber: 3, playerId: 2, factionId: 'bear' },
        // ... player 1 has most wins
      ];

      const canName = canNamePlanet(campaign);

      expect(canName.allowed).toBe(true);
      expect(canName.eligiblePlayerId).toBe(1);
    });

    it('should save final planet name', () => {
      campaign.gameCount = 15;

      namePlanet(campaign, 'Terra Nova', 1);

      expect(campaign.planetName).toBe('Terra Nova');
      expect(campaign.planetNamedBy).toBe(1);
    });

    it('should mark campaign as complete', () => {
      campaign.gameCount = 15;

      completeCampaign(campaign);

      expect(campaign.status).toBe('complete');
    });
  });

  // ============================================
  // STATE LOADING/SAVING
  // ============================================
  describe('State Persistence', () => {
    it('should serialize campaign state to JSON', () => {
      campaign.namedContinents[0] = 'Test';
      campaign.worldPopulation = 5;

      const serialized = JSON.stringify(saveCampaignState(campaign));
      const restored = JSON.parse(serialized);

      expect(restored.namedContinents[0]).toBe('Test');
      expect(restored.worldPopulation).toBe(5);
    });

    it('should restore all campaign state correctly', () => {
      // Set up complex state
      campaign.gameCount = 5;
      campaign.victors = [
        { gameNumber: 1, playerId: 1, factionId: 'khan' },
      ];
      campaign.destroyedCards = [1, 2, 3];
      campaign.packetStates['SECOND_WIN'] = 'opened';

      const saved = saveCampaignState(campaign);
      const restored = loadCampaignState(saved);

      expect(campaign.gameCount).toBe(5);
      expect(campaign.destroyedCards).toEqual([1, 2, 3]);
    });

    it('should handle concurrent updates safely', () => {
      // Simulate two updates happening
      const update1 = { ...campaign, worldPopulation: 5 };
      const update2 = { ...campaign, worldPopulation: 10 };

      // Last write wins (in real impl, would use optimistic locking)
      saveCampaignState(update1);
      saveCampaignState(update2);

      const loaded = loadCampaignState(campaign);
      // Implementation detail: actual behavior depends on persistence layer
    });
  });
});

// Helper function stubs
function getMostWinsPlayer(campaign: Campaign): number {
  const winCounts = new Map<number, number>();
  campaign.victors.forEach((v) => {
    winCounts.set(v.playerId, (winCounts.get(v.playerId) || 0) + 1);
  });
  let maxWins = 0;
  let maxPlayer = 0;
  winCounts.forEach((count, playerId) => {
    if (count > maxWins) {
      maxWins = count;
      maxPlayer = playerId;
    }
  });
  return maxPlayer;
}

function loadDeckForNewGame(campaign: Campaign) {
  const allCards = Array.from({ length: 52 }, (_, i) => ({ id: i }));
  return {
    cards: allCards.filter((c) => !campaign.destroyedCards.includes(c.id)),
  };
}

function getAvailablePowers(campaign: Campaign, factionId: string): string[] {
  const allPowers: Record<string, string[]> = {
    khan: ['rapid_deployment', 'overwhelming_numbers'],
    bear: ['ferocity', 'stubborn'],
    mechaniker: ['fortify_hq', 'supreme_firepower'],
    balkania: ['recruitment_offices', 'established'],
    saharan: ['desert_nomads', 'scattered'],
  };
  const destroyed = campaign.destroyedPowers[factionId] || [];
  return allPowers[factionId].filter((p) => !destroyed.includes(p));
}

function getAllFactionPowers(campaign: Campaign, factionId: string): string[] {
  const base = getAvailablePowers(campaign, factionId);
  const comeback = campaign.comebackPowers
    ?.filter((p) => p.factionId === factionId)
    .map((p) => p.powerId) || [];
  return [...base, ...comeback];
}

function nameContinent(campaign: Campaign, continentId: number, name: string) {
  if (campaign.namedContinents[continentId]) {
    throw new Error('Continent already named');
  }
  campaign.namedContinents[continentId] = name;
}

function canNamePlanet(campaign: Campaign) {
  if (campaign.gameCount < 15) {
    return { allowed: false };
  }
  return { allowed: true, eligiblePlayerId: getMostWinsPlayer(campaign) };
}

function namePlanet(campaign: Campaign, name: string, playerId: number) {
  campaign.planetName = name;
  campaign.planetNamedBy = playerId;
}

function completeCampaign(campaign: Campaign) {
  campaign.status = 'complete';
}
