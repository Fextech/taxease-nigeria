import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow importing from shared package and api types
  transpilePackages: ["@banklens/shared"],
};

export default nextConfig;
