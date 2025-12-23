import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI SDR",
  description: "AI-powered Outbound Sales Development Representative",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{
          __html: `
          .dark h1, .dark h2, .dark h3, .dark .text-2xl, .dark .text-3xl { color: #f8fafc !important; }
          .dark p, .dark .text-slate-600, .dark .text-muted-foreground { color: #cbd5e1 !important; }
          .dark table th { color: #94a3b8 !important; }
          .dark table td, .dark .text-slate-900, .dark .text-sm { color: #f1f5f9 !important; }
         .dark label { color: #e2e8f0 !important; }
          .dark .text-slate-700 { color: #cbd5e1 !important; }
        `}} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
