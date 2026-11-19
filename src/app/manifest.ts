import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Saúde Almenara Digital",
    short_name: "Saúde Almenara",
    description:
      "Portal SUS da Secretaria Municipal de Saúde de Almenara/MG — Agendamento, Farmácia REMUME e Gestão Pública.",
    start_url: "/",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#0F4C81",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
