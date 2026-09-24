import type { Metadata } from "next";
import { Familjen_Grotesk, Fraunces } from "next/font/google";
import "./globals.css";

const sans = Familjen_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "Personal Hiring Radar",
  description: "A private desk that watches company careers pages and keeps the roles that match your field.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#e7dcc6" />
      </head>
      <body className={`${sans.variable} ${display.variable}`}>
        <a className="skip" href="#desk">Skip to the desk</a>
        {children}
      </body>
    </html>
  );
}
