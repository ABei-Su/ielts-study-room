import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IELTS 自习室 · Academic",
  description:
    "私人雅思学习空间：官方听力、阅读、写作样题，生词复习与云端学习记录。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
