import Script from "next/script";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { SessionProvider } from "@/providers/session-provider";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import GoogleOneTap from "@/components/features/GoogleOneTap";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Prabisha Chatbots",
  description: "Build and customize AI chatbots with ease using Prabisha's intuitive platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Suspense fallback={<Skeleton className="h-screen w-full" />}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
          >
            <SessionProvider>
              { process.env.NODE_ENV !== "development" && <GoogleOneTap /> }
              <Toaster richColors position="top-right" closeButton />
              {children}
            </SessionProvider>
          </ThemeProvider>
        </Suspense>
      </body>
    </html>
  );
}
