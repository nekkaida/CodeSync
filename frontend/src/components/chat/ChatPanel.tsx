'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '../../../../shared/contracts/socket-events';

interface Message {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
}

interface Participant {
  userId: string;
  userName: string;
  color: string;
  cursor?: { line: number; column: number };
}

interface ChatPanelProps {
  sessionId: string;
}

export default function ChatPanel({ sessionId }: ChatPanelProps) {
  const { user } = useAuthStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;

    const WS_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const socketInstance = io(WS_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      setReconnectAttempts(0);
      // Join session room
      socketInstance.emit(SOCKET_EVENTS.SESSION_JOIN, sessionId);
      console.log('WebSocket connected');
    });

    socketInstance.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      setIsConnected(false);
      console.log('WebSocket disconnected:', reason);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
    });

    socketInstance.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      setReconnectAttempts(0);
    });

    socketInstance.on('reconnect_attempt', (attemptNumber) => {
      console.log('WebSocket reconnection attempt', attemptNumber);
      setReconnectAttempts(attemptNumber);
    });

    socketInstance.on('reconnect_error', (error) => {
      console.error('WebSocket reconnection error:', error);
    });

    socketInstance.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed after max attempts');
    });

    // Handle incoming messages
    socketInstance.on(SOCKET_EVENTS.CHAT_MESSAGE_NEW, (message: any) => {
      setMessages((prev) => [...prev, {
        id: message.id,
        userId: message.user_id,
        userName: message.user.name,
        content: message.content,
        timestamp: new Date(message.created_at),
      }]);
    });

    // Handle user joined
    socketInstance.on(SOCKET_EVENTS.USER_JOINED, (data: any) => {
      // Add to participants or show notification
      console.log('User joined:', data);
    });

    // Handle user left
    socketInstance.on(SOCKET_EVENTS.USER_LEFT, (data: any) => {
      // Remove from participants or show notification
      console.log('User left:', data);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user, sessionId]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !newMessage.trim()) return;

    socket.emit(SOCKET_EVENTS.CHAT_MESSAGE_SEND, {
      sessionId,
      content: newMessage.trim(),
      type: 'TEXT',
    });

    setNewMessage('');
  };

  return (
    <div className="h-full bg-gray-800 border-l border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-2">Chat</h3>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : reconnectAttempts > 0 ? 'bg-yellow-500' : 'bg-red-500'}`}
          />
          <span className="text-xs text-gray-400">
            {isConnected
              ? 'Connected'
              : reconnectAttempts > 0
              ? `Reconnecting... (${reconnectAttempts})`
              : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Participants */}
      <div className="p-4 border-b border-gray-700">
        <h4 className="text-sm font-medium text-gray-400 mb-2">
          Participants ({participants.length})
        </h4>
        <div className="space-y-2">
          {participants.map((participant) => (
            <div key={participant.userId} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: participant.color }}
              />
              <span className="text-sm text-gray-300">{participant.userName}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">Start a conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-blue-400">
                  {message.userName}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-sm text-gray-300 break-words">{message.content}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            disabled={!isConnected}
          />
          <button
            type="submit"
            disabled={!isConnected || !newMessage.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
