import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campus Nexus — Secure Examination & Tech Arena",
  description:
    "Secure, scalable online exam system and competitive tech portal with real-time monitoring and anti-cheat protection.",
  icons: {
    icon: [
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body className="">{children}</body>
    </html>
  );
}
