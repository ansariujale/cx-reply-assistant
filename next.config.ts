import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the tracing root to this project so a stray lockfile higher up the
  // filesystem cannot change what gets bundled for serverless functions.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
