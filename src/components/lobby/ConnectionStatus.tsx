/**
 * Connection status indicator component
 */

import { useLobbyStore } from '@/store/lobbyStore';

export function ConnectionStatus() {
  const { isConnected, connectionError } = useLobbyStore();

  return (
    <div className="flex items-center gap-2">
      {/* Status dot */}
      <div
        className={`w-2.5 h-2.5 rounded-full ${
          isConnected
            ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]'
            : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]'
        }`}
      />

      {/* Status text */}
      <span
        className={`text-sm font-body ${
          isConnected ? 'text-green-400' : 'text-red-400'
        }`}
      >
        {isConnected ? 'Connected' : connectionError || 'Disconnected'}
      </span>
    </div>
  );
}
