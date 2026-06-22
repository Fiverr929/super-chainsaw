import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";


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
    >
      <body className="min-h-full flex flex-col">
        {children}
        <div id="portal" />
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
