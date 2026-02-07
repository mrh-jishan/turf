import Head from 'next/head';
import SiteLayout from '../components/SiteLayout';
import { site } from '../lib/seo';

export default function About() {
  return (
    <SiteLayout>
      <Head>
        <title>About | {site.name}</title>
        <meta name="description" content="The story and mission behind Turf." />
      </Head>
      <div className="max-w-4xl space-y-6">
        <h1 className="text-3xl font-semibold">About Turf</h1>
        <p className="text-slate-300 text-lg">
          Turf is a social status layer on the real world. Verify where you live, build towering voxel art, and link friends to clear the fog of war around your city.
        </p>
        <div className="space-y-3 text-slate-300">
          <p>
            We believe digital identity should be grounded in reality. Your home is your beacon—your lighthouse—that lights up the map for you and your crew. The more you connect IRL, the brighter your world becomes.
          </p>
          <p>
            Our team is building for explorers, neighbors, and builders who want playful, meaningful presence—not passive tracking or hollow coins.
          </p>
          <p className="font-semibold text-white">Powered by: Next.js, Mapbox GL, Three.js, FastAPI, PostGIS.</p>
        </div>
      </div>
    </SiteLayout>
  );
}
