import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import {
  BookOpen,
  Network,
  BarChart3,
  RotateCcw,
  Tag,
  Brain,
  Home,
} from "lucide-react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "高中数学题库",
  description: "题库 + 知识图谱 + 学习系统 + AI辅助 一体化平台",
};

const navItems = [
  { href: "/", icon: Home, label: "首页" },
  { href: "/questions", icon: BookOpen, label: "题库" },
  { href: "/tags", icon: Tag, label: "标签" },
  { href: "/graph", icon: Network, label: "知识图谱" },
  { href: "/review", icon: RotateCcw, label: "复习" },
  { href: "/stats", icon: BarChart3, label: "统计" },
  { href: "/learn", icon: Brain, label: "AI 助手" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          {/* 顶部导航 */}
          <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2.5 font-bold text-lg">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="hidden sm:block">高中数学题库</span>
              </Link>

              <nav className="flex items-center gap-1">
                {navItems.map(({ href, icon: Icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden md:block">{label}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </header>

          {/* 主内容 */}
          <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
            {children}
          </main>

          {/* 底部 */}
          <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
            高中数学题库学习系统 · 知识图谱 + AI辅助 + 间隔复习
          </footer>
        </div>
      </body>
    </html>
  );
}
