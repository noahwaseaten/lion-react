import type { Metadata } from "next";
import { Geist, Geist_Mono,  Dela_Gothic_One } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const delaGothicOne = Dela_Gothic_One({  // Initialize Dela Gothic One font
  subsets: ["latin"],
  weight: '400',
  variable: "--font-dela-gothic-one",
});

export const metadata: Metadata = {
  title: "LION",
  description: "The Lion Awakens",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${delaGothicOne.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
