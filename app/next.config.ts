import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable production source maps — faster builds, smaller bundles
  productionBrowserSourceMaps: false,

  // Webpack memory optimizations (still useful even on Standard plan)
  webpack: (config, { isServer }) => {
    // Disable parallel minification workers — reduces peak RAM during terser step
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
