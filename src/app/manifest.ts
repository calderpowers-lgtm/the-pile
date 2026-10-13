import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const base = process.env.BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Pile",
    short_name: "The Pile",
    description: "Gratitude practice. Write your sheet, draw one person from the world, and see if you take yours back.",
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    background_color: "#F9F6F0",
    theme_color: "#5C4033",
    lang: "en",
    categories: ["lifestyle"],
    icons: [
      {
        src: `${base}/icons/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${base}/icons/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${base}/icons/icon-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
