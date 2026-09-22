import type { NextConfig } from 'next';
const sitesExport = process.env.SITES_EXPORT === '1';
const config: NextConfig = {
  reactStrictMode: true, devIndicators: false,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  skipTrailingSlashRedirect: Boolean(process.env.NEXT_PUBLIC_BASE_PATH),
  distDir: sitesExport ? '.next-sites' : process.env.NEXT_PUBLIC_BASE_PATH ? '.next-unified' : '.next',
  ...(sitesExport ? { output: 'export', trailingSlash: true, images: { unoptimized: true } } as const : {}),
};
export default config;
