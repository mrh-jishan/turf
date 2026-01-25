import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import Map, { ClaimFeature } from '../components/Map';
import { createBuild, createClaim, fetchNearby } from '../lib/api';
import { flags, prefabs } from '../lib/prefabs';

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

  return (
    <>
      <Head>
        <title>Turf | Claim Your Block</title>
      </Head>
      <main className="min-h-screen px-4 py-6 sm:px-8 bg-transparent text-white">
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
          <Map center={center} claims={claims} />

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 shadow-glow flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Build Panel</h2>
              <span className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/15">Live 3D</span>
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
          </div>
        </section>
      </main>
    </>
  );
}
