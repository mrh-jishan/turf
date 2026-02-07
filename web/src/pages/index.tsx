import Head from 'next/head';
import Link from 'next/link';
import SiteLayout from '../components/SiteLayout';
import { site } from '../lib/seo';

export default function Home() {
  return (
    <SiteLayout>
      <Head>
        <title>Turf | Social Fog of War</title>
        <meta name="description" content={site.description} />
      </Head>

      <section className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] items-center py-10">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">USA Beta</p>
          <h1 className="text-4xl sm:text-5xl font-semibold leading-tight">
            Claim the real world.
            <span className="block text-neon">Light up the fog.</span>
          </h1>
          <p className="text-slate-300 text-lg">
            Turf turns your verified home into a lighthouse. Build voxel monuments, link friends, and reveal the city by
            hanging out IRL.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="px-5 py-3 rounded-xl border border-neon text-neon hover:bg-neon/10 transition"
            >
              Get started
            </Link>
            <a href="#how" className="px-5 py-3 rounded-xl border border-white/20 text-white">
              See how it works
            </a>
          </div>
          <div className="flex gap-4 text-xs text-slate-400">
            <span>Verified home base</span>
            <span>Fog-of-war map</span>
            <span>3D voxel builds</span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 rounded-3xl blur-3xl bg-gradient-to-br from-neon/30 via-magenta/20 to-amber/20" />
          <div className="relative bg-black/50 border border-white/10 rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-semibold">Live status layer</h3>
            <p className="text-sm text-slate-300">
              Your map starts dark. The only way to unlock nearby cities is by connecting with friends who live there.
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <p className="text-neon">Lighthouse</p>
                <p className="text-slate-400">1-mile glow from verified home.</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <p className="text-magenta">Supply line</p>
                <p className="text-slate-400">Visit friends to keep paths alive.</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <p className="text-amber">Ghost mode</p>
                <p className="text-slate-400">Invisible in fog, but can’t see others.</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <p className="text-neon">Voxel flex</p>
                <p className="text-slate-400">Build neon towers over your turf.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="py-10 grid gap-6">
        <h2 className="text-2xl font-semibold">How it works</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
            <p className="text-neon font-semibold">1. Verify</p>
            <p className="text-slate-300">Prove where you live and unlock your 20m x 20m build zone.</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
            <p className="text-magenta font-semibold">2. Build</p>
            <p className="text-slate-300">Choose a prefab, raise your tower, and decorate with flags.</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
            <p className="text-amber font-semibold">3. Link</p>
            <p className="text-slate-300">Visit friends to draw supply lines and keep the fog away.</p>
          </div>
        </div>
      </section>

      <section className="py-10 grid gap-6">
        <h2 className="text-2xl font-semibold">Why people stay</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold">Social scarcity</h3>
            <p className="text-slate-300">Only one verified owner per address. Your turf is your identity.</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
            <h3 className="font-semibold">IRL rewards</h3>
            <p className="text-slate-300">Hang out to keep your map glowing. Your social graph is your map.</p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
