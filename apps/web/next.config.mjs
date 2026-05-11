/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@ops/shared"],
  experimental: {
    typedRoutes: false,
    // Tree-shake heavy icon / utility libs in dev too. Without this the dev
    // bundle ships the whole lucide-react package (~1k icons), which is a
    // major contributor to first-paint lag.
    optimizePackageImports: ["lucide-react", "date-fns", "@radix-ui/react-dialog", "@radix-ui/react-popover"],
  },
};

export default nextConfig;
