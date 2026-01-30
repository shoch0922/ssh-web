import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SSH Web Terminal",
  description: "Web-based SSH Terminal with multi-tab support",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
