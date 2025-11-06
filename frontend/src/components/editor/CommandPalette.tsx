'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  action: () => void;
  category: 'file' | 'edit' | 'search' | 'session' | 'navigation';
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

export default function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cmd.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  const categoryColors = {
    file: 'text-blue-400',
    edit: 'text-green-400',
    search: 'text-yellow-400',
    session: 'text-purple-400',
    navigation: 'text-pink-400',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50">
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="p-4 border-b border-gray-700">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or search..."
              className="w-full bg-gray-900 text-white px-4 py-3 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 text-sm"
              autoFocus
            />
          </div>

          {/* Commands List */}
          <div className="max-h-96 overflow-y-auto">
            {filteredCommands.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No commands found</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            ) : (
              <div className="py-2">
                {filteredCommands.map((command, index) => (
                  <button
                    key={command.id}
                    onClick={() => {
                      command.action();
                      onClose();
                    }}
                    className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700 transition-colors ${
                      index === selectedIndex ? 'bg-gray-700' : ''
                    }`}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold ${categoryColors[command.category]}`}>
                        {command.category.toUpperCase()}
                      </span>
                      <div className="text-left">
                        <p className="text-sm text-white font-medium">{command.label}</p>
                        {command.description && (
                          <p className="text-xs text-gray-400 mt-0.5">{command.description}</p>
                        )}
                      </div>
                    </div>
                    {command.shortcut && (
                      <kbd className="px-2 py-1 text-xs bg-gray-900 text-gray-400 rounded border border-gray-700">
                        {command.shortcut}
                      </kbd>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-700 bg-gray-900/50">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span>
                  <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">↑↓</kbd> Navigate
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">Enter</kbd> Select
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">Esc</kbd> Close
                </span>
              </div>
              <span>{filteredCommands.length} commands</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
