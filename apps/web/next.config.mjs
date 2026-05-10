/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@ops/shared"],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
