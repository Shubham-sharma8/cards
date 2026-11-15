import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cards by cogify",
    short_name: "Cards",
    description:
      "Math-first Indian credit card reward calculator, airport lounge checker, golf directory, and L1/L2/PNO helplines — a product of cogify.me.",
    start_url: "/",
    id: "/",
    display: "standalone",
    background_color: "#FAF9F6",
    theme_color: "#0F5C4D",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
