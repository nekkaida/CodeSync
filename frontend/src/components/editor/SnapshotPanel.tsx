'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface Snapshot {
  id: string;
  session_id: string;
  user_id: string;
  yjs_state: string;
  change_summary: string | null;
  lines_added: number;
  lines_removed: number;
  created_at: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface SnapshotPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  onSnapshotRestore: () => void;
}

export default function SnapshotPanel({ isOpen, onClose, sessionId, onSnapshotRestore }: SnapshotPanelProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadSnapshots();
    }
  }, [isOpen, sessionId]);

  const loadSnapshots = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/snapshots/session/${sessionId}?limit=50&offset=0`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const data = await response.json();
        setSnapshots(data.data.snapshots || []);
      } else {
        toast.error('Failed to load snapshots');
      }
    } catch (error) {
      console.error('Failed to load snapshots:', error);
      toast.error('Failed to load snapshots');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!changeSummary.trim()) {
      toast.error('Please enter a summary for this snapshot');
      return;
    }

    setIsCreating(true);
    try {
      // Get CSRF token
      const csrfResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/csrf`, {
        credentials: 'include',
      });
      const csrfData = await csrfResponse.json();

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/snapshots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.token,
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId,
          yjsState: 'current-state', // In production, get actual Yjs state
          changeSummary,
          linesAdded: 0,
          linesRemoved: 0,
        }),
      });

      if (response.ok) {
        toast.success('Snapshot created successfully');
        setChangeSummary('');
        loadSnapshots();
      } else {
        const error = await response.json();
        toast.error(error.error?.message || 'Failed to create snapshot');
      }
    } catch (error) {
      console.error('Failed to create snapshot:', error);
      toast.error('Failed to create snapshot');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestoreSnapshot = async (snapshotId: string) => {
    if (!confirm('Are you sure you want to restore this snapshot? This will save the current state first.')) {
      return;
    }

    try {
      // Get CSRF token
      const csrfResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/csrf`, {
        credentials: 'include',
      });
      const csrfData = await csrfResponse.json();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/snapshots/${snapshotId}/restore`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfData.token,
          },
          credentials: 'include',
        }
      );

      if (response.ok) {
        toast.success('Snapshot restored successfully. Refresh to see changes.');
        onSnapshotRestore();
        loadSnapshots();
      } else {
        const error = await response.json();
        toast.error(error.error?.message || 'Failed to restore snapshot');
      }
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
      toast.error('Failed to restore snapshot');
    }
  };

  const handleDeleteSnapshot = async (snapshotId: string) => {
    if (!confirm('Are you sure you want to delete this snapshot? This action cannot be undone.')) {
      return;
    }

    try {
      // Get CSRF token
      const csrfResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/csrf`, {
        credentials: 'include',
      });
      const csrfData = await csrfResponse.json();

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/snapshots/${snapshotId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': csrfData.token,
        },
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Snapshot deleted successfully');
        loadSnapshots();
      } else {
        const error = await response.json();
        toast.error(error.error?.message || 'Failed to delete snapshot');
      }
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
      toast.error('Failed to delete snapshot');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 right-0 w-96 h-full bg-gray-800 border-l border-gray-700 flex flex-col z-10">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Code Snapshots</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            title="Close snapshots"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Create Snapshot Form */}
        <div className="space-y-2">
          <input
            type="text"
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder="Describe this snapshot..."
            className="w-full bg-gray-900 text-white px-3 py-2 rounded border border-gray-700 focus:outline-none focus:border-blue-500 text-sm"
          />
          <button
            onClick={handleCreateSnapshot}
            disabled={isCreating || !changeSummary.trim()}
            className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Create Snapshot
              </>
            )}
          </button>
        </div>

        {/* Info */}
        <div className="text-xs text-gray-400 mt-2">
          {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''} saved
        </div>
      </div>

      {/* Snapshots List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm">No snapshots yet</p>
          </div>
        ) : (
          snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className="p-3 border-b border-gray-700 hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="text-sm text-white font-medium mb-1">
                    {snapshot.change_summary || 'No description'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{snapshot.user.name}</span>
                    <span>•</span>
                    <span>{formatDate(snapshot.created_at)}</span>
                  </div>
                  {(snapshot.lines_added > 0 || snapshot.lines_removed > 0) && (
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      {snapshot.lines_added > 0 && (
                        <span className="text-green-400">+{snapshot.lines_added}</span>
                      )}
                      {snapshot.lines_removed > 0 && (
                        <span className="text-red-400">-{snapshot.lines_removed}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRestoreSnapshot(snapshot.id)}
                  className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Restore
                </button>
                <button
                  onClick={() => handleDeleteSnapshot(snapshot.id)}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
