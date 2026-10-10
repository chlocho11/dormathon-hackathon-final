import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TokenGuard AI",
  description: "Predict early. Spend smarter. AI cost forecasting and decision support.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
