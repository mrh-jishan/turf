import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import SiteLayout from '../../components/SiteLayout';
import { fetchUserProfile, verifyUser, me } from '../../lib/api';

interface UserProfile {
  id: string;
  handle: string;
  email: string;
  bio?: string;
  avatar_url?: string;
  verified: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const { userId } = router.query;
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.localStorage.getItem('turf_token');
    if (t) {
      setToken(t);
      me(t)
        .then(setCurrentUser)
        .catch(() => {
          window.localStorage.removeItem('turf_token');
          router.replace('/login');
        });
    }
  }, [router]);

  useEffect(() => {
    if (!userId || typeof userId !== 'string') return;

    setLoading(true);
    fetchUserProfile(userId)
      .then(setUser)
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const handleVerify = async () => {
    if (!user || !token || !currentUser) return;
    if (user.id !== currentUser.id) {
      setError('You can only verify your own profile');
      return;
    }

    setIsVerifying(true);
    try {
      const verified = await verifyUser(user.id, token);
      setUser(verified);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to verify profile');
    } finally {
      setIsVerifying(false);
    }
  };

  const isOwnProfile = currentUser && user && currentUser.id === user.id;

  return (
    <SiteLayout currentUser={currentUser} onLogout={() => { window.localStorage.removeItem('turf_token'); router.replace('/login'); }}>
      <Head>
        <title>{user ? `${user.handle} - Profile` : 'Profile'} | Turf</title>
      </Head>

      <main className="px-4 py-6 sm:px-0 text-white max-w-2xl mx-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-4 h-4 border-2 border-neon/50 border-t-neon rounded-full animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-200">
            {error}
          </div>
        )}

        {user && !loading && (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <button
                onClick={() => router.back()}
                className="text-neon hover:text-neon/80 text-sm mb-4"
              >
                ← Back
              </button>
              <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <div className="flex items-start gap-6">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.handle}
                      className="w-24 h-24 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-neon/10 border border-neon/30 flex items-center justify-center text-3xl font-bold text-neon">
                      {user.handle.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <h1 className="text-3xl font-semibold mb-1">@{user.handle}</h1>
                    <div className="flex items-center gap-2 mb-3">
                      {user.verified ? (
                        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-500/50 text-xs font-medium flex items-center gap-1">
                          ✓ Verified
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-slate-500/20 text-slate-300 border border-slate-500/50 text-xs font-medium">
                          Not Verified
                        </span>
                      )}
                    </div>
                    {user.bio && <p className="text-slate-300">{user.bio}</p>}
                  </div>
                </div>

                {/* Verification Button */}
                {isOwnProfile && !user.verified && (
                  <button
                    onClick={handleVerify}
                    disabled={isVerifying}
                    className="mt-6 w-full px-4 py-2 bg-gradient-to-r from-neon/20 to-magenta/20 hover:from-neon/30 hover:to-magenta/30 disabled:opacity-50 border border-neon rounded-lg text-white font-semibold transition"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify Profile'}
                  </button>
                )}
              </div>
            </div>

            {/* User Info */}
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold">Account Information</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Email</p>
                  <p className="text-slate-200">{user.email}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">User ID</p>
                  <code className="text-xs text-slate-300 bg-black/30 px-3 py-1 rounded">{user.id}</code>
                </div>
              </div>
            </div>

            {/* Edit Button for Own Profile */}
            {isOwnProfile && (
              <div>
                <button
                  onClick={() => router.push('/settings')}
                  className="w-full px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-white font-semibold transition"
                >
                  Edit Profile
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </SiteLayout>
  );
}
