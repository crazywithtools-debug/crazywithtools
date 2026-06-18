/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  // For webpack builds, set outputFileTracingRoot to the project root to avoid cross-root tracing
  outputFileTracingRoot: path.resolve(__dirname),
  // Ensure Turbopack resolves the workspace root correctly when Next infers the project
  // (fixes errors when Next infers the `app` folder as the workspace root)
  turbopack: {
    root: path.resolve(__dirname),
  },
};

module.exports = nextConfig;
