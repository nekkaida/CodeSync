'use client';

import { useEffect, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';

interface User {
  clientId: number;
  name: string;
  color: string;
  cursor?: {
    line: number;
    column: number;
  };
}

interface CursorPresenceProps {
  provider: WebsocketProvider | null;
}

export default function CursorPresence({ provider }: CursorPresenceProps) {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!provider) return;

    const awareness = provider.awareness;

    const updateUsers = () => {
      const states = Array.from(awareness.getStates().entries());
      const activeUsers = states
        .filter(([clientId]) => clientId !== awareness.clientID)
        .map(([clientId, state]: [number, any]) => ({
          clientId,
          name: state.user?.name || 'Anonymous',
          color: state.user?.color || '#888888',
          cursor: state.cursor,
        }));
      setUsers(activeUsers);
    };

    awareness.on('change', updateUsers);
    updateUsers();

    return () => {
      awareness.off('change', updateUsers);
    };
  }, [provider]);

  if (users.length === 0) return null;

  return (
    <div className="absolute top-16 right-4 z-10 bg-gray-800/90 rounded-lg border border-gray-700 p-3 min-w-[200px]">
      <h4 className="text-xs font-semibold text-gray-400 mb-2">Active Users ({users.length})</h4>
      <div className="space-y-2">
        {users.map((user) => (
          <div key={user.clientId} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: user.color }}
            />
            <span className="text-sm text-gray-300">{user.name}</span>
            {user.cursor && (
              <span className="text-xs text-gray-500 ml-auto">
                {user.cursor.line}:{user.cursor.column}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
