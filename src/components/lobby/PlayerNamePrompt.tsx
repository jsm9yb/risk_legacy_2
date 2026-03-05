import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useLobbyStore } from '@/store/lobbyStore';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: Record<string, string | number>
          ) => void;
        };
      };
    };
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payload);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

interface PlayerNamePromptProps {
  joinLobby: (campaignId: string, playerName: string, playerTokenOverride?: string) => void;
  getCampaignParticipants: (campaignId: string) => void;
}

export function PlayerNamePrompt({ joinLobby, getCampaignParticipants }: PlayerNamePromptProps) {
  const {
    showNamePrompt,
    playerName,
    authType,
    authEmail,
    authSub,
    pendingCampaignId,
    pendingCampaignParticipants,
    pendingSelectedOdId,
    pendingRequireSeatClaim,
    setPendingSelectedOdId,
    setGuestIdentity,
    setGoogleIdentity,
    closeNamePrompt,
  } = useLobbyStore();

  const googleButtonRef = useRef<HTMLDivElement>(null);

  const [authMode, setAuthMode] = useState<'google' | 'guest'>(authType || 'guest');
  const [guestName, setGuestName] = useState(playerName || '');
  const [error, setError] = useState<string | null>(null);

  const googleClientId = (import.meta as { env?: { VITE_GOOGLE_CLIENT_ID?: string } }).env?.VITE_GOOGLE_CLIENT_ID;
  const requiresPlayerSelection = pendingRequireSeatClaim;
  const selectedPlayerName = useMemo(
    () => pendingCampaignParticipants.find((p) => p.odId === pendingSelectedOdId)?.name || null,
    [pendingCampaignParticipants, pendingSelectedOdId]
  );

  useEffect(() => {
    if (!showNamePrompt) {
      return;
    }
    setAuthMode(authType || 'guest');
    setGuestName(playerName || '');
    setError(null);
  }, [showNamePrompt, authType, playerName]);

  useEffect(() => {
    if (showNamePrompt && pendingCampaignId && pendingRequireSeatClaim) {
      getCampaignParticipants(pendingCampaignId);
    }
  }, [showNamePrompt, pendingCampaignId, pendingRequireSeatClaim, getCampaignParticipants]);

  useEffect(() => {
    if (!showNamePrompt || authMode !== 'google' || authSub) {
      return;
    }
    if (!googleClientId || !googleButtonRef.current) {
      return;
    }

    const init = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) {
        return;
      }
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: ({ credential }) => {
          const payload = decodeJwtPayload(credential);
          const name = String(payload?.name || '');
          const email = String(payload?.email || '');
          const sub = String(payload?.sub || '');
          if (!name || !email || !sub) {
            setError('Google sign-in failed. Please try again.');
            return;
          }
          setGoogleIdentity(name, email, sub);
          setError(null);
        },
      });

      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 280,
      });
    };

    if (window.google?.accounts?.id) {
      init();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = init;
    document.head.appendChild(script);
  }, [showNamePrompt, authMode, authSub, googleClientId, setGoogleIdentity]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!pendingCampaignId) {
        setError('No campaign selected');
        return;
      }

      let effectiveName = playerName || '';
      if (authMode === 'guest') {
        const trimmed = guestName.trim();
        if (!trimmed) {
          setError('Guest name is required.');
          return;
        }
        setGuestIdentity(trimmed);
        effectiveName = trimmed;
      } else {
        if (!authSub || !playerName) {
          setError('Sign in with Google first.');
          return;
        }
        effectiveName = playerName;
      }

      if (requiresPlayerSelection && !pendingSelectedOdId) {
        setError('Select the player ID you are playing as.');
        return;
      }

      joinLobby(
        pendingCampaignId,
        effectiveName,
        requiresPlayerSelection ? pendingSelectedOdId || undefined : undefined
      );
      closeNamePrompt();
    },
    [
      pendingCampaignId,
      playerName,
      authMode,
      guestName,
      authSub,
      requiresPlayerSelection,
      pendingSelectedOdId,
      setGuestIdentity,
      joinLobby,
      closeNamePrompt,
    ]
  );

  const handleCancel = useCallback(() => {
    closeNamePrompt();
  }, [closeNamePrompt]);

  if (!showNamePrompt) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-board-dark border-4 border-board-border rounded-lg shadow-2xl w-full max-w-lg mx-4">
        <div className="bg-board-border px-6 py-4">
          <h2 className="text-board-parchment font-display text-2xl text-center">
            Join Campaign
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAuthMode('guest')}
              className={`flex-1 py-2 rounded border-2 font-body transition-colors ${
                authMode === 'guest'
                  ? 'bg-amber-700 border-amber-400 text-white'
                  : 'bg-board-wood border-board-border text-board-parchment/80'
              }`}
            >
              Continue as Guest
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('google')}
              className={`flex-1 py-2 rounded border-2 font-body transition-colors ${
                authMode === 'google'
                  ? 'bg-amber-700 border-amber-400 text-white'
                  : 'bg-board-wood border-board-border text-board-parchment/80'
              }`}
            >
              Sign in with Google
            </button>
          </div>

          {authMode === 'guest' ? (
            <div>
              <label className="block text-board-parchment font-body text-sm mb-2">
                Guest Name
              </label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Enter your guest name..."
                maxLength={20}
                className="w-full px-4 py-3 bg-board-wood border-2 border-board-border rounded text-board-parchment placeholder-board-parchment/50 font-body text-lg focus:outline-none focus:border-amber-500"
              />
            </div>
          ) : (
            <div className="space-y-2">
              {!googleClientId && (
                <div className="text-amber-300 font-body text-sm">
                  Google sign-in is not configured. Set `VITE_GOOGLE_CLIENT_ID` to enable it.
                </div>
              )}
              {authSub ? (
                <div className="rounded border border-green-700 bg-green-950/40 px-3 py-2 text-green-200 font-body text-sm">
                  Signed in as {playerName} ({authEmail})
                </div>
              ) : (
                <div ref={googleButtonRef} />
              )}
            </div>
          )}

          {requiresPlayerSelection && (
            <div>
              <label className="block text-board-parchment font-body text-sm mb-2">
                Select Player ID
              </label>
              <select
                value={pendingSelectedOdId || ''}
                onChange={(e) => setPendingSelectedOdId(e.target.value || null)}
                className="w-full px-4 py-3 bg-board-wood border-2 border-board-border rounded text-board-parchment font-body text-lg focus:outline-none focus:border-amber-500"
              >
                <option value="" disabled>
                  Select player ID...
                </option>
                {pendingCampaignParticipants.map((p) => (
                  <option key={p.odId} value={p.odId}>
                    {p.name} ({p.odId})
                  </option>
                ))}
              </select>
              {selectedPlayerName && (
                <p className="text-board-parchment/60 text-sm mt-1">
                  Playing as: {selectedPlayerName}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="rounded border border-red-700 bg-red-950/50 px-3 py-2 text-red-200 font-body text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 py-3 rounded font-display text-lg bg-gray-700 text-gray-300 hover:bg-gray-600 border-2 border-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded font-display text-lg transition-colors bg-green-600 text-white hover:bg-green-500 border-2 border-green-400"
            >
              Join Lobby
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
