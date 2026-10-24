import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "የሰራተኞች ክትትል | Staff Attendance",
  description: "Secure biometric attendance management for school staff."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="am">
      <body>{children}</body>
    </html>
  );
}
