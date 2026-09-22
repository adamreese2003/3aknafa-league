import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });

export async function generateMetadata(): Promise<Metadata> {
  const settings = getSettings();
  return {
    title: `${settings.leagueName} — PlayStation League`,
    description: "Private friends league: standings, matches, and monthly awards.",
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const settings = getSettings();
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>
        <Nav leagueName={settings.leagueName} user={user} />
        <main className="relative z-[2] min-h-[calc(100vh-4rem)]">{children}</main>
        <footer className="relative z-[2] border-t border-white/5 py-6 text-center text-xs text-white/30">
          {settings.leagueName} · built for the squad · stats update themselves
        </footer>
      </body>
    </html>
  );
}
