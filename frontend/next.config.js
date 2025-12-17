/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: 'https://hussayn-signal-api.devsiten.workers.dev',
    NEXT_PUBLIC_SOLANA_RPC: 'https://api.mainnet-beta.solana.com',
  },
};

module.exports = nextConfig;
