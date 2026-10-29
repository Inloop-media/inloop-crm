import { Inter, Instrument_Serif } from "next/font/google";
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

export const viewport = { themeColor: "#08080a", viewportFit: "cover" };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
