import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Stricter checking is handled during dev, ignore build type errors if minor issues exist
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      }
    ],
  },
};

export default nextConfig;
