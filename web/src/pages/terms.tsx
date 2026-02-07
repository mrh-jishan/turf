import Head from 'next/head';
import SiteLayout from '../components/SiteLayout';
import { site } from '../lib/seo';

export default function Terms() {
  return (
    <SiteLayout>
      <Head>
        <title>Terms & Conditions | {site.name}</title>
        <meta name="description" content="Usage terms for Turf." />
      </Head>
      <div className="max-w-4xl space-y-6 text-slate-200">
        <h1 className="text-3xl font-semibold text-white">Terms & Conditions</h1>
        <p className="text-slate-300">Last updated: January 26, 2026</p>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">Acceptable Use</h2>
          <ul className="list-disc pl-5 space-y-2 text-slate-300">
            <li>No harassment, stalking, or doxxing. Respect neighbors.</li>
            <li>No spoofing GPS or falsifying verification.</li>
            <li>No illegal content in builds, graffiti, or messages.</li>
          </ul>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">Verification & Payments</h2>
          <p>Verified status uses Stripe Identity; fees are non-refundable once verification is attempted.</p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">Liability</h2>
          <p>Turf is provided “as is.” Use location features responsibly and obey local laws.</p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">Termination</h2>
          <p>We may suspend accounts for abuse, fraud, or policy violations.</p>
        </section>
        <p className="text-slate-400 text-sm">Contact: legal@turf.app</p>
      </div>
    </SiteLayout>
  );
}
