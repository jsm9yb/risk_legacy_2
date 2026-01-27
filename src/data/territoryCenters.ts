import { TerritoryId } from '@/types/territory';

// Visual center coordinates for each territory
// These are calculated from the SVG path bounding boxes with layer transforms applied
// Coordinates are in SVG viewBox units (749.82 x 519.07)
// Some territories with irregular shapes may need manual adjustments for optimal marker placement
export const territoryCenters: Record<TerritoryId, { x: number; y: number }> = {
  // North America
  alaska: { x: 58, y: 89 },
  northwest_territory: { x: 138, y: 72 },
  greenland: { x: 256, y: 67 },
  alberta: { x: 117, y: 121 },
  ontario: { x: 172, y: 136 },
  quebec: { x: 220, y: 131 },
  western_united_states: { x: 124, y: 180 },
  eastern_united_states: { x: 180, y: 187 },
  central_america: { x: 126, y: 242 },

  // South America
  venezuela: { x: 193, y: 286 },
  brazil: { x: 222, y: 343 },
  peru: { x: 186, y: 340 },
  argentina: { x: 202, y: 419 },

  // Europe
  iceland: { x: 322, y: 105 },
  great_britain: { x: 307, y: 156 },
  scandinavia: { x: 381, y: 104 },
  northern_europe: { x: 375, y: 168 },
  western_europe: { x: 325, y: 223 },
  southern_europe: { x: 381, y: 219 },
  ukraine: { x: 446, y: 149 },

  // Africa
  north_africa: { x: 356, y: 310 },
  egypt: { x: 406, y: 289 },
  east_africa: { x: 444, y: 363 },
  congo: { x: 404, y: 374 },
  south_africa: { x: 416, y: 434 },
  madagascar: { x: 476, y: 435 },

  // Asia
  ural: { x: 521, y: 114 },
  siberia: { x: 549, y: 102 },
  yakutsk: { x: 609, y: 71 },
  kamchatka: { x: 664, y: 110 },
  irkutsk: { x: 602, y: 126 },
  mongolia: { x: 612, y: 171 },
  japan: { x: 676, y: 176 },
  afghanistan: { x: 501, y: 189 },
  china: { x: 587, y: 217 },
  india: { x: 544, y: 274 },
  siam: { x: 603, y: 289 },
  middle_east: { x: 458, y: 275 },

  // Australia
  indonesia: { x: 611, y: 365 },
  new_guinea: { x: 676, y: 347 },
  western_australia: { x: 655, y: 435 },
  eastern_australia: { x: 698, y: 430 },
};
