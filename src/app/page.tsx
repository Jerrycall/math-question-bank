import Link from "next/link";
import { BookOpen, Network, RotateCcw, Brain, BarChart3, Tag, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: BookOpen,
    title: "题库管理",
    desc: "Markdown 卡片形式存储，支持 LaTeX 数学公式，一键录入题目",
    href: "/questions",
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/20",
  },
  {
    icon: Tag,
    title: "智能标签",
    desc: "知识点 × 方法 × 思想 × 来源，层级标签树，多维度组合筛选",
    href: "/tags",
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-950/20",
  },
  {
    icon: Network,
    title: "知识图谱",
    desc: "可视化知识关联网络，双链结构，探索知识学习路径",
    href: "/graph",
    color: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
  },
  {
    icon: RotateCcw,
    title: "间隔复习",
    desc: "SM-2 算法驱动，科学安排复习时间，高效记忆不遗忘",
    href: "/review",
    color: "text-orange-500",
    bg: "bg-orange-50 dark:bg-orange-950/20",
  },
  {
    icon: Brain,
    title: "AI 助手",
    desc: "自动提取知识点、生成解析、出变式题，AI 实时答疑",
    href: "/learn",
    color: "text-pink-500",
    bg: "bg-pink-50 dark:bg-pink-950/20",
  },
  {
    icon: BarChart3,
    title: "学习统计",
    desc: "掌握度雷达图、正确率趋势、错题本，全面了解学习状态",
    href: "/stats",
    color: "text-cyan-500",
    bg: "bg-cyan-50 dark:bg-cyan-950/20",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero 区域 */}
      <div className="text-center space-y-6 py-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <Sparkles className="h-4 w-4" />
          题库 + 知识图谱 + AI辅助 + 间隔复习
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          高中数学
          <span className="text-primary"> 智能学习</span>
          系统
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
          不只是题库，而是完整的数学学习生态。
          通过知识图谱理解知识结构，借助 AI 深入理解解题思路，
          用间隔复习科学巩固记忆。
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/questions">
            <Button size="lg" className="gap-2">
              开始刷题
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/learn">
            <Button variant="outline" size="lg" className="gap-2">
              <Brain className="h-4 w-4" />
              AI 助手
            </Button>
          </Link>
        </div>
      </div>

      {/* 功能卡片 */}
      <div>
        <h2 className="text-xl font-semibold mb-6 text-center">核心功能</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, desc, href, color, bg }) => (
            <Link key={href} href={href}>
              <Card className="h-full hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer">
                <CardContent className="p-5 space-y-3">
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {desc}
                    </p>
                  </div>
                  <div className={`text-xs font-medium ${color} flex items-center gap-1`}>
                    进入
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* 快速入门 */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-8 text-center space-y-4">
        <h2 className="text-xl font-semibold">快速开始</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-sm">
          {[
            { step: "1", text: "录入或导入题目，AI自动提取知识标签" },
            { step: "2", text: "在知识图谱中探索知识关联结构" },
            { step: "3", text: "系统按 SM-2 算法安排每日复习计划" },
          ].map(({ step, text }) => (
            <div key={step} className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                {step}
              </div>
              <p className="text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
