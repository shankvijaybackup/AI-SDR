import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is required for Render container deployments
  output: 'standalone',

  // Disable production source maps — biggest single build memory saving (~40%)
  productionBrowserSourceMaps: false,

  // Reduce webpack parallelism to stay inside Render free-tier RAM (512MB)
  webpack: (config, { isServer }) => {
    // Cap concurrent workers to prevent OOM on low-RAM build hosts
    config.parallelism = 1;

    if (!isServer) {
      // Don't generate source maps in client chunks
      config.devtool = false;
    }

    return config;
  },
};

export default nextConfig;
