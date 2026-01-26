import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';
import { defaultOg, site } from '../lib/seo';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>{site.name}</title>
        <meta name="description" content={site.description} />
        <link rel="canonical" href={site.url} />
        {Object.entries(defaultOg).map(([key, value]) => (
          <meta key={key} property={key} content={value} />
        ))}
      </Head>
      <Component {...pageProps} />
    </>
  );
}
