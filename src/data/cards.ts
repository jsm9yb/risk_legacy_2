import { TerritoryId } from '@/types/territory';

export interface TerritoryCard {
  id: number;
  type: 'territory';
  territoryId: TerritoryId;
  coinValue: number; // Resources (1-6, starts at 1)
}

export interface CoinCard {
  id: number;
  type: 'coin';
  coinValue: number; // Always 1
}

export type ResourceCard = TerritoryCard | CoinCard;

// 42 Territory cards (one per territory, starting coin value of 1)
export const territoryCards: TerritoryCard[] = [
  // North America (continentId: 0)
  { id: 0, type: 'territory', territoryId: 'alaska', coinValue: 1 },
  { id: 1, type: 'territory', territoryId: 'northwest_territory', coinValue: 1 },
  { id: 2, type: 'territory', territoryId: 'greenland', coinValue: 1 },
  { id: 3, type: 'territory', territoryId: 'alberta', coinValue: 1 },
  { id: 4, type: 'territory', territoryId: 'ontario', coinValue: 1 },
  { id: 5, type: 'territory', territoryId: 'quebec', coinValue: 1 },
  { id: 6, type: 'territory', territoryId: 'western_united_states', coinValue: 1 },
  { id: 7, type: 'territory', territoryId: 'eastern_united_states', coinValue: 1 },
  { id: 8, type: 'territory', territoryId: 'central_america', coinValue: 1 },

  // South America (continentId: 1)
  { id: 9, type: 'territory', territoryId: 'venezuela', coinValue: 1 },
  { id: 10, type: 'territory', territoryId: 'brazil', coinValue: 1 },
  { id: 11, type: 'territory', territoryId: 'peru', coinValue: 1 },
  { id: 12, type: 'territory', territoryId: 'argentina', coinValue: 1 },

  // Europe (continentId: 2)
  { id: 13, type: 'territory', territoryId: 'iceland', coinValue: 1 },
  { id: 14, type: 'territory', territoryId: 'great_britain', coinValue: 1 },
  { id: 15, type: 'territory', territoryId: 'scandinavia', coinValue: 1 },
  { id: 16, type: 'territory', territoryId: 'northern_europe', coinValue: 1 },
  { id: 17, type: 'territory', territoryId: 'western_europe', coinValue: 1 },
  { id: 18, type: 'territory', territoryId: 'southern_europe', coinValue: 1 },
  { id: 19, type: 'territory', territoryId: 'ukraine', coinValue: 1 },

  // Africa (continentId: 3)
  { id: 20, type: 'territory', territoryId: 'north_africa', coinValue: 1 },
  { id: 21, type: 'territory', territoryId: 'egypt', coinValue: 1 },
  { id: 22, type: 'territory', territoryId: 'east_africa', coinValue: 1 },
  { id: 23, type: 'territory', territoryId: 'congo', coinValue: 1 },
  { id: 24, type: 'territory', territoryId: 'south_africa', coinValue: 1 },
  { id: 25, type: 'territory', territoryId: 'madagascar', coinValue: 1 },

  // Asia (continentId: 4)
  { id: 26, type: 'territory', territoryId: 'ural', coinValue: 1 },
  { id: 27, type: 'territory', territoryId: 'siberia', coinValue: 1 },
  { id: 28, type: 'territory', territoryId: 'yakutsk', coinValue: 1 },
  { id: 29, type: 'territory', territoryId: 'kamchatka', coinValue: 1 },
  { id: 30, type: 'territory', territoryId: 'irkutsk', coinValue: 1 },
  { id: 31, type: 'territory', territoryId: 'mongolia', coinValue: 1 },
  { id: 32, type: 'territory', territoryId: 'japan', coinValue: 1 },
  { id: 33, type: 'territory', territoryId: 'afghanistan', coinValue: 1 },
  { id: 34, type: 'territory', territoryId: 'china', coinValue: 1 },
  { id: 35, type: 'territory', territoryId: 'india', coinValue: 1 },
  { id: 36, type: 'territory', territoryId: 'siam', coinValue: 1 },
  { id: 37, type: 'territory', territoryId: 'middle_east', coinValue: 1 },

  // Australia (continentId: 5)
  { id: 38, type: 'territory', territoryId: 'indonesia', coinValue: 1 },
  { id: 39, type: 'territory', territoryId: 'new_guinea', coinValue: 1 },
  { id: 40, type: 'territory', territoryId: 'western_australia', coinValue: 1 },
  { id: 41, type: 'territory', territoryId: 'eastern_australia', coinValue: 1 },
];

// 10 Coin cards (standalone resource, always coin value 1)
export const coinCards: CoinCard[] = [
  { id: 42, type: 'coin', coinValue: 1 },
  { id: 43, type: 'coin', coinValue: 1 },
  { id: 44, type: 'coin', coinValue: 1 },
  { id: 45, type: 'coin', coinValue: 1 },
  { id: 46, type: 'coin', coinValue: 1 },
  { id: 47, type: 'coin', coinValue: 1 },
  { id: 48, type: 'coin', coinValue: 1 },
  { id: 49, type: 'coin', coinValue: 1 },
  { id: 50, type: 'coin', coinValue: 1 },
  { id: 51, type: 'coin', coinValue: 1 },
];

// All 52 cards combined
export const allCards: ResourceCard[] = [...territoryCards, ...coinCards];

// Lookup map by card ID
export const cardsById: Record<number, ResourceCard> = allCards.reduce(
  (acc, card) => {
    acc[card.id] = card;
    return acc;
  },
  {} as Record<number, ResourceCard>
);

// Get troops received for coin total (per spec section 4.2)
export function getTroopsForCoins(totalCoins: number): number {
  if (totalCoins >= 10) return 10;
  if (totalCoins >= 9) return 8;
  if (totalCoins >= 8) return 7;
  if (totalCoins >= 7) return 6;
  if (totalCoins >= 6) return 5;
  if (totalCoins >= 5) return 4;
  if (totalCoins >= 4) return 3;
  if (totalCoins >= 3) return 2;
  if (totalCoins >= 2) return 1;
  return 0;
}
