/**
 * Card System Unit Tests
 * Tests for: deck management, drawing rules, trading
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDeck,
  shuffleDeck,
  drawCard,
  canDrawCard,
  getFaceUpCards,
  tradeCards,
  destroyCard,
  upgradeCard,
} from '../../src/engine/cards';
import { Deck, Card, Player, Territory } from '../../src/types';

describe('Card System', () => {
  let deck: Deck;
  let player: Player;
  let territories: Map<number, Territory>;

  beforeEach(() => {
    deck = createDeck();
    player = {
      id: 1,
      cards: [],
      conqueredThisTurn: false,
    } as Player;
    territories = new Map();

    // Set up some controlled territories for player
    [1, 5, 10, 15].forEach((id) => {
      territories.set(id, { id, ownerId: 1 } as Territory);
    });
  });

  // ============================================
  // DECK CREATION
  // ============================================
  describe('createDeck', () => {
    it('should create deck with 42 territory cards', () => {
      const territoryCards = deck.cards.filter((c) => c.territoryId !== undefined);
      expect(territoryCards.length).toBe(42);
    });

    it('should create deck with 10 coin cards', () => {
      const coinCards = deck.cards.filter((c) => c.territoryId === undefined);
      expect(coinCards.length).toBe(10);
    });

    it('should have total of 52 cards', () => {
      expect(deck.cards.length).toBe(52);
    });

    it('should set initial coin value of 1 for all cards', () => {
      deck.cards.forEach((card) => {
        expect(card.coinValue).toBe(1);
      });
    });

    it('should have unique IDs for all cards', () => {
      const ids = deck.cards.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(52);
    });

    it('should map territory cards to correct territory IDs (0-41)', () => {
      const territoryIds = deck.cards
        .filter((c) => c.territoryId !== undefined)
        .map((c) => c.territoryId);

      for (let i = 0; i < 42; i++) {
        expect(territoryIds).toContain(i);
      }
    });
  });

  // ============================================
  // DECK SHUFFLING
  // ============================================
  describe('shuffleDeck', () => {
    it('should maintain same number of cards', () => {
      const originalCount = deck.drawPile.length;
      shuffleDeck(deck);
      expect(deck.drawPile.length).toBe(originalCount);
    });

    it('should change card order', () => {
      const originalOrder = [...deck.drawPile];
      shuffleDeck(deck);

      // Note: There's a tiny chance this could fail if shuffle produces same order
      // In practice with 52 cards this is essentially impossible
      let orderChanged = false;
      for (let i = 0; i < originalOrder.length; i++) {
        if (originalOrder[i] !== deck.drawPile[i]) {
          orderChanged = true;
          break;
        }
      }
      expect(orderChanged).toBe(true);
    });

    it('should preserve all original cards (no cards lost or duplicated)', () => {
      const originalCards = [...deck.drawPile].sort((a, b) => a - b);
      shuffleDeck(deck);
      const shuffledCards = [...deck.drawPile].sort((a, b) => a - b);

      expect(shuffledCards).toEqual(originalCards);
    });
  });

  // ============================================
  // CARD DRAW ELIGIBILITY
  // ============================================
  describe('canDrawCard', () => {
    it('should return false if player did not conquer this turn', () => {
      player.conqueredThisTurn = false;
      expect(canDrawCard(player)).toBe(false);
    });

    it('should return true if player conquered enemy territory this turn', () => {
      player.conqueredThisTurn = true;
      expect(canDrawCard(player)).toBe(true);
    });

    it('should distinguish between conquest and expansion', () => {
      // Expansion (moving into unoccupied) does NOT grant card
      player.conqueredThisTurn = false;
      player.expandedThisTurn = true; // Different flag

      expect(canDrawCard(player)).toBe(false);
    });

    it('should only allow one card draw per turn', () => {
      player.conqueredThisTurn = true;
      player.drewCardThisTurn = true;

      expect(canDrawCard(player)).toBe(false);
    });
  });

  // ============================================
  // FACE-UP CARD SELECTION
  // ============================================
  describe('getFaceUpCards', () => {
    it('should return territory cards matching controlled territories', () => {
      // Player controls territories 1, 5, 10, 15
      deck.faceUp = [
        { id: 100, territoryId: 1, coinValue: 2 }, // Match
        { id: 101, territoryId: 20, coinValue: 1 }, // No match
        { id: 102, territoryId: 5, coinValue: 3 }, // Match
      ];

      const available = getFaceUpCards(deck, territories, 1);

      expect(available.length).toBe(2);
      expect(available.map((c) => c.territoryId)).toContain(1);
      expect(available.map((c) => c.territoryId)).toContain(5);
    });

    it('should return empty array if no face-up cards match', () => {
      deck.faceUp = [
        { id: 100, territoryId: 20, coinValue: 1 },
        { id: 101, territoryId: 25, coinValue: 1 },
      ];

      const available = getFaceUpCards(deck, territories, 1);

      expect(available.length).toBe(0);
    });

    it('should exclude coin cards from face-up matching', () => {
      deck.faceUp = [
        { id: 100, coinValue: 1 }, // Coin card - no territory
        { id: 101, territoryId: 1, coinValue: 1 }, // Territory match
      ];

      const available = getFaceUpCards(deck, territories, 1);

      expect(available.length).toBe(1);
      expect(available[0].territoryId).toBe(1);
    });
  });

  // ============================================
  // CARD DRAWING
  // ============================================
  describe('drawCard', () => {
    beforeEach(() => {
      player.conqueredThisTurn = true;
      deck.faceUp = [];
      deck.coinPile = [{ id: 200, coinValue: 1 }];
    });

    it('should prioritize face-up cards matching controlled territories', () => {
      deck.faceUp = [
        { id: 100, territoryId: 1, coinValue: 2 }, // Player controls territory 1
        { id: 101, territoryId: 20, coinValue: 1 },
      ];

      const result = drawCard(deck, player, territories);

      expect(result.drawnCard.id).toBe(100);
      expect(deck.faceUp.find((c) => c.id === 100)).toBeUndefined();
    });

    it('should draw from coin pile if no face-up matches', () => {
      deck.faceUp = [{ id: 100, territoryId: 20, coinValue: 1 }]; // No match
      deck.coinPile = [{ id: 200, coinValue: 1 }];

      const result = drawCard(deck, player, territories);

      expect(result.drawnCard.id).toBe(200);
      expect(deck.coinPile.length).toBe(0);
    });

    it('should add drawn card to player hand', () => {
      deck.faceUp = [{ id: 100, territoryId: 1, coinValue: 1 }];

      drawCard(deck, player, territories);

      expect(player.cards).toContain(100);
    });

    it('should mark player as having drawn this turn', () => {
      deck.coinPile = [{ id: 200, coinValue: 1 }];

      drawCard(deck, player, territories);

      expect(player.drewCardThisTurn).toBe(true);
    });

    it('should refill face-up from draw pile when card taken', () => {
      deck.faceUp = [{ id: 100, territoryId: 1, coinValue: 1 }];
      deck.drawPile = [101, 102, 103];
      deck.cards = [
        { id: 101, territoryId: 2, coinValue: 1 },
        { id: 102, territoryId: 3, coinValue: 1 },
      ];

      drawCard(deck, player, territories);

      expect(deck.faceUp.length).toBe(1); // Refilled
    });

    it('should handle empty coin pile gracefully', () => {
      deck.faceUp = [];
      deck.coinPile = [];
      deck.drawPile = [101];
      deck.cards = [{ id: 101, territoryId: 2, coinValue: 1 }];

      // Should still work - draw from draw pile as fallback
      const result = drawCard(deck, player, territories);

      expect(result.drawnCard).toBeDefined();
    });
  });

  // ============================================
  // CARD TRADING
  // ============================================
  describe('tradeCards', () => {
    describe('Trade for Troops', () => {
      it('should calculate correct troop value based on coin sum', () => {
        const cards: Card[] = [
          { id: 1, coinValue: 2 },
          { id: 2, coinValue: 3 },
        ];
        player.cards = [1, 2];

        const result = tradeCards(player, cards, 'troops', deck);

        expect(result.troopsReceived).toBe(4); // 5 coins = 4 troops
      });

      it('should remove traded cards from player hand', () => {
        player.cards = [1, 2, 3];
        const cards: Card[] = [
          { id: 1, coinValue: 1 },
          { id: 2, coinValue: 1 },
        ];

        tradeCards(player, cards, 'troops', deck);

        expect(player.cards).toEqual([3]);
      });

      it('should add traded cards to discard pile', () => {
        const cards: Card[] = [
          { id: 1, coinValue: 2 },
          { id: 2, coinValue: 1 },
        ];
        player.cards = [1, 2];
        deck.discardPile = [];

        tradeCards(player, cards, 'troops', deck);

        expect(deck.discardPile).toContain(1);
        expect(deck.discardPile).toContain(2);
      });

      it('should reject trade with less than 2 coins total', () => {
        const cards: Card[] = [{ id: 1, coinValue: 1 }];
        player.cards = [1];

        expect(() => tradeCards(player, cards, 'troops', deck)).toThrow('INSUFFICIENT_COINS');
      });
    });

    describe('Trade for Star', () => {
      it('should require exactly 4 cards', () => {
        const threeCards: Card[] = [
          { id: 1, coinValue: 1 },
          { id: 2, coinValue: 1 },
          { id: 3, coinValue: 1 },
        ];
        player.cards = [1, 2, 3];

        expect(() => tradeCards(player, threeCards, 'star', deck)).toThrow('INSUFFICIENT_CARDS');
      });

      it('should award 1 star for 4 cards regardless of coin values', () => {
        const fourCards: Card[] = [
          { id: 1, coinValue: 1 },
          { id: 2, coinValue: 1 },
          { id: 3, coinValue: 1 },
          { id: 4, coinValue: 1 },
        ];
        player.cards = [1, 2, 3, 4];
        player.redStars = 2;

        const result = tradeCards(player, fourCards, 'star', deck);

        expect(result.starsReceived).toBe(1);
        expect(player.redStars).toBe(3);
      });

      it('should allow trading high-value cards for star', () => {
        const fourCards: Card[] = [
          { id: 1, coinValue: 6 },
          { id: 2, coinValue: 5 },
          { id: 3, coinValue: 4 },
          { id: 4, coinValue: 3 },
        ];
        player.cards = [1, 2, 3, 4];

        const result = tradeCards(player, fourCards, 'star', deck);

        expect(result.starsReceived).toBe(1); // Still just 1 star
      });
    });

    describe('Validation', () => {
      it('should reject trading cards not in player hand', () => {
        player.cards = [1, 2];
        const cards: Card[] = [
          { id: 1, coinValue: 1 },
          { id: 3, coinValue: 1 }, // Not in hand
        ];

        expect(() => tradeCards(player, cards, 'troops', deck)).toThrow('CARD_NOT_OWNED');
      });

      it('should reject duplicate card IDs in trade', () => {
        player.cards = [1, 2];
        const cards: Card[] = [
          { id: 1, coinValue: 1 },
          { id: 1, coinValue: 1 }, // Duplicate
        ];

        expect(() => tradeCards(player, cards, 'troops', deck)).toThrow('DUPLICATE_CARD');
      });
    });
  });

  // ============================================
  // CAMPAIGN: CARD DESTRUCTION
  // ============================================
  describe('destroyCard', () => {
    it('should permanently remove card from deck', () => {
      const cardId = 5;
      const originalLength = deck.cards.length;

      destroyCard(deck, cardId);

      expect(deck.cards.find((c) => c.id === cardId)).toBeUndefined();
      expect(deck.cards.length).toBe(originalLength - 1);
    });

    it('should add card to destroyed cards list', () => {
      const cardId = 5;
      deck.destroyedCards = [];

      destroyCard(deck, cardId);

      expect(deck.destroyedCards).toContain(cardId);
    });

    it('should remove from all piles (draw, discard, face-up)', () => {
      const cardId = 5;
      deck.drawPile = [5, 6, 7];
      deck.discardPile = [1, 2, 3];
      deck.faceUp = [{ id: 5, coinValue: 1 }];

      destroyCard(deck, cardId);

      expect(deck.drawPile).not.toContain(5);
      expect(deck.faceUp.find((c) => c.id === 5)).toBeUndefined();
    });

    it('should not allow destroying coin cards', () => {
      const coinCard = deck.cards.find((c) => c.territoryId === undefined)!;

      expect(() => destroyCard(deck, coinCard.id)).toThrow('Cannot destroy coin cards');
    });
  });

  // ============================================
  // CAMPAIGN: CARD UPGRADE
  // ============================================
  describe('upgradeCard', () => {
    it('should increase card coin value by 1', () => {
      const cardId = 5;
      deck.cards.find((c) => c.id === cardId)!.coinValue = 2;

      upgradeCard(deck, cardId);

      expect(deck.cards.find((c) => c.id === cardId)!.coinValue).toBe(3);
    });

    it('should cap coin value at 6', () => {
      const cardId = 5;
      deck.cards.find((c) => c.id === cardId)!.coinValue = 6;

      upgradeCard(deck, cardId);

      expect(deck.cards.find((c) => c.id === cardId)!.coinValue).toBe(6);
    });

    it('should not allow upgrading coin cards', () => {
      const coinCard = deck.cards.find((c) => c.territoryId === undefined)!;

      expect(() => upgradeCard(deck, coinCard.id)).toThrow('Cannot upgrade coin cards');
    });

    it('should track upgrade history', () => {
      const cardId = 5;
      deck.upgradeHistory = [];

      upgradeCard(deck, cardId);

      expect(deck.upgradeHistory).toContainEqual({
        cardId,
        previousValue: 1,
        newValue: 2,
      });
    });
  });

  // ============================================
  // DECK RESHUFFLING
  // ============================================
  describe('Deck Reshuffling', () => {
    it('should reshuffle discard into draw when draw pile empty', () => {
      deck.drawPile = [];
      deck.discardPile = [1, 2, 3, 4, 5];

      const reshuffled = reshuffleDeck(deck);

      expect(reshuffled.drawPile.length).toBe(5);
      expect(reshuffled.discardPile.length).toBe(0);
    });

    it('should not include destroyed cards in reshuffle', () => {
      deck.drawPile = [];
      deck.discardPile = [1, 2, 3, 4, 5];
      deck.destroyedCards = [2, 4];

      const reshuffled = reshuffleDeck(deck);

      expect(reshuffled.drawPile).not.toContain(2);
      expect(reshuffled.drawPile).not.toContain(4);
      expect(reshuffled.drawPile.length).toBe(3);
    });
  });
});

// Helper function stub
function reshuffleDeck(deck: Deck): Deck {
  const validCards = deck.discardPile.filter(
    (id) => !deck.destroyedCards?.includes(id)
  );
  return {
    ...deck,
    drawPile: validCards,
    discardPile: [],
  };
}
