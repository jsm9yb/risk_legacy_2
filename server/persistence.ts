/**
 * File persistence for campaigns and game state
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CampaignSummary, CampaignFull, PersistedGameState } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const CAMPAIGNS_FILE = join(DATA_DIR, 'campaigns.json');
const CAMPAIGNS_DIR = join(DATA_DIR, 'campaigns');

/**
 * Ensure data directories exist
 */
function ensureDataDirs(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!existsSync(CAMPAIGNS_DIR)) {
    mkdirSync(CAMPAIGNS_DIR, { recursive: true });
  }
}

// ============================================
// Campaign Summary List (campaigns.json)
// ============================================

/**
 * Load campaign summaries from disk
 */
export function loadCampaigns(): CampaignSummary[] {
  ensureDataDirs();
  if (!existsSync(CAMPAIGNS_FILE)) {
    return [];
  }
  try {
    const data = JSON.parse(readFileSync(CAMPAIGNS_FILE, 'utf-8'));
    return data.campaigns || [];
  } catch {
    return [];
  }
}

/**
 * Save campaign summaries to disk
 */
export function saveCampaigns(campaigns: CampaignSummary[]): void {
  ensureDataDirs();
  writeFileSync(
    CAMPAIGNS_FILE,
    JSON.stringify({ campaigns, version: 1 }, null, 2)
  );
}

// ============================================
// Full Campaign Data (campaigns/{id}.json)
// ============================================

/**
 * Get the file path for a campaign's full data
 */
function getCampaignFilePath(campaignId: string): string {
  return join(CAMPAIGNS_DIR, `${campaignId}.json`);
}

/**
 * Get the file path for a campaign's active game state
 */
function getGameStateFilePath(campaignId: string): string {
  return join(CAMPAIGNS_DIR, `${campaignId}_game.json`);
}

/**
 * Load full campaign data including history
 */
export function loadCampaignFull(campaignId: string): CampaignFull | null {
  ensureDataDirs();
  const filePath = getCampaignFilePath(campaignId);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    return data as CampaignFull;
  } catch (error) {
    console.error(`Failed to load campaign ${campaignId}:`, error);
    return null;
  }
}

/**
 * Save full campaign data
 */
export function saveCampaignFull(campaign: CampaignFull): void {
  ensureDataDirs();
  const filePath = getCampaignFilePath(campaign.id);

  writeFileSync(
    filePath,
    JSON.stringify(campaign, null, 2)
  );
}

/**
 * Create a new full campaign with empty history
 */
export function createCampaignFull(id: string, name: string): CampaignFull {
  const campaign: CampaignFull = {
    id,
    name,
    createdAt: Date.now(),
    gamesPlayed: 0,
    currentGameId: null,
    persistentTerritories: {},
    completedGames: [],
    packetsOpened: [],
    participants: [],
  };

  saveCampaignFull(campaign);
  return campaign;
}

/**
 * Delete full campaign data and any active game state
 */
export function deleteCampaignFull(campaignId: string): void {
  const campaignPath = getCampaignFilePath(campaignId);
  const gamePath = getGameStateFilePath(campaignId);

  if (existsSync(campaignPath)) {
    unlinkSync(campaignPath);
  }
  if (existsSync(gamePath)) {
    unlinkSync(gamePath);
  }
}

// ============================================
// Game State (campaigns/{id}_game.json)
// ============================================

/**
 * Load active game state for a campaign
 */
export function loadGameState(campaignId: string): PersistedGameState | null {
  ensureDataDirs();
  const filePath = getGameStateFilePath(campaignId);

  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    return data as PersistedGameState;
  } catch (error) {
    console.error(`Failed to load game state for campaign ${campaignId}:`, error);
    return null;
  }
}

/**
 * Save active game state for a campaign
 */
export function saveGameState(campaignId: string, state: PersistedGameState): void {
  ensureDataDirs();
  const filePath = getGameStateFilePath(campaignId);

  // Update timestamp before saving
  state.lastUpdatedAt = Date.now();

  writeFileSync(
    filePath,
    JSON.stringify(state, null, 2)
  );
}

/**
 * Delete active game state (called when game finishes)
 */
export function deleteGameState(campaignId: string): void {
  const filePath = getGameStateFilePath(campaignId);

  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

/**
 * Check if a campaign has an active game
 */
export function hasActiveGame(campaignId: string): boolean {
  const filePath = getGameStateFilePath(campaignId);
  return existsSync(filePath);
}
