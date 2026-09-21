import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mesa Pronta",
    short_name: "Mesa Pronta",
    description: "Pedidos e operação de food service.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6f2",
    theme_color: "#202723",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
