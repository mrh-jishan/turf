import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import SiteLayout from '../components/SiteLayout';
import { me } from '../lib/api';

interface UserSettings {
  id: string;
  handle: string;
  email: string;
  bio?: string;
  avatar_url?: string;
  verified: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSettings | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const t = window.localStorage.getItem('turf_token');
    if (!t) {
      router.replace('/login');
      return;
    }
    setToken(t);

    me(t)
      .then((userData) => {
        setUser(userData);
        setBio(userData.bio || '');
        setAvatarUrl(userData.avatar_url || '');
        setLoading(false);
      })
      .catch(() => {
        window.localStorage.removeItem('turf_token');
        router.replace('/login');
      });
  }, [router]);

  const handleSave = async () => {
    if (!user || !token) return;

    setIsSaving(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'}/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          bio: bio || null,
          avatar_url: avatarUrl || null,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const updated = await res.json();
      setUser(updated);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update profile' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem('turf_token');
    router.replace('/login');
  };

  const handleReset = () => {
    if (user) {
      setBio(user.bio || '');
      setAvatarUrl(user.avatar_url || '');
      setMessage(null);
    }
  };

  return (
    <SiteLayout currentUser={user} onLogout={handleLogout}>
      <Head>
        <title>Settings | Turf</title>
      </Head>

      <main className="px-4 py-6 sm:px-0 text-white max-w-2xl mx-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-4 h-4 border-2 border-neon/50 border-t-neon rounded-full animate-spin" />
          </div>
        )}

        {!loading && user && (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <button
                onClick={() => router.back()}
                className="text-neon hover:text-neon/80 text-sm mb-4"
              >
                ← Back
              </button>
              <h1 className="text-3xl font-semibold">Settings</h1>
              <p className="text-slate-400 text-sm mt-1">Manage your profile and account preferences</p>
            </div>

            {/* Messages */}
            {message && (
              <div
                className={`rounded-lg p-4 ${
                  message.type === 'success'
                    ? 'bg-emerald-900/30 border border-emerald-500/50 text-emerald-200'
                    : 'bg-red-900/30 border border-red-500/50 text-red-200'
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Profile Section */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span>👤</span> Profile Settings
              </h2>

              {/* Handle Display */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 block">
                  Username
                </label>
                <input
                  type="text"
                  value={user.handle}
                  disabled
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none opacity-60 cursor-not-allowed"
                />
                <p className="text-xs text-slate-400 mt-1">Username cannot be changed</p>
              </div>

              {/* Email Display */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 block">
                  Email
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none opacity-60 cursor-not-allowed"
                />
                <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
              </div>

              {/* Bio */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 block">
                  Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={200}
                  rows={4}
                  placeholder="Tell us about yourself..."
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon/50 placeholder-slate-500 resize-none"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {bio.length}/200 characters
                </p>
              </div>

              {/* Avatar URL */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 block">
                  Avatar URL
                </label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon/50 placeholder-slate-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Enter a URL to your profile picture
                </p>
              </div>

              {/* Avatar Preview */}
              {avatarUrl && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Preview
                  </p>
                  <div className="w-24 h-24 rounded-lg overflow-hidden border border-white/20">
                    <img
                      src={avatarUrl}
                      alt="Avatar preview"
                      className="w-full h-full object-cover"
                      onError={() => {
                        setMessage({ type: 'error', text: 'Invalid image URL' });
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Verification Status */}
              <div className="bg-black/30 border border-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold mb-1">Verification Status</p>
                    <p className="text-xs text-slate-400">
                      {user.verified
                        ? 'Your profile is verified'
                        : 'Your profile is not verified'}
                    </p>
                  </div>
                  {user.verified ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-500/50 text-xs font-medium">
                      ✓ Verified
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/50 text-xs font-medium">
                      Not Verified
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-neon/20 to-magenta/20 hover:from-neon/30 hover:to-magenta/30 disabled:opacity-50 border border-neon rounded-lg text-white font-semibold transition"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={handleReset}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-white font-semibold transition"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Account Section */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span>🔐</span> Account
              </h2>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    User ID
                  </p>
                  <code className="text-xs text-slate-300 bg-black/30 px-3 py-1 rounded block break-all">
                    {user.id}
                  </code>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Account Type
                  </p>
                  <p className="text-slate-200 text-sm">Regular User</p>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-red-200 mb-4 flex items-center gap-2">
                <span>⚠️</span> Danger Zone
              </h2>
              <p className="text-red-200/80 text-sm mb-4">
                This action cannot be undone. Make sure you want to do this.
              </p>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500 rounded-lg text-red-200 font-semibold transition"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </main>
    </SiteLayout>
  );
}
