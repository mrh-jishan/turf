import Head from 'next/head';
import SiteLayout from '../components/SiteLayout';
import { site } from '../lib/seo';

export default function Privacy() {
  return (
    <SiteLayout>
      <Head>
        <title>Privacy Policy | {site.name}</title>
        <meta name="description" content="How Turf handles your data and location." />
      </Head>
      <div className="max-w-4xl space-y-6 text-slate-200">
        <h1 className="text-3xl font-semibold text-white">Privacy Policy</h1>
        <p className="text-slate-300">Last updated: January 26, 2026</p>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">Data We Collect</h2>
          <ul className="list-disc pl-5 space-y-2 text-slate-300">
            <li>Account info: email, handle, avatar.</li>
            <li>Location: used to verify your home and render fog-of-war. Stored as coordinates with PostGIS.</li>
            <li>Device signals: for anti-spoofing and drive-by detection.</li>
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">How We Use It</h2>
          <ul className="list-disc pl-5 space-y-2 text-slate-300">
            <li>Render your visible map, lighthouses, and supply lines.</li>
            <li>Enable messaging and friend links.</li>
            <li>Prevent abuse and spoofing.</li>
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">Third Parties</h2>
          <p>Stripe Identity (verification), Mapbox (tiles), AWS S3 (assets). We never sell your data.</p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">Your Controls</h2>
          <ul className="list-disc pl-5 space-y-2 text-slate-300">
            <li>Toggle ghost mode to hide from others (reduces visibility for you too).</li>
            <li>Delete your account to purge data.</li>
            <li>Revoke location permissions at any time (map will refog).</li>
          </ul>
        </section>
        <p className="text-slate-400 text-sm">Contact: privacy@turf.app</p>
      </div>
    </SiteLayout>
  );
}
