"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Loader2, User, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleCentralAuthLogin = async () => {
    setIsLoading(true);
    try {
      await signIn("central-auth", { callbackUrl: "/dashboard" });
    } catch (error) {
      console.error("Central auth login error:", error);
      setIsLoading(false);
    }
  };

  const handleDashboardClick = () => {
    setIsLoading(true);
    router.push("/dashboard");
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut({ callbackUrl: "/?logout=success" });
    } catch (error) {
      console.error("Logout error:", error);
      setIsLoggingOut(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="flex flex-col items-center gap-6">
          {/* Animated spinner */}
          <div className="relative w-20 h-20">
            {/* Outer ring */}
            <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-white/20 animate-pulse" />
            {/* Spinning ring */}
            <div 
              className="absolute inset-0 w-20 h-20 rounded-full border-4 border-transparent border-t-white border-r-white animate-spin" 
              style={{ animationDuration: "0.8s" }} 
            />
            {/* Middle ring - opposite direction */}
            <div 
              className="absolute inset-2 w-16 h-16 rounded-full border-4 border-transparent border-b-white/70 border-l-white/70 animate-spin" 
              style={{ animationDuration: "1.2s", animationDirection: "reverse" }} 
            />
            {/* Inner pulsing dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div 
                className="w-4 h-4 rounded-full bg-white animate-pulse" 
                style={{ animationDuration: "1.5s" }} 
              />
            </div>
          </div>

          {/* Loading text with animated dots */}
          <div className="flex items-center gap-1">
            <div className="flex gap-1 pb-1">
              <span 
                className="w-2 h-2 rounded-full bg-white animate-bounce" 
                style={{ animationDelay: "0ms" }} 
              />
              <span 
                className="w-2 h-2 rounded-full bg-white animate-bounce" 
                style={{ animationDelay: "150ms" }} 
              />
              <span 
                className="w-2 h-2 rounded-full bg-white animate-bounce" 
                style={{ animationDelay: "300ms" }} 
              />
            </div>
          </div>

          {/* Shimmer progress bar */}
          <div className="w-64 h-1.5 bg-white/20 rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-r from-white via-white/60 to-white animate-shimmer bg-[length:200%_100%]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/logo.png"
          alt="Background"
          fill
          className="object-contain opacity-5 animate-[zoom_20s_ease-in-out_infinite_alternate]"
          priority
          quality={100}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-4">
        {/* Logo - Clickable */}
        <Link
          href="https://prabisha.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-10 animate-[fadeInDown_1s_ease-out] hover:scale-110 transition-transform duration-300 cursor-pointer"
        >
          <Image
            src="/logo.png"
            alt="Prabisha Consulting"
            width={300}
            height={70}
            className="drop-shadow-2xl brightness-0 invert"
            priority
          />
        </Link>

        {/* Main Content */}
        <div className="text-center space-y-6 max-w-5xl mx-auto animate-[fadeInUp_1s_ease-out]">
          <h1 className="text-3xl md:text-5xl font-bold text-white drop-shadow-2xl leading-tight animate-[fadeIn_1.2s_ease-out]">
            Intelligent Chatbot Platform
          </h1>
          
          <p className="text-lg md:text-xl text-white/90 drop-shadow-lg animate-[fadeIn_1.4s_ease-out] max-w-3xl mx-auto">
            Build powerful AI chatbots without writing code. Connect to your data, train on your content, and deploy instantly.
          </p>

          {/* User Section */}
          {session?.user ? (
            <div className="space-y-6 mt-10 animate-[fadeIn_1.6s_ease-out]">
              <div className="flex flex-col items-center space-y-4 p-6 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-2xl mx-auto max-w-md hover:bg-white/15 transition-all duration-300 hover:scale-105">
                <Avatar className="h-16 w-16 border-2 border-white/40 shadow-xl">
                  <AvatarImage 
                    src={session.user.image ?? ""} 
                    alt={session.user.name ?? ""} 
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                    {session.user.name?.charAt(0) || session.user.email?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-white">
                    {session.user.name || session.user.email?.split('@')[0]}
                  </h2>
                  <p className="text-sm text-white/80 mt-1">
                    {session.user.email}
                  </p>
                  {(session.user as any)?.role && (
                    <p className="text-xs text-white/70 mt-2 bg-white/10 px-3 py-1 rounded-full inline-block">
                      {(session.user as any).role}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-4 justify-center flex-wrap">
                <Button
                  onClick={handleDashboardClick}
                  disabled={isLoading}
                  className="flex items-center gap-2 bg-white text-black hover:bg-white/90 hover:scale-105 transition-all duration-300 shadow-xl"
                  size="lg"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                  {isLoading ? "Loading..." : "Go to Dashboard"}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex items-center gap-2 bg-white/10 text-white border-white/30 hover:bg-white/20 hover:scale-105 transition-all duration-300 shadow-xl backdrop-blur-sm"
                  size="lg"
                >
                  {isLoggingOut ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <LogOut className="h-5 w-5" />
                  )}
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-10 flex justify-center animate-[fadeIn_1.6s_ease-out]">
              <Button
                onClick={handleCentralAuthLogin}
                disabled={isLoading}
                size="lg"
                className="relative flex items-center justify-center gap-2 bg-transparent text-white hover:bg-white/10 px-10 py-6 text-lg font-semibold rounded-full hover:scale-105 transition-all duration-300 shadow-2xl border-2 border-white/50 hover:border-white overflow-hidden group backdrop-blur-sm"
              >
                <span className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500"></span>
                <span className="relative z-10 flex items-center gap-2">
                  {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
                  {isLoading ? "Connecting..." : "Login with Central Auth"}
                </span>
              </Button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
