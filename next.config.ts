import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "glaucobarber.com"],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.trinks.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "barbeariaartshave.com.br",
      },
    ],
  },
};

export default nextConfig;
