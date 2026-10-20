import type { ReactNode } from "react";
import { Public_Sans } from "next/font/google";
import "./globals.css";
const font = Public_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap" });

export const metadata = {
  title: "FieldGuide",
  description: "Field support knowledge base",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={font.className} style={{ margin: 0, background: "#f5f5f5", color: "#171717" }}>
        {children}
      </body>
    </html>
  );
}