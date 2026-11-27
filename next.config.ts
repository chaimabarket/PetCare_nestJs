import type { NextConfig } from "next";

/**
 * Adresse publique des liens de partage (QR code), ex. http://192.168.1.20:3000 pour ouvrir un lien depuis un
 * téléphone sur le même Wi-Fi pendant le développement. En développement, Next.js n'accepte que localhost :
 * cette adresse est donc aussi autorisée (allowedDevOrigins attend le nom d'hôte seul, sans schéma ni port).
 */
const shareOrigin = process.env.NEXT_PUBLIC_SHARE_ORIGIN;
const shareHost = (() => {
  try {
    return shareOrigin ? new URL(shareOrigin).hostname : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  allowedDevOrigins: shareHost ? [shareHost] : [],
  partialPrefetching: true,
  // Carnet partagé (/partage/{jeton}) : jamais indexé, et le jeton de l'adresse n'est pas transmis aux sites
  // ouverts depuis la page (en-tête Referer). Les données elles-mêmes viennent de /api/partage (no-store).
  async headers() {
    return [
      {
        source: "/partage/:token",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
