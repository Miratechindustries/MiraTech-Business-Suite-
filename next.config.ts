import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_TELEMETRY_DISABLED: '1',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Allow access to remote image placeholder and auth providers
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
    ],
  },
  distDir: '.next',
  experimental: {
    optimizePackageImports: ['lucide-react', 'motion/react', 'framer-motion'],
  },
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
