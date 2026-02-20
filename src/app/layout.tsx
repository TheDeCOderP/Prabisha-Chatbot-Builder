import Script from "next/script";
import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { SessionProvider } from "@/providers/session-provider";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import GoogleOneTap from "@/components/features/GoogleOneTap";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
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
        className={`${poppins.variable} ${poppins.className} antialiased`} suppressHydrationWarning
        style={{ fontFamily: 'var(--font-poppins)' }}
      >
        <Suspense fallback={<Skeleton className="h-screen w-full" />}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            
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
