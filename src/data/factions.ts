import { FactionId } from '../types/game';

export interface FactionPower {
  id: string;
  name: string;
  description: string;
  type: 'attack' | 'defense' | 'recruitment' | 'movement' | 'setup';
}

export interface Faction {
  id: FactionId;
  name: string;
  powers: [FactionPower, FactionPower];
  color: string;
}

export const factions: Faction[] = [
  {
    id: 'mechaniker',
    name: 'Die Mechaniker',
    powers: [
      {
        id: 'fortify_hq',
        name: 'Fortify HQ',
        description: 'Your starting HQ is always fortified when defending (no degradation applies)',
        type: 'defense',
      },
      {
        id: 'supreme_firepower',
        name: 'Supreme Firepower',
        description: 'When attacking with 3 dice, if all show same number, defender loses 3 troops immediately',
        type: 'attack',
      },
    ],
    color: '#4A90A4',
  },
  {
    id: 'enclave',
    name: 'Enclave of the Bear',
    powers: [
      {
        id: 'ferocity',
        name: 'Ferocity',
        description: 'On first attack each turn, +1 to highest attack die',
        type: 'attack',
      },
      {
        id: 'stubborn',
        name: 'Stubborn',
        description: 'When defending, if you roll doubles, attacker loses 1 additional troop',
        type: 'defense',
      },
    ],
    color: '#8B4513',
  },
  {
    id: 'balkania',
    name: 'Imperial Balkania',
    powers: [
      {
        id: 'recruitment_offices',
        name: 'Recruitment Offices',
        description: '+1 troop during recruitment for each territory with a city you control',
        type: 'recruitment',
      },
      {
        id: 'established',
        name: 'Established',
        description: 'Start each game with 10 troops instead of 8',
        type: 'setup',
      },
    ],
    color: '#6B3FA0',
  },
  {
    id: 'khan',
    name: 'Khan Industries',
    powers: [
      {
        id: 'rapid_deployment',
        name: 'Rapid Deployment',
        description: 'May place reinforcements on any controlled territory (ignores connectivity)',
        type: 'recruitment',
      },
      {
        id: 'overwhelming_numbers',
        name: 'Overwhelming Numbers',
        description: 'When attacking with 3 dice, roll 4 and discard lowest',
        type: 'attack',
      },
    ],
    color: '#2F4F4F',
  },
  {
    id: 'saharan',
    name: 'Saharan Republic',
    powers: [
      {
        id: 'desert_nomads',
        name: 'Desert Nomads',
        description: 'During maneuver, troops may move through ONE enemy territory',
        type: 'movement',
      },
      {
        id: 'scattered',
        name: 'Scattered',
        description: 'May execute maneuver during attack phase instead of end (once per turn)',
        type: 'movement',
      },
    ],
    color: '#DAA520',
  },
];

export const factionsById: Record<FactionId, Faction> = factions.reduce(
  (acc, faction) => {
    acc[faction.id] = faction;
    return acc;
  },
  {} as Record<FactionId, Faction>
);
