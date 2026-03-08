import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@stacks/connect",
    "@stacks/transactions",
    "@stacks/network",
    "@stacks/common",
  ],
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        stream: false,
        fs: false,
        path: false,
        os: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        http: false,
        https: false,
        zlib: false,
        url: false,
        util: false,
        vm: false,
      };
      const webpack = require("webpack");
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
          process: "process/browser",
        })
      );
    }
    return config;
  },
};

export default nextConfig;
