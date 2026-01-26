export interface Continent {
  id: number;
  name: string;
  territoryIds: string[];
  bonus: number;
  color: string;
}

export const continents: Continent[] = [
  {
    id: 0,
    name: 'North America',
    territoryIds: ['alaska', 'northwest_territory', 'greenland', 'alberta', 'ontario', 'quebec', 'western_united_states', 'eastern_united_states', 'central_america'],
    bonus: 5,
    color: '#D4A574' // Tan/beige
  },
  {
    id: 1,
    name: 'South America',
    territoryIds: ['venezuela', 'brazil', 'peru', 'argentina'],
    bonus: 2,
    color: '#8FBC8F' // Dark sea green
  },
  {
    id: 2,
    name: 'Europe',
    territoryIds: ['iceland', 'great_britain', 'scandinavia', 'northern_europe', 'western_europe', 'southern_europe', 'ukraine'],
    bonus: 5,
    color: '#6495ED' // Cornflower blue
  },
  {
    id: 3,
    name: 'Africa',
    territoryIds: ['north_africa', 'egypt', 'east_africa', 'congo', 'south_africa', 'madagascar'],
    bonus: 3,
    color: '#CD853F' // Peru/brown
  },
  {
    id: 4,
    name: 'Asia',
    territoryIds: ['ural', 'siberia', 'yakutsk', 'kamchatka', 'irkutsk', 'mongolia', 'japan', 'afghanistan', 'china', 'india', 'siam', 'middle_east'],
    bonus: 7,
    color: '#9ACD32' // Yellow green
  },
  {
    id: 5,
    name: 'Australia',
    territoryIds: ['indonesia', 'new_guinea', 'western_australia', 'eastern_australia'],
    bonus: 2,
    color: '#DDA0DD' // Plum
  },
];

export const continentsById = continents.reduce((acc, c) => {
  acc[c.id] = c;
  return acc;
}, {} as Record<number, Continent>);

export const continentByTerritory = continents.reduce((acc, c) => {
  c.territoryIds.forEach(tid => {
    acc[tid] = c;
  });
  return acc;
}, {} as Record<string, Continent>);
