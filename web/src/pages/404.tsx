import SiteLayout from '../components/SiteLayout';

export default function NotFound() {
  return (
    <SiteLayout>
      <div className="text-center py-20 space-y-3">
        <h1 className="text-4xl font-semibold">404</h1>
        <p className="text-slate-300">This page is fogged out. Head back to your turf.</p>
        <a href="/" className="text-neon underline">Go home</a>
      </div>
    </SiteLayout>
  );
}
