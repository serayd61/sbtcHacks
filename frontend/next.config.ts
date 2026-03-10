import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@stacks/connect",
    "@stacks/transactions",
    "@stacks/network",
    "@stacks/common",
  ],
  turbopack: {},
  // M-8 FIX: Security headers — prevent clickjacking, XSS, MIME sniffing
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://api.mainnet.hiro.so https://api.testnet.hiro.so https://api.coingecko.com https://api.binance.com https://api.kraken.com https://*.stacks.co wss://*.stacks.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
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
