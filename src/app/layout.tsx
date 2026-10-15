import type { ReactNode } from "react";

export const metadata = {
  title: "FieldGuide",
  description: "Field support knowledge base",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Helvetica, Arial, sans-serif",
          background: "#f6f4ef",
          color: "#17212b",
        }}
      >
        {children}
      </body>
    </html>
  );
}
