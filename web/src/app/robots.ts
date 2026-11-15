import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/og", "/llms.txt"],
        disallow: ["/api/", "/my-cards"],
      },
      {
        userAgent: ["WhatsApp", "facebookexternalhit", "Twitterbot", "LinkedInBot", "Slackbot"],
        allow: ["/", "/og"],
      },
      {
        userAgent: [
          "OAI-SearchBot",
          "GPTBot",
          "PerplexityBot",
          "ClaudeBot",
          "Google-Extended",
          "Applebot-Extended",
        ],
        allow: ["/", "/llms.txt"],
        disallow: ["/api/", "/my-cards"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
