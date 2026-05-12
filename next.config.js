/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@github/copilot-sdk', '@github/copilot'],
  },
};

module.exports = nextConfig;
