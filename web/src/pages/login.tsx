import Head from 'next/head';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/router';
import SiteLayout from '../components/SiteLayout';
import { login, register } from '../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      if (mode === 'register') {
        await register(handle, email, password);
        setMessage('Registered! Now log in.');
        setMode('login');
        return;
      }
      const res = await login(email || handle, password);
      window.localStorage.setItem('turf_token', res.access_token);
      router.push('/app');
    } catch (err) {
      setMessage('Auth failed.');
    }
  }

  return (
    <SiteLayout>
      <Head>
        <title>{mode === 'login' ? 'Login' : 'Register'} | Turf</title>
        <meta name="description" content="Login or register for Turf." />
      </Head>
      <div className="max-w-md mx-auto bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 rounded-lg border px-3 py-2 ${mode === 'login' ? 'border-neon text-white' : 'border-white/20 text-slate-300'}`}
          >
            Login
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 rounded-lg border px-3 py-2 ${mode === 'register' ? 'border-neon text-white' : 'border-white/20 text-slate-300'}`}
          >
            Register
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3 text-sm">
          {mode === 'register' && (
            <label className="flex flex-col gap-1">
              <span className="text-slate-400">Handle</span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
                required
              />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-slate-400">Email or handle</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-slate-400">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
              required
            />
          </label>
          <button type="submit" className="w-full bg-neon/20 border border-neon rounded-lg py-2 font-semibold">
            {mode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>
        {message && <p className="text-xs text-slate-300">{message}</p>}
      </div>
    </SiteLayout>
  );
}
