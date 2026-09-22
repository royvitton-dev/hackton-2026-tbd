import type { NextConfig } from 'next';
const sitesExport = process.env.SITES_EXPORT === '1';
const githubPagesExport = process.env.GITHUB_PAGES === '1';
const staticExport = sitesExport || githubPagesExport;
const config: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  poweredByHeader: false,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  skipTrailingSlashRedirect: Boolean(process.env.NEXT_PUBLIC_BASE_PATH),
  distDir: sitesExport ? '.next-sites' : githubPagesExport ? 'out' : process.env.NEXT_PUBLIC_BASE_PATH ? '.next-unified' : '.next',
  ...(staticExport ? { output: 'export', trailingSlash: true, images: { unoptimized: true } } as const : {
    async headers() {
    return [{
      source: '/assets/vehicles/:path*',
      headers: [{
        key: 'Cache-Control',
        value: 'public, max-age=86400, stale-while-revalidate=604800',
      }],
    }];
    },
  }),
};
export default config;
