import "./globals.css";
import type { Metadata } from "next";
import { Space_Grotesk, Sora } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"]
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600"]
});

export const metadata: Metadata = {
  title: "AquaNexus",
  description: "Futuristic water allocation intelligence dashboard"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${sora.variable} bg-aqua-deep text-white antialiased`}>
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-24 top-[-10%] h-[420px] w-[420px] rounded-full bg-cyan-400/30 blur-[160px]" />
          <div className="absolute right-[-15%] top-[15%] h-[520px] w-[520px] rounded-full bg-blue-500/20 blur-[180px]" />
          <div className="absolute bottom-[-20%] left-[15%] h-[480px] w-[480px] rounded-full bg-sky-300/20 blur-[180px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.5),_rgba(2,6,23,0.95))]" />
        </div>
        <div className="min-h-screen px-4 pb-16 pt-6 sm:px-8 lg:px-14">
          {children}
        </div>
      </body>
    </html>
  );
}
