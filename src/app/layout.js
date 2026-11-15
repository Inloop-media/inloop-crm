import { Outfit } from "next/font/google";
import { getTheme, THEME_COLOR } from "@/lib/theme";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });

export const metadata = {
  title: { default: "Inloop CRM", template: "%s · Inloop CRM" },
  description: "Lead management for Inloop Media",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Inloop CRM", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export async function generateViewport() {
  return { themeColor: THEME_COLOR[await getTheme()], viewportFit: "cover" };
}

export default async function RootLayout({ children }) {
  const theme = await getTheme();
  return (
    <html lang="en" data-theme={theme} className={`${outfit.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
