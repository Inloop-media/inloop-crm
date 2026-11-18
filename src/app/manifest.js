/** Lets the CRM install as an app ("Add to Home Screen") — needed for push notifications on iPhone. */
export default function manifest() {
  return {
    name: "Kyro",
    short_name: "Kyro",
    description: "Kyro: the Inloop Media workspace",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
