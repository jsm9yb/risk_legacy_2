/**
 * Campaign browser component - shows list of campaigns and allows creating new ones
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useLobbyStore } from '@/store/lobbyStore';
import { useSocket } from '@/hooks/useSocket';
import { ConnectionStatus } from './ConnectionStatus';

export function CampaignBrowser() {
  const { campaigns, playerName, isConnected, showNamePromptForCampaign } =
    useLobbyStore();
  const { createCampaign, refreshCampaigns, joinLobby } = useSocket();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Check for direct join link on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#/join/')) {
      const campaignId = hash.replace('#/join/', '');
      if (campaignId) {
        handleJoinCampaign(campaignId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (showCreateModal && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCreateModal]);

  const handleCreateCampaign = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const name = newCampaignName.trim() || 'New Campaign';
      createCampaign(name);
      setNewCampaignName('');
      setShowCreateModal(false);
    },
    [newCampaignName, createCampaign]
  );

  const handleJoinCampaign = useCallback(
    (campaignId: string) => {
      if (!playerName) {
        // Show name prompt, will auto-join after name is set
        showNamePromptForCampaign(campaignId);
      } else {
        joinLobby(campaignId, playerName);
      }
    },
    [playerName, showNamePromptForCampaign, joinLobby]
  );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-board-wood flex flex-col">
      {/* Header */}
      <header className="h-16 bg-board-border flex items-center justify-between px-6 border-b-2 border-board-wood">
        <h1 className="text-board-parchment font-display text-2xl font-bold">
          Risk Legacy
        </h1>
        <div className="flex items-center gap-4">
          {playerName && (
            <span className="text-board-parchment/80 font-body">
              Playing as: <span className="text-amber-400">{playerName}</span>
            </span>
          )}
          <ConnectionStatus />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        {/* Title section */}
        <div className="mb-8 text-center">
          <h2 className="text-board-parchment font-display text-4xl mb-2">
            Campaign Browser
          </h2>
          <p className="text-board-parchment/60 font-body">
            Join an existing campaign or create a new one
          </p>
        </div>

        {/* Actions bar */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => refreshCampaigns()}
            disabled={!isConnected}
            className="px-4 py-2 bg-board-dark text-board-parchment font-body rounded border-2 border-board-border hover:border-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!isConnected}
            className="px-6 py-2 bg-amber-600 text-white font-display text-lg rounded border-2 border-amber-400 hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Create Campaign
          </button>
        </div>

        {/* Campaign grid */}
        {campaigns.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-board-parchment/40 font-display text-6xl mb-4">
              No Campaigns
            </div>
            <p className="text-board-parchment/60 font-body text-lg mb-6">
              Be the first to create a campaign and invite your friends!
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={!isConnected}
              className="px-8 py-3 bg-amber-600 text-white font-display text-xl rounded border-2 border-amber-400 hover:bg-amber-500 transition-colors disabled:opacity-50"
            >
              Create Your First Campaign
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="bg-board-dark border-2 border-board-border rounded-lg p-4 hover:border-amber-500 transition-colors cursor-pointer group"
                onClick={() => handleJoinCampaign(campaign.id)}
              >
                <h3 className="text-board-parchment font-display text-xl mb-2 group-hover:text-amber-400 transition-colors">
                  {campaign.name}
                </h3>
                <div className="flex justify-between items-center text-board-parchment/60 font-body text-sm">
                  <span>
                    {campaign.playerCount}/5 Players
                  </span>
                  <span>{formatDate(campaign.createdAt)}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-board-border/50">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        campaign.playerCount > 0
                          ? 'bg-green-500'
                          : 'bg-gray-500'
                      }`}
                    />
                    <span className="text-board-parchment/60 text-sm">
                      {campaign.playerCount > 0
                        ? 'Players in lobby'
                        : 'Empty lobby'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-board-dark border-4 border-board-border rounded-lg shadow-2xl w-full max-w-md mx-4">
            <div className="bg-board-border px-6 py-4">
              <h2 className="text-board-parchment font-display text-2xl text-center">
                Create Campaign
              </h2>
            </div>
            <form onSubmit={handleCreateCampaign} className="p-6 space-y-6">
              <div>
                <label className="block text-board-parchment font-body text-sm mb-2">
                  Campaign Name
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="Enter campaign name..."
                  maxLength={40}
                  className="w-full px-4 py-3 bg-board-wood border-2 border-board-border rounded text-board-parchment placeholder-board-parchment/50 font-body text-lg focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded font-display text-lg bg-gray-700 text-gray-300 hover:bg-gray-600 border-2 border-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded font-display text-lg bg-amber-600 text-white hover:bg-amber-500 border-2 border-amber-400 transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
