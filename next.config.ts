import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the dev-only route indicator clear of the editor's status bar (bottom-left).
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
