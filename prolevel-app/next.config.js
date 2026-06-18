/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  // For webpack builds, set outputFileTracingRoot to the project root to avoid cross-root tracing
  outputFileTracingRoot: path.resolve(__dirname),
};

module.exports = nextConfig;
