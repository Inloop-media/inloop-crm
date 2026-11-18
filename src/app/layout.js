import { Geist } from "next/font/google";
import { getTheme, THEME_COLOR } from "@/lib/theme";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata = {
  title: { default: "Kyro", template: "%s · Kyro" },
  description: "Kyro: the Inloop Media workspace",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Kyro", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export async function generateViewport() {
  return { themeColor: THEME_COLOR[await getTheme()], viewportFit: "cover" };
}

export default async function RootLayout({ children }) {
  const theme = await getTheme();
  return (
    <html lang="en" data-theme={theme} className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
