import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is required for Render container deployments
  output: 'standalone',

  // Disable production source maps — biggest single build memory saving (~40%)
  productionBrowserSourceMaps: false,

  // Webpack memory optimizations for low-RAM build hosts (Render free: 512MB)
  webpack: (config, { isServer }) => {
    // Disable parallel minification workers — prevents peak OOM during terser step
    if (config.optimization?.minimizer) {
      config.optimization.minimizer.forEach((plugin: any) => {
        if (plugin?.options && 'parallel' in plugin.options) {
          plugin.options.parallel = false;
        }
      });
    }
    return config;
  },
};

export default nextConfig;
