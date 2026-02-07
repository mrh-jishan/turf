import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import SiteLayout from '../components/SiteLayout';
import { fetchMyClaims, updateBuild, me } from '../lib/api';
import { prefabs, flags } from '../lib/prefabs';

interface Build {
  id: string;
  claim_id: string;
  prefab: string;
  flag?: string;
  decal?: string;
  height_m: number;
  created_at: string;
}

interface Claim {
  id: string;
  owner_id: string;
  address_label: string;
  lat: number;
  lon: number;
  created_at: string;
  builds: Build[];
}

export default function ClaimsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingBuildId, setEditingBuildId] = useState<string | null>(null);
  const [editingBuild, setEditingBuild] = useState<any>(null);

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
    loadClaims();
  }, [token]);

  const loadClaims = async () => {
    setLoading(true);
    try {
      const data = await fetchMyClaims(token!);
      setClaims(data);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load claims' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditBuild = (build: Build) => {
    setEditingBuildId(build.id);
    setEditingBuild({ ...build });
  };

  const handleCancelEdit = () => {
    setEditingBuildId(null);
    setEditingBuild(null);
  };

  const handleSaveBuild = async () => {
    if (!token || !editingBuild) return;

    try {
      const updated = await updateBuild(editingBuild.id, {
        prefab: editingBuild.prefab,
        flag: editingBuild.flag,
        decal: editingBuild.decal,
        height_m: editingBuild.height_m,
      }, token);

      // Update local state
      setClaims(prev =>
        prev.map(claim =>
          claim.id === editingBuild.claim_id
            ? {
                ...claim,
                builds: claim.builds.map(b =>
                  b.id === editingBuild.id ? { ...b, ...updated } : b
                ),
              }
            : claim
        )
      );

      setMessage({ type: 'success', text: 'Build updated successfully!' });
      setEditingBuildId(null);
      setEditingBuild(null);
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update build' });
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem('turf_token');
    router.replace('/login');
  };

  const getPrefabName = (id: string) => prefabs.find(p => p.id === id)?.name || id;
  const getFlagName = (id?: string) => flags.find(f => f.id === id)?.label || id || 'None';

  return (
    <SiteLayout currentUser={currentUser} onLogout={handleLogout}>
      <Head>
        <title>My Claims | Turf</title>
      </Head>

      <main className="px-4 py-6 sm:px-0 text-white max-w-4xl mx-auto">
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

        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-neon hover:text-neon/80 text-sm mb-4"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-semibold mb-2">My Claims</h1>
          <p className="text-slate-400">View and manage your claims and builds</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-4 h-4 border-2 border-neon/50 border-t-neon rounded-full animate-spin" />
          </div>
        )}

        {!loading && claims.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <p className="text-slate-400 mb-4">You haven't made any claims yet</p>
            <button
              onClick={() => router.push('/app')}
              className="px-4 py-2 bg-neon/20 hover:bg-neon/30 border border-neon rounded-lg text-neon font-semibold transition"
            >
              Go to Map to Make a Claim
            </button>
          </div>
        )}

        {!loading && claims.length > 0 && (
          <div className="space-y-4">
            {claims.map((claim) => (
              <div key={claim.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                {/* Claim Header */}
                <div>
                  <h2 className="text-xl font-semibold mb-2">{claim.address_label}</h2>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                    <span>📍 {claim.lat.toFixed(4)}, {claim.lon.toFixed(4)}</span>
                    <span>📅 {new Date(claim.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Builds */}
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <p className="text-sm font-semibold text-slate-300">Build Configuration</p>
                  
                  {claim.builds.length === 0 ? (
                    <p className="text-xs text-slate-500">No build created yet for this claim</p>
                  ) : (
                    claim.builds.map((build) => (
                      <div
                        key={build.id}
                        className="bg-black/20 border border-white/10 rounded-lg p-4 space-y-3"
                      >
                        {editingBuildId === build.id ? (
                          // Edit Mode
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-semibold uppercase text-slate-400 mb-1 block">
                                Style
                              </label>
                              <select
                                value={editingBuild.prefab}
                                onChange={(e) =>
                                  setEditingBuild({ ...editingBuild, prefab: e.target.value })
                                }
                                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-neon"
                              >
                                {prefabs.map((p) => (
                                  <option key={p.id} value={p.id} className="bg-slate-900">
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-xs font-semibold uppercase text-slate-400 mb-1 block">
                                Flag
                              </label>
                              <select
                                value={editingBuild.flag || ''}
                                onChange={(e) =>
                                  setEditingBuild({ ...editingBuild, flag: e.target.value || undefined })
                                }
                                className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-neon"
                              >
                                <option value="" className="bg-slate-900">
                                  None
                                </option>
                                {flags.map((f) => (
                                  <option key={f.id} value={f.id} className="bg-slate-900">
                                    {f.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-xs font-semibold uppercase text-slate-400 mb-1 block">
                                Height
                              </label>
                              <div className="space-y-1">
                                <input
                                  type="range"
                                  min="5"
                                  max="50"
                                  value={editingBuild.height_m}
                                  onChange={(e) =>
                                    setEditingBuild({ ...editingBuild, height_m: parseInt(e.target.value, 10) })
                                  }
                                  className="w-full accent-neon"
                                />
                                <p className="text-xs text-slate-400">{editingBuild.height_m}m</p>
                              </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={handleSaveBuild}
                                className="flex-1 px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500 rounded text-emerald-200 font-semibold text-xs transition"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="flex-1 px-3 py-1 bg-white/10 hover:bg-white/15 border border-white/20 rounded text-white font-semibold text-xs transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          // View Mode
                          <div>
                            <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                              <div>
                                <p className="text-slate-400">Style</p>
                                <p className="font-semibold text-slate-200">{getPrefabName(build.prefab)}</p>
                              </div>
                              <div>
                                <p className="text-slate-400">Flag</p>
                                <p className="font-semibold text-slate-200">{getFlagName(build.flag)}</p>
                              </div>
                              <div>
                                <p className="text-slate-400">Height</p>
                                <p className="font-semibold text-slate-200">{build.height_m}m</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleEditBuild(build)}
                              className="w-full px-3 py-1 bg-neon/10 hover:bg-neon/20 border border-neon rounded text-neon font-semibold text-xs transition"
                            >
                              Edit Build
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </SiteLayout>
  );
}
