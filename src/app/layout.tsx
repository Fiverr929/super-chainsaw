import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";


import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Workstation",
  description: "Workstation for Etsy store management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <div id="portal" />
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
