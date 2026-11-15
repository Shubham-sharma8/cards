import type { NextConfig } from "next";

const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https:",
  "frame-src 'self' blob: data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  images: {
    unoptimized: true,
  },
  async headers() {
    const immutableCache = [
      { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      { key: "X-Content-Type-Options", value: "nosniff" },
    ];
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Content-Security-Policy", value: CSP_HEADER },
        ],
      },
      { source: "/card-images/(.*)", headers: immutableCache },
      { source: "/lounge-photos/(.*)", headers: immutableCache },
      { source: "/golf-photos/(.*)", headers: immutableCache },
      { source: "/category-posters/(.*)", headers: immutableCache },
      { source: "/logos/(.*)", headers: immutableCache },
      { source: "/illustrations/(.*)", headers: immutableCache },
      { source: "/icons/(.*)", headers: immutableCache },
      { source: "/open-media/(.*)", headers: immutableCache },
      {
        source: "/api/(.*)",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/og",
        headers: [
          { key: "X-Robots-Tag", value: "noindex" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
