import type { NextConfig } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL;
let appHost: string | null = null;
if (appUrl) {
  try {
    appHost = new URL(appUrl).host;
  } catch {}
}

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '127.0.0.1:3000',
        'rtmshu.netlify.app',
        '*.netlify.app',
        '*.vercel.app',
        ...(appHost ? [appHost] : []),
      ],
    },
  },
};

export default nextConfig;
