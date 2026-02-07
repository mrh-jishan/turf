import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Map, { ClaimFeature } from '../components/Map';
import ChatPanel from '../components/ChatPanel';
import RoomPanel from '../components/RoomPanel';
import AddressAutocomplete from '../components/AddressAutocomplete';
import SiteLayout from '../components/SiteLayout';
import { createBuild, createClaim, fetchFog, fetchNearby, fetchVisibility, me, fetchMyClaims, deleteClaim, updateClaimLabel } from '../lib/api';
import { flags, prefabs } from '../lib/prefabs';

const usaCenter: [number, number] = [-98.5795, 39.8283];
const usaBounds = {
  west: -125,
  east: -66,
  south: 24,
  north: 50,
};

export default function AppPage() {
  const router = useRouter();
  const [lat, setLat] = useState(usaCenter[1]);
  const [lon, setLon] = useState(usaCenter[0]);
  const [claims, setClaims] = useState<ClaimFeature[]>([]);
  const [myClaims, setMyClaims] = useState<any[]>([]);
  const [edittingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [editingClaimLabel, setEditingClaimLabel] = useState('');
  const [prefab, setPrefab] = useState(prefabs[0].id);
  const [flag, setFlag] = useState(flags[0].id);
  const [height, setHeight] = useState(20);
  const [address, setAddress] = useState('123 Demo St');
  const [claimLabel, setClaimLabel] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [fogGeojson, setFogGeojson] = useState<any>(null);
  const [visibleGeojson, setVisibleGeojson] = useState<any>(null);
  const [roomId, setRoomId] = useState<string>('demo-room');
  const wsBase = process.env.NEXT_PUBLIC_WS_BASE || 'ws://localhost:8000';

  const center = useMemo(() => [lon, lat] as [number, number], [lat, lon]);

  // Hydrate roomId from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    const savedRoomId = window.localStorage.getItem('last_room_id');
    if (savedRoomId) {
      setRoomId(savedRoomId);
    }
  }, []);

  useEffect(() => {
    const t = window.localStorage.getItem('turf_token');
    if (!t) {
      router.replace('/login');
      return;
    }
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    me(token)
      .then(setCurrentUser)
      .catch(() => {
        window.localStorage.removeItem('turf_token');
        router.replace('/login');
      });
  }, [token, router]);

  useEffect(() => {
    if (!token) return;
    fetchMyClaims(token)
      .then(setMyClaims)
      .catch(() => setMyClaims([]));
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    fetchNearby(lat, lon, 2000)
      .then((res) => {
        if (cancelled) return;
        const mapped = res.map((c: any) => ({ ...c, prefab: 'cyber', flag: 'usa', height_m: 12 }));
        setClaims(mapped);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchVisibility(token, lat, lon, 50)
      .then((res) => {
        if (cancelled) return;
        setVisibleGeojson(res.visible_geojson);
      })
      .catch(() => {});
    fetchFog(token, lat, lon, 50)
      .then((res) => {
        if (cancelled) return;
        setFogGeojson(res.fog_geojson);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, lat, lon]);

  useEffect(() => {
    window.localStorage.setItem('last_room_id', roomId);
  }, [roomId]);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const clampUSA = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  async function handleClaim() {
    if (!currentUser) return;
    const safeLat = clampUSA(lat, usaBounds.south, usaBounds.north);
    const safeLon = clampUSA(lon, usaBounds.west, usaBounds.east);
    try {
      const claim = await createClaim({ lat: safeLat, lon: safeLon, address_label: claimLabel || address });
      const build = await createBuild({
        claim_id: claim.id,
        prefab,
        flag,
        height_m: height,
      });
      setClaims((prev) => [...prev, { ...claim, prefab: build.prefab, flag: build.flag, height_m: build.height_m }]);
      setMyClaims((prev) => [...prev, { id: claim.id, address_label: claim.address_label, lat: claim.lat, lon: claim.lon, builds: [build], created_at: new Date().toISOString() }]);
      setClaimLabel('');
      setMessage({ type: 'success', text: 'Claim created successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to claim/build.' });
    }
  }

  async function handleDeleteClaim(claimId: string) {
    if (!token) return;
    if (!window.confirm('Are you sure you want to delete this claim?')) return;

    try {
      await deleteClaim(claimId, token);
      setMyClaims((prev) => prev.filter((c) => c.id !== claimId));
      setClaims((prev) => prev.filter((c) => c.id !== claimId));
      setMessage({ type: 'success', text: 'Claim deleted successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete claim.' });
    }
  }

  async function handleSaveClaimLabel() {
    if (!token || !edittingClaimId) return;

    try {
      const updated = await updateClaimLabel(edittingClaimId, editingClaimLabel, token);
      setMyClaims((prev) =>
        prev.map((c) =>
          c.id === edittingClaimId ? { ...c, address_label: updated.address_label } : c
        )
      );
      setEditingClaimId(null);
      setEditingClaimLabel('');
      setMessage({ type: 'success', text: 'Claim updated!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update claim.' });
    }
  }

  function logout() {
    window.localStorage.removeItem('turf_token');
    router.replace('/login');
  }

  return (
    <SiteLayout currentUser={currentUser} onLogout={logout}>
      <Head>
        <title>App | Turf</title>
      </Head>
      <main className="px-4 py-4 sm:px-0 text-white">
        {/* Notification Toast */}
        {message && (
          <div className={`fixed top-4 right-4 z-50 max-w-sm rounded-lg border px-4 py-3 ${
            message.type === 'success'
              ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-200'
              : 'bg-red-900/30 border-red-500/50 text-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <p className="font-medium">{message.text}</p>
              <button
                onClick={() => setMessage(null)}
                className="ml-4 text-lg opacity-70 hover:opacity-100"
              >
                ×
              </button>
            </div>
          </div>
        )}
        <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Map</p>
            <h1 className="text-2xl sm:text-3xl font-semibold">Welcome{currentUser ? `, ${currentUser.handle}` : ''}</h1>
          </div>
          <div className="flex gap-1 text-xs text-slate-200">
            <span className="px-2 py-0.5 rounded-full bg-magenta/20 border border-magenta/40">Verified: 50m</span>
          </div>
        </header>

        <section className="mt-6 grid gap-6 grid-cols-[1.65fr_1.05fr_0.85fr] h-[calc(100vh-160px)]">
          {/* Map - Left Column */}
          <Map center={center} claims={claims} fogGeojson={fogGeojson} visibleGeojson={visibleGeojson} onLocationSelect={(lat, lon) => { setLat(lat); setLon(lon); }} />

          {/* Build Panel - Middle Column */}
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-3 shadow-glow flex flex-col gap-2 overflow-hidden relative">
            <h2 className="text-sm font-semibold flex-shrink-0">Build</h2>

            <div className="space-y-2 overflow-y-auto flex-1 pr-1.5" style={{ overflowY: 'auto' }}>
              {/* Location Section */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Location</p>
                <div className="space-y-1 text-xs">
                  <input
                    value={lat}
                    onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-0.5 text-white text-xs focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon/50"
                    type="number"
                    step="0.0001"
                    min={usaBounds.south}
                    max={usaBounds.north}
                    placeholder="Lat"
                  />
                  <input
                    value={lon}
                    onChange={(e) => setLon(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-0.5 text-white text-xs focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon/50"
                    type="number"
                    step="0.0001"
                    min={usaBounds.west}
                    max={usaBounds.east}
                    placeholder="Lon"
                  />
                  <div className="relative">
                    <AddressAutocomplete
                      value={address}
                      onChange={setAddress}
                      onLocationSelect={(lat, lon) => {
                        setLat(lat);
                        setLon(lon);
                      }}
                    />
                  </div>
                  <input
                    value={claimLabel}
                    onChange={(e) => setClaimLabel(e.target.value)}
                    placeholder="Label (optional)"
                    className="w-full bg-white/10 border border-white/20 rounded px-2 py-0.5 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon/50"
                  />
                </div>
              </div>

              {/* Prefab Selection */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Style</p>
                <div className="space-y-0.5">
                  {prefabs.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPrefab(p.id)}
                      className={`w-full text-left rounded border px-2 py-0.5 transition text-[10px] ${
                        prefab === p.id ? 'border-neon bg-neon/10 text-white' : 'border-white/15 text-slate-300 hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 justify-between">
                        <span className="font-medium">{p.name}</span>
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Flag & Height */}
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Settings</p>
                <select
                  value={flag}
                  onChange={(e) => setFlag(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded px-2 py-0.5 text-white focus:outline-none focus:border-neon text-xs"
                >
                  {flags.map((f) => (
                    <option key={f.id} value={f.id} className="bg-slate-900 text-white text-xs">
                      {f.label}
                    </option>
                  ))}
                </select>
                <div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={height}
                    onChange={(e) => setHeight(parseInt(e.target.value, 10))}
                    className="w-full accent-neon"
                  />
                  <span className="text-xs text-slate-400">H: {height}m</span>
                </div>
              </div>

              {/* Info Cards */}
              <div className="space-y-1 pt-1 border-t border-white/10">
                <div className="bg-neon/5 border border-neon/20 rounded p-1.5">
                  <p className="text-[9px] text-slate-400">Nearby Claims</p>
                  <p className="text-[10px] font-semibold text-neon">{claims.length}</p>
                </div>
                <div className="bg-purple/5 border border-purple/20 rounded p-1.5">
                  <p className="text-[9px] text-slate-400">Your Claims</p>
                  <p className="text-[10px] font-semibold text-purple-300">{myClaims.length}</p>
                </div>
                <div className="bg-world/5 border border-white/10 rounded p-1.5">
                  <p className="text-[9px] text-slate-400">Max Height</p>
                  <p className="text-[10px] font-semibold text-slate-200">{currentUser?.verified ? '50m' : '5m'}</p>
                </div>
              </div>

              {/* My Claims Section */}
              {myClaims.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-white/10">
                  <p className="text-[10px] font-semibold uppercase text-slate-300 mb-1">My Claims</p>
                  <div className="space-y-1 max-h-[100px] overflow-y-auto">
                    {myClaims.map((claim) => (
                      <div key={claim.id} className="bg-black/30 border border-white/10 rounded p-1.5 text-[9px] space-y-1">
                        {edittingClaimId === claim.id ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={editingClaimLabel}
                              onChange={(e) => setEditingClaimLabel(e.target.value)}
                              className="w-full bg-white/10 border border-white/20 rounded px-1 py-0.5 text-white text-[9px] focus:outline-none focus:border-neon"
                            />
                            <div className="flex gap-1">
                              <button
                                onClick={handleSaveClaimLabel}
                                className="flex-1 px-1 py-0.5 bg-emerald-500/30 hover:bg-emerald-500/40 border border-emerald-500 rounded text-emerald-200 text-[8px] font-semibold transition"
                              >
                                OK
                              </button>
                              <button
                                onClick={() => setEditingClaimId(null)}
                                className="flex-1 px-1 py-0.5 bg-white/10 hover:bg-white/15 border border-white/20 rounded text-white text-[8px] font-semibold transition"
                              >
                                X
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="font-semibold text-slate-200 truncate">{claim.address_label}</p>
                            <p className="text-slate-400">{claim.lat.toFixed(4)}, {claim.lon.toFixed(4)}</p>
                            <div className="flex gap-1 mt-0.5">
                              <button
                                onClick={() => {
                                  setEditingClaimId(claim.id);
                                  setEditingClaimLabel(claim.address_label);
                                }}
                                className="flex-1 px-1 py-0.5 bg-neon/20 hover:bg-neon/30 border border-neon rounded text-neon text-[8px] font-semibold transition"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteClaim(claim.id)}
                                className="flex-1 px-1 py-0.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500 rounded text-red-200 text-[8px] font-semibold transition"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons - Fixed at bottom */}
            <div className="space-y-1 flex-shrink-0">
              <button
                onClick={handleClaim}
                className="w-full bg-gradient-to-r from-neon/20 to-magenta/20 hover:from-neon/30 hover:to-magenta/30 border border-neon text-white rounded px-2 py-1.5 font-semibold transition text-xs"
              >
                Claim & Build
              </button>
            </div>
          </div>

          {/* Chat & Room - Right Column */}
          <div className="flex flex-col gap-3 overflow-y-auto h-full">
            <RoomPanel roomId={roomId} onRoomChange={setRoomId} />
            <ChatPanel roomId={roomId} token={token} wsBase={wsBase} currentUserId={currentUser?.id} onlineCount={1} />
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}
