/** Lets the CRM install as an app ("Add to Home Screen") — needed for push notifications on iPhone. */
export default function manifest() {
  return {
    name: "Inloop CRM",
    short_name: "Inloop CRM",
    description: "Lead management for Inloop Media",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ecebf6",
    theme_color: "#ecebf6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
