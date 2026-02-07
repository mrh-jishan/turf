'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { fetchMessages } from '../lib/api';

interface Message {
  id: string;
  sender_id: string;
  sender_handle?: string;
  body: string;
  attachment_url?: string;
  attachment_type?: string;
  created_at: string;
}

interface Props {
  roomId: string;
  token: string | null;
  wsBase: string;
  currentUserId?: string;
  onlineCount?: number;
}

export default function ChatPanel({ roomId, token, wsBase, currentUserId, onlineCount = 0 }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const shouldLoadMoreRef = useRef(true);
  const isNearBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  // Check if user is scrolled near bottom
  const checkIfNearBottom = () => {
    if (!messagesContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 100;
  };

  // Scroll to bottom using direct scrollTop manipulation (avoids layout thrash)
  const scrollToBottom = () => {
    if (!isNearBottomRef.current || !messagesContainerRef.current) return;
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  };

  // Only scroll when new messages arrive (WebSocket), not on pagination
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      scrollToBottom();
      prevMessageCountRef.current = messages.length;
    }
  }, [messages]);

  // Track scroll position
  const handleScroll = () => {
    isNearBottomRef.current = checkIfNearBottom();
    
    if (!messagesContainerRef.current || isLoadingMore || !shouldLoadMoreRef.current) return;
    
    const { scrollTop } = messagesContainerRef.current;
    if (scrollTop < 50) {
      // User scrolled near top, load older messages
      loadOlderMessages();
    }
  };
  useEffect(() => {
    if (!token || !roomId) return;
    
    let cancelled = false;
    offsetRef.current = 0;
    shouldLoadMoreRef.current = true;
    setIsLoadingMore(false);
    prevMessageCountRef.current = 0;
    
    fetchMessages(token, roomId, 0, 50)
      .then((msgs) => {
        if (cancelled) return;
        // Convert to Message interface and set
        const formattedMessages = msgs.map((m: any) => ({
          id: m.id,
          sender_id: m.sender_id,
          sender_handle: m.sender_handle,
          body: m.body,
          attachment_url: m.attachment_url,
          attachment_type: m.attachment_type,
          created_at: m.created_at,
        }));
        setMessages(formattedMessages);
        prevMessageCountRef.current = formattedMessages.length;
        offsetRef.current = 50;
        shouldLoadMoreRef.current = msgs.length === 50;
      })
      .catch((err) => {
        console.error('Failed to fetch message history:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [token, roomId]);

  const loadOlderMessages = async () => {
    if (!token || !roomId || isLoadingMore || !shouldLoadMoreRef.current) return;
    
    setIsLoadingMore(true);
    try {
      const olderMessages = await fetchMessages(token, roomId, offsetRef.current, 50);
      
      // Convert to Message interface
      const formattedMessages: Message[] = olderMessages.map((m: any) => ({
        id: m.id,
        sender_id: m.sender_id,
        sender_handle: m.sender_handle,
        body: m.body,
        attachment_url: m.attachment_url,
        attachment_type: m.attachment_type,
        created_at: m.created_at,
      }));

      // Prepend older messages, filtering out duplicates
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const uniqueOlderMessages = formattedMessages.filter((m) => !existingIds.has(m.id));
        return [...uniqueOlderMessages, ...prev];
      });
      
      offsetRef.current += 50;
      shouldLoadMoreRef.current = olderMessages.length === 50;
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!roomId || !token) return;
    
    const ws = new WebSocket(`${wsBase}/ws/chat/${roomId}?token=${token}`);
    
    ws.onopen = () => {
      setIsConnected(true);
    };
    
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'message') {
          setMessages((prev) => {
            // Check if message already exists to prevent duplicates
            if (prev.some((m) => m.id === data.id)) {
              return prev;
            }
            // Keep only the most recent 200 messages to prevent memory leak
            return [...prev.slice(-199), data as Message];
          });
        }
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };
    
    ws.onclose = (event) => {
      setIsConnected(false);
      if (event.code === 4403) {
        console.warn('Not a member of this room. Join the room to chat.');
      }
    };
    
    wsRef.current = ws;
    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [roomId, token, wsBase]);

  async function send() {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !text.trim()) return;
    
    setIsSending(true);
    try {
      wsRef.current.send(JSON.stringify({ body: text.trim() }));
      setText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const formatTime = (created_at: string) => {
    try {
      const date = new Date(created_at);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col gap-2 bg-gradient-to-b from-white/5 to-white/2 backdrop-blur-sm border border-white/10 rounded-2xl p-3 h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <h3 className="text-xs font-semibold text-white">Chat</h3>
            <p className="text-[10px] text-slate-400 truncate">{roomId}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
            isConnected 
              ? 'bg-emerald-900/30 text-emerald-200 border border-emerald-500/30' 
              : 'bg-red-900/30 text-red-200 border border-red-500/30'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
            {isConnected ? 'On' : 'Off'}
          </div>
          {onlineCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-neon/10 text-neon text-[10px] font-medium border border-neon/30">
              {onlineCount}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto space-y-1 text-xs bg-black/20 p-2 rounded-lg border border-white/5"
      >
        {isLoadingMore && (
          <div className="flex justify-center py-1">
            <span className="text-[10px] text-slate-500 animate-pulse">Loading older messages...</span>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-slate-400 text-xs">No messages yet</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`group flex gap-1 ${
                m.sender_id === currentUserId ? 'flex-row-reverse' : ''
              }`}
            >
              <Link
                href={`/profile/${m.sender_id}`}
                className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold hover:opacity-80 transition ${
                  m.sender_id === currentUserId
                    ? 'bg-neon/20 text-neon'
                    : 'bg-purple/20 text-purple-300'
                }`}
              >
                {(m.sender_handle || m.sender_id.slice(0, 1)).charAt(0).toUpperCase()}
              </Link>
              <div className={`flex-1 flex flex-col gap-0.5 ${
                m.sender_id === currentUserId ? 'items-end' : 'items-start'
              }`}>
                <div className="flex items-center gap-1 flex-wrap">
                  <Link
                    href={`/profile/${m.sender_id}`}
                    className="text-[10px] text-neon hover:text-neon/80 hover:underline cursor-pointer truncate"
                    title={m.sender_handle || m.sender_id}
                  >
                    {m.sender_handle || `user-${m.sender_id.slice(0, 4)}`}
                  </Link>
                  <span className="text-[9px] text-slate-500">{formatTime(m.created_at)}</span>
                </div>
                <div className={`px-2 py-1 rounded text-xs max-w-[120px] break-words ${
                  m.sender_id === currentUserId
                    ? 'bg-neon/15 text-white border border-neon/30'
                    : 'bg-white/10 text-slate-100 border border-white/20'
                }`}>
                  <p className="leading-snug">{m.body}</p>
                  {m.attachment_url && (
                    <a
                      className="text-[9px] text-neon hover:underline mt-1 block"
                      href={m.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      📎
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="flex gap-1 pt-1 border-t border-white/10">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type..."
          rows={1}
          className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon/50 resize-none"
        />
        <button
          onClick={send}
          disabled={!isConnected || isSending || !text.trim()}
          className="px-2 py-1 bg-gradient-to-r from-neon/20 to-magenta/20 hover:from-neon/30 hover:to-magenta/30 disabled:opacity-50 disabled:cursor-not-allowed border border-neon rounded text-white text-xs font-semibold transition"
        >
          {isSending ? '·' : '→'}
        </button>
      </div>
    </div>
  );
}
