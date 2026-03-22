import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow importing from shared package and api types
  transpilePackages: ["@banklens/shared"],
  async rewrites() {
    return [
      {
        source: "/api/trpc/:path*",
        destination: `${process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/trpc/:path*`,
      },
    ];
  },
};

export default nextConfig;
