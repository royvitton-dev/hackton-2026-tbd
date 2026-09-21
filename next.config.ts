import type { NextConfig } from 'next';
const config: NextConfig = {
  reactStrictMode: true, devIndicators: false,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  skipTrailingSlashRedirect: Boolean(process.env.NEXT_PUBLIC_BASE_PATH),
  distDir: process.env.NEXT_PUBLIC_BASE_PATH ? '.next-unified' : '.next',
};
export default config;
