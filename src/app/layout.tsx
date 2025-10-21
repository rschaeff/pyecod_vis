import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "ECOD Curation",
  description: "Manual domain boundary review and classification",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen" suppressHydrationWarning>
        <Navigation />
        {children}
      </body>
    </html>
  );
}
