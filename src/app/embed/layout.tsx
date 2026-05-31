import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "../globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chatbot Widget",
  description: "AI-powered chatbot widget",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,      // prevent accidental pinch-zoom inside the widget iframe
  userScalable: false,
  viewportFit: 'cover', // fills notched iPhone screens edge-to-edge
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={poppins.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${poppins.className} antialiased`}
        suppressHydrationWarning
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {children}
      </body>
    </html>
  );
}
