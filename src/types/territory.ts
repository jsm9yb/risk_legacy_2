export type TerritoryId = string;

export type ScarType = 'bunker' | 'ammo_shortage' | 'biohazard' | 'mercenary' | 'fortification' | null;

export type CityTier = 0 | 1 | 2 | 3; // 0=none, 1=minor, 2=major, 3=capital

export interface TerritoryState {
  id: TerritoryId;
  name: string;
  continentId: number;
  neighbors: TerritoryId[];
  ownerId: string | null;
  troopCount: number;
  scarId: ScarType;
  cityTier: CityTier;
  cityName: string | null;
  fortified: boolean;
  fortifyDamage: number;
}

export interface TerritoryData {
  id: TerritoryId;
  name: string;
  continentId: number;
  neighbors: TerritoryId[];
}
