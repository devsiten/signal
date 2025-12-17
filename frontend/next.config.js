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
    NEXT_PUBLIC_SOLANA_RPC: 'https://mainnet.helius-rpc.com/?api-key=e495db18-fb79-4c7b-9750-5bf08d316aaf',
    NEXT_PUBLIC_TREASURY_WALLET: '8eQUQeiqaroRzjLZoZtqnz8371X87WUTNdv5JRKbmLe2',
  },
};

module.exports = nextConfig;
