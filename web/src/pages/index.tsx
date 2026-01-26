import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import Map, { ClaimFeature } from '../components/Map';
import ChatPanel from '../components/ChatPanel';
import { createBuild, createClaim, fetchNearby, fetchFog, fetchVisibility, login, me, register } from '../lib/api';
import { flags, prefabs } from '../lib/prefabs';
import SiteLayout from '../components/SiteLayout';

const usaCenter: [number, number] = [-98.5795, 39.8283];
const usaBounds = {
  west: -125,
  east: -66,
  south: 24,
  north: 50,
};

export default function Home() {
  const [lat, setLat] = useState(usaCenter[1]);
  const [lon, setLon] = useState(usaCenter[0]);
  const [claims, setClaims] = useState<ClaimFeature[]>([
    {
      id: 'demo-1',
      lat: 34.0522,
      lon: -118.2437,
      address_label: 'LA Neon Loft',
      prefab: 'cyber',
      flag: 'usa',
      height_m: 35,
    },
    {
      id: 'demo-2',
      lat: 40.7128,
      lon: -74.006,
      address_label: 'NYC Skytower',
      prefab: 'castle',
      flag: 'school',
      height_m: 45,
    },
  ]);
  const [prefab, setPrefab] = useState(prefabs[0].id);
  const [flag, setFlag] = useState(flags[0].id);
  const [height, setHeight] = useState(20);
  const [owner, setOwner] = useState('demo-user');
  const [address, setAddress] = useState('123 Demo St');
  const center = useMemo(() => [lon, lat] as [number, number], [lat, lon]);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [authHandle, setAuthHandle] = useState('demo');
  const [authEmail, setAuthEmail] = useState('demo@example.com');
  const [authPassword, setAuthPassword] = useState('password123');
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [roomId, setRoomId] = useState<string>('demo-room');
  const wsBase = process.env.NEXT_PUBLIC_WS_BASE || 'ws://localhost:8000';
  const [fogGeojson, setFogGeojson] = useState<any>(null);
  const [visibleGeojson, setVisibleGeojson] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    fetchNearby(lat, lon, 2000)
      .then((res) => {
        if (cancelled) return;
        const mapped = res.map((c: any) => ({ ...c, prefab: 'cyber', flag: 'usa', height_m: 12 }));
        setClaims((prev) => [...prev.filter((p) => p.id.startsWith('demo-')), ...mapped]);
      })
      .catch(() => {
        /* keep demo data offline */
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  useEffect(() => {
    if (!token) return;
    me(token)
      .then(setCurrentUser)
      .catch(() => setToken(null));
  }, [token]);

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

  const clampUSA = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  async function handleClaim() {
    const safeLat = clampUSA(lat, usaBounds.south, usaBounds.north);
    const safeLon = clampUSA(lon, usaBounds.west, usaBounds.east);
    try {
      const claim = await createClaim({ owner_id: owner, lat: safeLat, lon: safeLon, address_label: address });
      const build = await createBuild({
        claim_id: claim.id,
        prefab,
        flag,
        height_m: height,
      });
      setClaims((prev) => [
        ...prev,
        { ...claim, prefab: build.prefab, flag: build.flag, height_m: build.height_m },
      ]);
    } catch (err) {
      console.error(err);
      alert('Failed to claim/build. Check API is running.');
    }
  }

  async function handleAuth() {
    try {
      if (authMode === 'register') {
        await register(authHandle, authEmail, authPassword);
      }
      const t = await login(authEmail, authPassword);
      setToken(t.access_token);
    } catch (err) {
      alert('Auth failed. Check API.');
    }
  }

  return (
    <SiteLayout>
      <Head>
        <title>Turf | Claim Your Block</title>
      </Head>
      <main className="px-4 py-6 sm:px-0 bg-transparent text-white">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">USA Only Beta</p>
            <h1 className="text-3xl sm:text-4xl font-semibold">Claim your turf.</h1>
            <p className="text-slate-300 max-w-2xl mt-2">
              Verified home base + voxel flexing. Build only where you live. See activity within 2 miles.
            </p>
          </div>
          <div className="flex gap-2 text-sm text-slate-200">
            <span className="px-3 py-1 rounded-full bg-magenta/20 border border-magenta/40">Verified = 50m height</span>
            <span className="px-3 py-1 rounded-full bg-amber/15 border border-amber/30">USA geofence</span>
          </div>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.65fr_1fr]">
          <Map center={center} claims={claims} fogGeojson={fogGeojson} visibleGeojson={visibleGeojson} />

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 shadow-glow flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Build Panel</h2>
              <span className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/15">Live 3D</span>
            </div>

            <div className="flex gap-2 text-sm">
              <button
                onClick={() => setAuthMode('register')}
                className={`px-3 py-2 rounded-lg border ${authMode === 'register' ? 'border-neon' : 'border-white/20'}`}
              >
                Register
              </button>
              <button
                onClick={() => setAuthMode('login')}
                className={`px-3 py-2 rounded-lg border ${authMode === 'login' ? 'border-neon' : 'border-white/20'}`}
              >
                Login
              </button>
              <button onClick={handleAuth} className="flex-1 bg-neon/20 border border-neon rounded-lg">
                {token ? 'Refresh session' : 'Submit'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="flex flex-col gap-1 col-span-1">
                <span className="text-slate-400">Handle</span>
                <input
                  value={authHandle}
                  onChange={(e) => setAuthHandle(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                />
              </label>
              <label className="flex flex-col gap-1 col-span-1">
                <span className="text-slate-400">Email</span>
                <input
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                />
              </label>
              <label className="flex flex-col gap-1 col-span-2">
                <span className="text-slate-400">Password</span>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                />
              </label>
              {currentUser && (
                <p className="col-span-2 text-xs text-neon">Logged in as {currentUser.handle}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-slate-400">Latitude (USA)</span>
                <input
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                  type="number"
                  step="0.0001"
                  min={usaBounds.south}
                  max={usaBounds.north}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-slate-400">Longitude (USA)</span>
                <input
                  value={lon}
                  onChange={(e) => setLon(parseFloat(e.target.value) || 0)}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                  type="number"
                  step="0.0001"
                  min={usaBounds.west}
                  max={usaBounds.east}
                />
              </label>
              <label className="flex flex-col gap-1 col-span-2">
                <span className="text-slate-400">Address label</span>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                  placeholder="123 Maple Street"
                />
              </label>
              <label className="flex flex-col gap-1 col-span-2">
                <span className="text-slate-400">Prefab</span>
                <div className="flex gap-2">
                  {prefabs.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPrefab(p.id)}
                      className={`flex-1 rounded-xl border px-3 py-2 transition ${
                        prefab === p.id ? 'border-neon bg-neon/10 text-white' : 'border-white/15 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{p.name}</span>
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: p.color, boxShadow: '0 0 10px rgba(90,245,255,0.4)' }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400">max {p.maxHeight}m</p>
                    </button>
                  ))}
                </div>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-slate-400">Flag</span>
                <select
                  value={flag}
                  onChange={(e) => setFlag(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                >
                  {flags.map((f) => (
                    <option key={f.id} value={f.id} className="bg-slate-900 text-white">
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-slate-400">Height (m)</span>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={height}
                  onChange={(e) => setHeight(parseInt(e.target.value, 10))}
                  className="accent-neon"
                />
                <span className="text-xs text-slate-400">Current: {height}m (verified unlocks 50m)</span>
              </label>
              <label className="flex flex-col gap-1 col-span-2">
                <span className="text-slate-400">Owner ID</span>
                <input
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                  placeholder="uuid or demo-user"
                />
              </label>
            </div>

            <button
              onClick={handleClaim}
              className="mt-2 bg-neon/20 border border-neon text-white rounded-xl px-4 py-3 font-semibold hover:bg-neon/30 transition"
            >
              Claim & Build
            </button>
            <p className="text-xs text-slate-400">
              This hits the API if available; otherwise uses the demo data. USA-only bounds enforced on the client.
            </p>

            <div className="grid md:grid-cols-2 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Room</h3>
                  <button
                    onClick={() => setRoomId(prompt('Room ID', roomId) || roomId)}
                    className="text-xs px-2 py-1 border border-white/20 rounded-lg"
                  >
                    Change
                  </button>
                </div>
                <p className="text-slate-400 text-xs">Uses secured WS: only members connected.</p>
                <p className="text-slate-400 text-xs">Current: {roomId}</p>
              </div>
              <ChatPanel roomId={roomId} token={token} wsBase={wsBase} />
            </div>
          </div>
        </section>
      </main>
    </SiteLayout>
  );
}
