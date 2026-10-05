import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // Los wrappers WASM de Cornerstone (@cornerstonejs/codec-*) hacen
      // require('fs')/require('path') en una rama solo-Node que Turbopack
      // igual intenta resolver para el bundle del navegador.
      fs: { browser: "./lib/node-polyfills/empty.js" },
      path: { browser: "./lib/node-polyfills/empty.js" },
    },
  },
};

export default nextConfig;
