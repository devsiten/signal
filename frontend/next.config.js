/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: '**.r2.dev',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: 'https://hussayn-signal-api.devsiten.workers.dev',
    NEXT_PUBLIC_SOLANA_RPC: 'https://mainnet.helius-rpc.com/?api-key=e495db18-fb79-4c7b-9750-5bf08d316aaf',
    NEXT_PUBLIC_TREASURY_WALLET: '8eQUQeiqaroRzjLZoZtqnz8371X87WUTNdv5JRKbmLe2',
  },
  // Fix for wallet adapter packages that use Node.js modules
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        events: false,
        buffer: false,
        process: false,
      };
    }
    // Ignore optional peer dependencies warnings
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  // Transpile wallet adapter packages
  transpilePackages: [
    '@solana/wallet-adapter-base',
    '@solana/wallet-adapter-react',
    '@solana/wallet-adapter-react-ui',
    '@solana/wallet-adapter-wallets',
  ],
};

module.exports = nextConfig;

