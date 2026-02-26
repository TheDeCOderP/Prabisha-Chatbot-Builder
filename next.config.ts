import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        source: "/embed/widget/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "microphone=*",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
        pathname: "/**",
      },
    ]
  },
  reactCompiler: true,
};

export default nextConfig;
