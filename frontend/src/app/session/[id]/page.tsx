'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { sessionsAPI } from '@/lib/api';
import MonacoEditor, { type MonacoEditorRef } from '@/components/editor/MonacoEditor';
import ChatPanel from '@/components/chat/ChatPanel';
import FileExplorer from '@/components/editor/FileExplorer';
import InviteModal from '@/components/session/InviteModal';
import CommandPalette from '@/components/editor/CommandPalette';
import SearchPanel from '@/components/editor/SearchPanel';
import { useKeyboardShortcuts, formatShortcut, type KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import toast from 'react-hot-toast';

interface Session {
  id: string;
  name: string;
  description: string;
  language: string;
  visibility: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function SessionPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const editorRef = useRef<MonacoEditorRef>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<string>('main.js');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const loadSession = async () => {
      try {
        const response = await sessionsAPI.get(params.id);
        setSession(response.data);
      } catch (err: any) {
        setError(err.message || 'Failed to load session');
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [user, params.id, router]);

  // Define keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'k',
      ctrl: true,
      description: 'Open command palette',
      action: () => setIsCommandPaletteOpen(true),
    },
    {
      key: 's',
      ctrl: true,
      description: 'Save current file',
      action: () => {
        // File is auto-saved, just show feedback
        toast.success('File saved automatically');
      },
    },
    {
      key: 'i',
      ctrl: true,
      shift: true,
      description: 'Invite collaborators',
      action: () => setIsInviteModalOpen(true),
    },
    {
      key: 'f',
      ctrl: true,
      shift: true,
      description: 'Search across files',
      action: () => setIsSearchPanelOpen(true),
    },
    {
      key: 'Escape',
      description: 'Close modals',
      action: () => {
        setIsCommandPaletteOpen(false);
        setIsInviteModalOpen(false);
        setIsSearchPanelOpen(false);
      },
    },
  ];

  useKeyboardShortcuts(shortcuts, !isCommandPaletteOpen && !isInviteModalOpen);

  // Define commands for command palette
  const commands = [
    {
      id: 'open-command-palette',
      label: 'Open Command Palette',
      description: 'Show all available commands',
      shortcut: formatShortcut(shortcuts[0]),
      category: 'navigation' as const,
      action: () => setIsCommandPaletteOpen(true),
    },
    {
      id: 'save-file',
      label: 'Save Current File',
      description: 'Save changes to the current file',
      shortcut: formatShortcut(shortcuts[1]),
      category: 'file' as const,
      action: () => console.log('File saved'),
    },
    {
      id: 'invite-users',
      label: 'Invite Collaborators',
      description: 'Invite others to join this session',
      shortcut: formatShortcut(shortcuts[2]),
      category: 'session' as const,
      action: () => setIsInviteModalOpen(true),
    },
    {
      id: 'back-dashboard',
      label: 'Back to Dashboard',
      description: 'Return to the main dashboard',
      category: 'navigation' as const,
      action: () => router.push('/dashboard'),
    },
    {
      id: 'create-file',
      label: 'Create New File',
      description: 'Add a new file to the session',
      category: 'file' as const,
      action: () => {
        const fileName = prompt('Enter file name:');
        if (fileName) {
          setSelectedFile(fileName);
        }
      },
    },
    {
      id: 'search-files',
      label: 'Search Across Files',
      description: 'Find text in all files',
      shortcut: formatShortcut(shortcuts[3]),
      category: 'search' as const,
      action: () => setIsSearchPanelOpen(true),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading session...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Session Not Found</h2>
          <p className="text-gray-400 mb-6">{error || 'The session you are looking for does not exist'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-white transition-colors"
              title="Back to Dashboard"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">{session.name}</h1>
              {session.description && (
                <p className="text-sm text-gray-400">{session.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm flex items-center gap-2"
              title="Command Palette (Ctrl+K)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="hidden sm:inline">Commands</span>
            </button>
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2"
              title="Invite collaborators"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Invite
            </button>
            <span className="px-3 py-1 text-sm bg-blue-600/20 text-blue-400 rounded-full">
              {session.language}
            </span>
            <span className="text-sm text-gray-400">
              {user?.name}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* File Explorer */}
        <div className="w-64 overflow-hidden">
          <FileExplorer
            sessionId={params.id}
            onFileSelect={setSelectedFile}
            selectedFile={selectedFile}
          />
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden relative">
          <MonacoEditor
            ref={editorRef}
            sessionId={params.id}
            language={session.language.toLowerCase()}
            currentFile={selectedFile}
          />

          {/* Search Panel Overlay */}
          <SearchPanel
            isOpen={isSearchPanelOpen}
            onClose={() => setIsSearchPanelOpen(false)}
            sessionId={params.id}
            onResultClick={(filePath, line, column) => {
              setSelectedFile(filePath);
              setIsSearchPanelOpen(false);
              // Navigate to line/column in Monaco after file switch
              setTimeout(() => {
                editorRef.current?.revealLine(line, column);
              }, 100);
            }}
          />
        </div>

        {/* Chat Panel */}
        <div className="w-80 overflow-hidden">
          <ChatPanel sessionId={params.id} />
        </div>
      </div>

      {/* Invite Modal */}
      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        sessionId={params.id}
        sessionName={session.name}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commands}
      />
    </div>
  );
}
