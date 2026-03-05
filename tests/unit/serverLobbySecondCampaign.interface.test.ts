import { afterEach, describe, expect, it } from 'vitest';
import { createNewGameInCampaign } from '../../server/gameState';
import {
  addPlayerToLobby,
  createCampaign,
  deleteCampaign,
  getAllCampaigns,
  getLobby,
  removePlayerFromLobby,
  setCampaignActiveGame,
  setPlayerReady,
  startGame,
} from '../../server/store';
import { deleteCampaignFull } from '../../server/persistence';
import { createInitialTerritories } from '../helpers/serverInterfaceTestHelpers';

describe('server interface contract: second campaign and lobby population', () => {
  const createdCampaigns: string[] = [];
  const usedSockets: string[] = [];

  afterEach(() => {
    for (const socketId of usedSockets) {
      removePlayerFromLobby(socketId);
    }

    for (const campaignId of createdCampaigns) {
      deleteCampaign(campaignId);
      deleteCampaignFull(campaignId);
    }

    createdCampaigns.length = 0;
    usedSockets.length = 0;
  });

  it('keeps lobby players and summary player counts isolated between campaigns', () => {
    const campaignAId = `campaign-a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const campaignBId = `campaign-b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    createdCampaigns.push(campaignAId, campaignBId);

    createCampaign(campaignAId, 'Campaign A');
    createCampaign(campaignBId, 'Campaign B');

    usedSockets.push('sock-a1', 'sock-a2', 'sock-b1');

    expect(addPlayerToLobby(campaignAId, 'sock-a1', 'Alice').success).toBe(true);
    expect(addPlayerToLobby(campaignAId, 'sock-a2', 'Bob').success).toBe(true);
    expect(addPlayerToLobby(campaignBId, 'sock-b1', 'Carol').success).toBe(true);

    expect(getLobby(campaignAId)?.players).toHaveLength(2);
    expect(getLobby(campaignBId)?.players).toHaveLength(1);

    const summaries = getAllCampaigns();
    const summaryA = summaries.find((c) => c.id === campaignAId);
    const summaryB = summaries.find((c) => c.id === campaignBId);

    expect(summaryA?.playerCount).toBe(2);
    expect(summaryB?.playerCount).toBe(1);
  });

  it('starts one campaign lobby without changing the other campaign lobby status', () => {
    const campaignAId = `campaign-a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const campaignBId = `campaign-b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    createdCampaigns.push(campaignAId, campaignBId);

    createCampaign(campaignAId, 'Campaign A');
    createCampaign(campaignBId, 'Campaign B');

    usedSockets.push('sock-a1', 'sock-a2', 'sock-b1', 'sock-b2');

    expect(addPlayerToLobby(campaignAId, 'sock-a1', 'Alice').success).toBe(true);
    expect(addPlayerToLobby(campaignAId, 'sock-a2', 'Bob').success).toBe(true);
    expect(addPlayerToLobby(campaignBId, 'sock-b1', 'Carol').success).toBe(true);
    expect(addPlayerToLobby(campaignBId, 'sock-b2', 'Dan').success).toBe(true);

    setPlayerReady('sock-a2', true);
    const startResult = startGame('sock-a1');

    expect(startResult.success).toBe(true);
    expect(getLobby(campaignAId)?.status).toBe('starting');
    expect(getLobby(campaignBId)?.status).toBe('waiting');
  });

  it('marks active-game status for one campaign only when setting campaign active game', () => {
    const campaignAId = `campaign-a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const campaignBId = `campaign-b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    createdCampaigns.push(campaignAId, campaignBId);

    createCampaign(campaignAId, 'Campaign A');
    createCampaign(campaignBId, 'Campaign B');

    createNewGameInCampaign(
      campaignAId,
      'Campaign A',
      [
        { id: 'player-1', name: 'Alice', odId: 'od-alice', socketId: 'sock-a', seatIndex: 0 },
        { id: 'player-2', name: 'Bob', odId: 'od-bob', socketId: 'sock-b', seatIndex: 1 },
      ],
      createInitialTerritories()
    );

    setCampaignActiveGame(campaignAId, true);

    const summaries = getAllCampaigns();
    const summaryA = summaries.find((c) => c.id === campaignAId);
    const summaryB = summaries.find((c) => c.id === campaignBId);

    expect(summaryA?.hasActiveGame).toBe(true);
    expect(summaryB?.hasActiveGame).toBe(false);
    expect(getLobby(campaignAId)?.status).toBe('in_game');
    expect(getLobby(campaignBId)?.status).toBe('waiting');
  });
});
