import { Inter, Instrument_Serif } from "next/font/google";
import { getTheme } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata = {
  title: { default: "Inloop CRM", template: "%s · Inloop CRM" },
  description: "Lead management for Inloop Media",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Inloop CRM", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export async function generateViewport() {
  return { themeColor: (await getTheme()) === "light" ? "#f5f5f8" : "#070709", viewportFit: "cover" };
}

export default async function RootLayout({ children }) {
  const theme = await getTheme();
  return (
    <html lang="en" data-theme={theme} className={`${inter.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
