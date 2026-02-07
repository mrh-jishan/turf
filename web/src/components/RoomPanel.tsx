import { useEffect, useState } from 'react';
import { fetchPreviousRooms, trackRoomAccess } from '../lib/api';

interface Props {
  roomId: string;
  onRoomChange: (roomId: string) => void;
  token?: string | null;
}

interface PreviousRoom {
  room_id: string;
  last_accessed: string;
}

export default function RoomPanel({ roomId, onRoomChange, token }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [newRoomId, setNewRoomId] = useState(roomId);
  const [copiedText, setCopiedText] = useState('');
  const [previousRooms, setPreviousRooms] = useState<PreviousRoom[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load previous rooms when component mounts
  useEffect(() => {
    const loadPreviousRooms = async () => {
      if (!token) return;
      setIsLoading(true);
      try {
        const rooms = await fetchPreviousRooms(token);
        setPreviousRooms(rooms);
      } catch (err) {
        console.error('Failed to load previous rooms:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadPreviousRooms();
  }, [token]);

  // Track room access when roomId changes
  useEffect(() => {
    const trackAccess = async () => {
      if (!token || !roomId || roomId === 'demo-room') return;
      try {
        await trackRoomAccess(token, roomId);
        // Refresh the previous rooms list
        const rooms = await fetchPreviousRooms(token);
        setPreviousRooms(rooms);
      } catch (err) {
        console.error('Failed to track room access:', err);
      }
    };
    trackAccess();
  }, [roomId, token]);

  const handleSave = () => {
    if (newRoomId.trim() && newRoomId !== roomId) {
      onRoomChange(newRoomId.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setNewRoomId(roomId);
    setIsEditing(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedText('Copied!');
    setTimeout(() => setCopiedText(''), 2000);
  };

  const handleRoomClick = (room_id: string) => {
    onRoomChange(room_id);
  };

  return (
    <div className="flex flex-col gap-2 bg-gradient-to-br from-white/5 to-white/2 backdrop-blur-sm border border-white/10 rounded-2xl p-3 h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-white">Room</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Share room ID</p>
        </div>
        <div className="px-1.5 py-0.5 rounded-full bg-purple/10 text-purple-300 text-[10px] font-medium border border-purple/30">
          ID
        </div>
      </div>

      {/* Current Room Display */}
      <div className="space-y-1">
        <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">Room ID</label>
        <div className="flex items-center gap-1">
          <div className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 flex items-center justify-between min-w-0" title={roomId}>
            <code className="text-xs text-slate-200 truncate">{roomId.substring(0, 12)}...</code>
          </div>
          <button
            onClick={handleCopy}
            className="px-2 py-1 bg-white/10 hover:bg-white/15 border border-white/20 rounded text-white text-xs transition flex-shrink-0"
            title="Copy full ID"
          >
            {copiedText || '📋'}
          </button>
        </div>
      </div>

      {/* Room Info */}
      <div className="space-y-1 bg-black/20 border border-white/5 rounded p-2 text-[10px]">
        <div className="flex items-start gap-1">
          <span>🔐</span>
          <div>
            <p className="font-semibold text-slate-200">Private</p>
            <p className="text-slate-400">Friends only</p>
          </div>
        </div>
        <div className="flex items-start gap-1">
          <span>🌐</span>
          <div>
            <p className="font-semibold text-slate-200">Share</p>
            <p className="text-slate-400">Send ID to invite</p>
          </div>
        </div>
      </div>

      {/* Previous Rooms Section */}
      {previousRooms.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">Previous Rooms</p>
          <div className="space-y-0.5 max-h-[140px] overflow-y-auto">
            {previousRooms.map((room) => (
              <button
                key={room.room_id}
                onClick={() => handleRoomClick(room.room_id)}
                className={`w-full text-left rounded border px-2 py-1 transition text-[10px] flex items-center gap-1 min-w-0 ${
                  room.room_id === roomId
                    ? 'border-neon bg-neon/10 text-white'
                    : 'border-white/15 text-slate-300 hover:border-white/30 hover:bg-white/5'
                }`}
                title={room.room_id}
              >
                <span className="truncate font-medium flex-1">{room.room_id}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Change Room Section */}
      <div className="space-y-1">
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="w-full px-2 py-1 bg-neon/10 hover:bg-neon/20 border border-neon rounded text-neon font-semibold transition text-[10px]"
          >
            Change ID
          </button>
        ) : (
          <div className="space-y-1">
            <input
              type="text"
              value={newRoomId}
              onChange={(e) => setNewRoomId(e.target.value)}
              placeholder="New ID"
              className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white placeholder-slate-400 focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon/50 text-xs"
            />
            <div className="flex gap-1">
              <button
                onClick={handleSave}
                className="flex-1 px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500 rounded text-emerald-200 font-semibold transition text-xs"
              >
                OK
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 px-2 py-1 bg-white/10 hover:bg-white/15 border border-white/20 rounded text-white font-semibold transition text-xs"
              >
                X
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
