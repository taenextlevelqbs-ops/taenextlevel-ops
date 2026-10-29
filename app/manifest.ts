import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Tae Next Level Command Center",
    short_name: "Command",
    description: "Your private business operations dashboard",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#17191c",
    theme_color: "#17191c",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
