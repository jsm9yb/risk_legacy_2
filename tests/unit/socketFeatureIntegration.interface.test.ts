import { describe, it } from 'vitest';

describe('socket interface contract: cards/missions integration', () => {
  it.todo('broadcasts consistent card draw patches/full state to all clients');
  it.todo('broadcasts mission completion and star updates consistently');
  it.todo('handles stale-client reject/resync during mission/card transitions');
  it.todo('preserves deck/mission/hand state on mid-turn rejoin');
  it.todo('syncs first-game coin setup visibility across connected clients');
});
