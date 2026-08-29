import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hides the on-screen "N" dev-tools indicator badge — it's a Next.js
  // framework overlay (dev-only, never shows in production), not part of
  // this app's own UI.
  devIndicators: false,
};

export default nextConfig;
