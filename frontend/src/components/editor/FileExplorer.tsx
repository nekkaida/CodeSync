'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
}

interface FileExplorerProps {
  sessionId: string;
  onFileSelect: (path: string) => void;
  selectedFile?: string;
}

export default function FileExplorer({ sessionId, onFileSelect, selectedFile }: FileExplorerProps) {
  const [files, setFiles] = useState<FileNode[]>([
    {
      id: '1',
      name: 'main.js',
      type: 'file',
      path: 'main.js',
    },
  ]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode } | null>(null);

  useEffect(() => {
    // Load file structure from backend
    const loadFiles = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${sessionId}/files`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.files && data.files.length > 0) {
            setFiles(data.files);
          }
        }
      } catch (error) {
        console.error('Failed to load files:', error);
      }
    };

    loadFiles();
  }, [sessionId]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleNewFile = async () => {
    const fileName = prompt('Enter file name:');
    if (!fileName) return;

    const newFile: FileNode = {
      id: Date.now().toString(),
      name: fileName,
      type: 'file',
      path: fileName,
    };

    setFiles((prev) => [...prev, newFile]);
    setContextMenu(null);

    // Create file on backend
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${sessionId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: fileName, type: 'file' }),
      });
    } catch (error) {
      console.error('Failed to create file:', error);
    }
  };

  const handleNewFolder = async () => {
    const folderName = prompt('Enter folder name:');
    if (!folderName) return;

    const newFolder: FileNode = {
      id: Date.now().toString(),
      name: folderName,
      type: 'folder',
      path: folderName,
      children: [],
    };

    setFiles((prev) => [...prev, newFolder]);
    setContextMenu(null);

    // Create folder on backend
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${sessionId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: folderName, type: 'folder' }),
      });
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  const handleDelete = async (node: FileNode) => {
    if (!confirm(`Delete ${node.name}?`)) return;

    setFiles((prev) => prev.filter((f) => f.id !== node.id));
    setContextMenu(null);

    // Delete on backend
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${sessionId}/files/${node.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.id);
    const isSelected = selectedFile === node.path;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 px-2 py-1.5 hover:bg-gray-700/50 cursor-pointer ${
            isSelected ? 'bg-blue-600/20' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (node.type === 'folder') {
              toggleFolder(node.id);
            } else {
              onFileSelect(node.path);
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, node)}
        >
          {node.type === 'folder' && (
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          <span className="text-xl">{node.type === 'folder' ? '📁' : '📄'}</span>
          <span className="text-sm text-gray-300">{node.name}</span>
        </div>
        {node.type === 'folder' && isExpanded && node.children && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Files</h3>
        <div className="flex gap-1">
          <button
            onClick={handleNewFile}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="New File"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button
            onClick={handleNewFolder}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title="New Folder"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            <p>No files yet</p>
            <p className="mt-1 text-xs">Click + to create a file</p>
          </div>
        ) : (
          files.map((node) => renderNode(node))
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-30 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[150px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={() => handleDelete(contextMenu.node)}
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
