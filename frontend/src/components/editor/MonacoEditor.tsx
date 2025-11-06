'use client';

import { useEffect, useRef, useState } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import type { editor } from 'monaco-editor';
import { useAuthStore } from '@/lib/auth-store';
import CursorPresence from './CursorPresence';

interface MonacoEditorProps {
  sessionId: string;
  language: string;
  currentFile: string;
}

export default function MonacoEditor({ sessionId, language, currentFile }: MonacoEditorProps) {
  const { user } = useAuthStore();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const yjsDocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const fileModelsRef = useRef<Map<string, { ytext: Y.Text; binding: MonacoBinding | null; model: editor.ITextModel }>>(new Map());
  const [userColor] = useState(() => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
    return colors[Math.floor(Math.random() * colors.length)];
  });

  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_YJS_URL || 'ws://localhost:4001';

    // Create Yjs document
    const ydoc = new Y.Doc();
    yjsDocRef.current = ydoc;

    // Connect to WebSocket provider
    const provider = new WebsocketProvider(WS_URL, sessionId, ydoc, {
      connect: true,
    });
    providerRef.current = provider;

    provider.on('status', (event: any) => {
      if (event.status === 'connected') {
        setConnectionStatus('connected');
      } else if (event.status === 'disconnected') {
        setConnectionStatus('disconnected');
      }
    });

    provider.on('sync', (isSynced: boolean) => {
      if (isSynced) {
        setLoading(false);
      }
    });

    // Auto-save all open files periodically
    const saveInterval = setInterval(async () => {
      fileModelsRef.current.forEach(async (fileModel, filePath) => {
        const content = fileModel.ytext.toString();
        try {
          await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${sessionId}/files/${encodeURIComponent(filePath)}/content`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ content }),
            }
          );
        } catch (error) {
          console.error(`Failed to save ${filePath}:`, error);
        }
      });
    }, 10000); // Save every 10 seconds

    return () => {
      // Cleanup
      clearInterval(saveInterval);

      // Destroy all file bindings and models
      fileModelsRef.current.forEach((fileModel) => {
        fileModel.binding?.destroy();
        fileModel.model.dispose();
      });
      fileModelsRef.current.clear();

      bindingRef.current?.destroy();
      provider.destroy();
      ydoc.destroy();
    };
  }, [sessionId]);

  // Effect to switch files when currentFile changes
  useEffect(() => {
    if (!editorRef.current || !yjsDocRef.current || !providerRef.current) return;

    const editor = editorRef.current;
    const ydoc = yjsDocRef.current;
    const provider = providerRef.current;

    // Destroy previous binding if exists
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }

    // Get or create file model
    let fileModel = fileModelsRef.current.get(currentFile);

    if (!fileModel) {
      // Create new Y.Text for this file
      const ytext = ydoc.getText(currentFile);

      // Create new Monaco model
      const model = editor.getModel() || (window as any).monaco.editor.createModel('', language);

      // Load initial content for this file
      loadFileContent(currentFile, ytext);

      fileModel = { ytext, binding: null, model };
      fileModelsRef.current.set(currentFile, fileModel);
    }

    // Set the model to the editor
    editor.setModel(fileModel.model);

    // Create new binding
    const binding = new MonacoBinding(
      fileModel.ytext,
      fileModel.model,
      new Set([editor]),
      provider.awareness
    );

    fileModel.binding = binding;
    bindingRef.current = binding;

    // Set awareness state with user info
    provider.awareness.setLocalStateField('user', {
      name: user?.name || 'Anonymous',
      color: userColor,
      file: currentFile,
    });
  }, [currentFile, language, user, userColor]);

  const loadFileContent = async (filePath: string, ytext: Y.Text) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${sessionId}/files/${encodeURIComponent(filePath)}/content`,
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.content && ytext.length === 0) {
          ytext.insert(0, data.content);
        }
      }
    } catch (error) {
      console.error('Failed to load file content:', error);
    }
  };

  const handleEditorDidMount = (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;

    if (yjsDocRef.current && providerRef.current) {
      // Set awareness state with user info
      providerRef.current.awareness.setLocalStateField('user', {
        name: user?.name || 'Anonymous',
        color: userColor,
        file: currentFile,
      });

      // Track cursor position
      editor.onDidChangeCursorPosition((e) => {
        if (providerRef.current) {
          providerRef.current.awareness.setLocalStateField('cursor', {
            line: e.position.lineNumber,
            column: e.position.column,
          });
        }
      });
    }
  };

  return (
    <div className="h-full w-full relative">
      {/* Cursor Presence */}
      <CursorPresence provider={providerRef.current} />

      {/* Connection Status */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-gray-800/90 rounded-lg border border-gray-700">
        <div
          className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected'
              ? 'bg-green-500'
              : connectionStatus === 'connecting'
              ? 'bg-yellow-500 animate-pulse'
              : 'bg-red-500'
          }`}
        />
        <span className="text-xs text-gray-300">
          {connectionStatus === 'connected'
            ? 'Connected'
            : connectionStatus === 'connecting'
            ? 'Connecting...'
            : 'Disconnected'}
        </span>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Syncing document...</p>
          </div>
        </div>
      )}

      {/* Monaco Editor */}
      <Editor
        height="100%"
        language={language}
        theme="vs-dark"
        options={{
          fontSize: 14,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          formatOnPaste: true,
          formatOnType: true,
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: 'on',
          quickSuggestions: true,
          parameterHints: { enabled: true },
          lineNumbers: 'on',
          renderLineHighlight: 'all',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
        }}
        onMount={handleEditorDidMount}
        loading={
          <div className="flex items-center justify-center h-full bg-gray-900">
            <div className="text-gray-400">Loading editor...</div>
          </div>
        }
      />
    </div>
  );
}
