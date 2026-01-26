import { TerritoryData } from '@/types/territory';

// Territory data matching the SVG IDs and spec
export const territories: TerritoryData[] = [
  // North America (continentId: 0)
  { id: 'alaska', name: 'Alaska', continentId: 0, neighbors: ['northwest_territory', 'alberta', 'kamchatka'] },
  { id: 'northwest_territory', name: 'Northwest Territory', continentId: 0, neighbors: ['alaska', 'alberta', 'ontario', 'greenland'] },
  { id: 'greenland', name: 'Greenland', continentId: 0, neighbors: ['northwest_territory', 'ontario', 'quebec', 'iceland'] },
  { id: 'alberta', name: 'Alberta', continentId: 0, neighbors: ['alaska', 'northwest_territory', 'ontario', 'western_united_states'] },
  { id: 'ontario', name: 'Ontario', continentId: 0, neighbors: ['northwest_territory', 'alberta', 'greenland', 'quebec', 'western_united_states', 'eastern_united_states'] },
  { id: 'quebec', name: 'Quebec', continentId: 0, neighbors: ['greenland', 'ontario', 'eastern_united_states'] },
  { id: 'western_united_states', name: 'Western United States', continentId: 0, neighbors: ['alberta', 'ontario', 'eastern_united_states', 'central_america'] },
  { id: 'eastern_united_states', name: 'Eastern United States', continentId: 0, neighbors: ['ontario', 'quebec', 'western_united_states', 'central_america'] },
  { id: 'central_america', name: 'Central America', continentId: 0, neighbors: ['western_united_states', 'eastern_united_states', 'venezuela'] },

  // South America (continentId: 1)
  { id: 'venezuela', name: 'Venezuela', continentId: 1, neighbors: ['central_america', 'brazil', 'peru'] },
  { id: 'brazil', name: 'Brazil', continentId: 1, neighbors: ['venezuela', 'peru', 'argentina', 'north_africa'] },
  { id: 'peru', name: 'Peru', continentId: 1, neighbors: ['venezuela', 'brazil', 'argentina'] },
  { id: 'argentina', name: 'Argentina', continentId: 1, neighbors: ['peru', 'brazil'] },

  // Europe (continentId: 2)
  { id: 'iceland', name: 'Iceland', continentId: 2, neighbors: ['greenland', 'great_britain', 'scandinavia'] },
  { id: 'great_britain', name: 'Great Britain', continentId: 2, neighbors: ['iceland', 'scandinavia', 'northern_europe', 'western_europe'] },
  { id: 'scandinavia', name: 'Scandinavia', continentId: 2, neighbors: ['iceland', 'great_britain', 'northern_europe', 'ukraine'] },
  { id: 'northern_europe', name: 'Northern Europe', continentId: 2, neighbors: ['great_britain', 'scandinavia', 'western_europe', 'southern_europe', 'ukraine'] },
  { id: 'western_europe', name: 'Western Europe', continentId: 2, neighbors: ['great_britain', 'northern_europe', 'southern_europe', 'north_africa'] },
  { id: 'southern_europe', name: 'Southern Europe', continentId: 2, neighbors: ['northern_europe', 'western_europe', 'ukraine', 'north_africa', 'egypt', 'middle_east'] },
  { id: 'ukraine', name: 'Ukraine', continentId: 2, neighbors: ['scandinavia', 'northern_europe', 'southern_europe', 'ural', 'afghanistan', 'middle_east'] },

  // Africa (continentId: 3)
  { id: 'north_africa', name: 'North Africa', continentId: 3, neighbors: ['brazil', 'western_europe', 'southern_europe', 'egypt', 'east_africa', 'congo'] },
  { id: 'egypt', name: 'Egypt', continentId: 3, neighbors: ['southern_europe', 'north_africa', 'east_africa', 'middle_east'] },
  { id: 'east_africa', name: 'East Africa', continentId: 3, neighbors: ['north_africa', 'egypt', 'congo', 'south_africa', 'madagascar', 'middle_east'] },
  { id: 'congo', name: 'Congo', continentId: 3, neighbors: ['north_africa', 'east_africa', 'south_africa'] },
  { id: 'south_africa', name: 'South Africa', continentId: 3, neighbors: ['congo', 'east_africa', 'madagascar'] },
  { id: 'madagascar', name: 'Madagascar', continentId: 3, neighbors: ['east_africa', 'south_africa'] },

  // Asia (continentId: 4)
  { id: 'ural', name: 'Ural', continentId: 4, neighbors: ['ukraine', 'siberia', 'afghanistan', 'china'] },
  { id: 'siberia', name: 'Siberia', continentId: 4, neighbors: ['ural', 'yakutsk', 'irkutsk', 'mongolia', 'china'] },
  { id: 'yakutsk', name: 'Yakutsk', continentId: 4, neighbors: ['siberia', 'kamchatka', 'irkutsk'] },
  { id: 'kamchatka', name: 'Kamchatka', continentId: 4, neighbors: ['alaska', 'yakutsk', 'irkutsk', 'mongolia', 'japan'] },
  { id: 'irkutsk', name: 'Irkutsk', continentId: 4, neighbors: ['siberia', 'yakutsk', 'kamchatka', 'mongolia'] },
  { id: 'mongolia', name: 'Mongolia', continentId: 4, neighbors: ['siberia', 'irkutsk', 'kamchatka', 'china', 'japan'] },
  { id: 'japan', name: 'Japan', continentId: 4, neighbors: ['kamchatka', 'mongolia'] },
  { id: 'afghanistan', name: 'Afghanistan', continentId: 4, neighbors: ['ukraine', 'ural', 'china', 'india', 'middle_east'] },
  { id: 'china', name: 'China', continentId: 4, neighbors: ['ural', 'siberia', 'mongolia', 'afghanistan', 'india', 'siam'] },
  { id: 'india', name: 'India', continentId: 4, neighbors: ['afghanistan', 'china', 'siam', 'middle_east'] },
  { id: 'siam', name: 'Siam', continentId: 4, neighbors: ['china', 'india', 'indonesia'] },
  { id: 'middle_east', name: 'Middle East', continentId: 4, neighbors: ['southern_europe', 'ukraine', 'afghanistan', 'india', 'egypt', 'east_africa'] },

  // Australia (continentId: 5)
  { id: 'indonesia', name: 'Indonesia', continentId: 5, neighbors: ['siam', 'new_guinea', 'western_australia'] },
  { id: 'new_guinea', name: 'New Guinea', continentId: 5, neighbors: ['indonesia', 'eastern_australia', 'western_australia'] },
  { id: 'western_australia', name: 'Western Australia', continentId: 5, neighbors: ['indonesia', 'new_guinea', 'eastern_australia'] },
  { id: 'eastern_australia', name: 'Eastern Australia', continentId: 5, neighbors: ['new_guinea', 'western_australia'] },
];

export const territoriesById = territories.reduce((acc, t) => {
  acc[t.id] = t;
  return acc;
}, {} as Record<string, TerritoryData>);
