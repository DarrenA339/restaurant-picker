import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chews",
    short_name: "Chews",
    description: "Chews together. Pick a place with friends and skip the group chat debate.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF6EE",
    theme_color: "#D2432A",
    // Full-bleed tiles with the c inside the maskable safe zone (docs/brand/README.md).
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
