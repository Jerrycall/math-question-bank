# 高中数学题库学习系统

> 题库 + 知识图谱 + 学习系统 + AI辅助 一体化平台

## 功能模块

| 模块 | 说明 |
|------|------|
| 📚 **题库管理** | Markdown 卡片存储，KaTeX 公式渲染，LaTeX 支持 |
| 🏷️ **标签系统** | 知识点/方法/思想/来源，层级结构，多标签筛选 |
| 🌐 **知识图谱** | Cytoscape.js 可视化，双链结构，节点交互 |
| 🔁 **间隔复习** | SM-2 算法，科学安排复习计划 |
| 🤖 **AI 助手** | GPT-4o 自动结构化、生成解析、变式题、实时答疑 |
| 📊 **学习统计** | 掌握度雷达图、正确率趋势、错题管理 |

## 技术栈

- **框架**：Next.js 14 (App Router)
- **样式**：TailwindCSS
- **数据库**：PostgreSQL + pgvector（语义搜索）
- **ORM**：Prisma
- **AI**：OpenAI GPT-4o + text-embedding-3-small
- **图谱**：Cytoscape.js
- **公式**：KaTeX
- **图表**：Recharts

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local` 并填写：

```env
DATABASE_URL="postgresql://user:password@localhost:5432/math_question_bank"
REDIS_URL="redis://localhost:6379"
OPENAI_API_KEY="sk-..."
```

#### 使用 DeepSeek 做对话（讲题 / 结构化 / 变式）

DeepSeek 与 OpenAI SDK 兼容。推荐配置：

```env
AI_API_BASE_URL="https://api.deepseek.com"
AI_API_KEY="你的 DeepSeek API Key"
# 可选，不设且 base 含 deepseek 时默认为 deepseek-chat
AI_CHAT_MODEL="deepseek-chat"
```

**相似题**依赖向量（`text-embedding-3-small`），DeepSeek 当前不提供同类接口，请**另配** OpenAI 的 Key 专用于向量（可与上面并存）：

```env
OPENAI_API_KEY="sk-... 仅用于 embedding"
```

若只配 DeepSeek、不配 OpenAI，对话类 AI 可用，**相似题**会报错直至配置向量 Key。详见 `src/lib/ai/client.ts` 注释。

Vercel 上把上述变量同样加到 **Environment Variables** 并重新部署。

### 3. 初始化数据库

```bash
# 确保 PostgreSQL 已启动并开启 pgvector 扩展
psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 推送数据库结构
npm run db:push

# 可选：打开可视化管理界面
npm run db:studio
```

### 4. 同步 Markdown 题目

```bash
npm run sync-md
```

将 `questions/` 目录下所有 Markdown 题目文件同步到数据库。

### 5. 导入上海高三复习题集（流墨轩格式）

若你有「上海高三复习题集 / 题目库」这类 Markdown 题目目录（含 frontmatter：知识点、方法、思想、来源、题型），可一次性导入并保留原标签：

```bash
# 使用默认路径（流墨轩·AI教研 下的题目库）
npm run import-shanghai

# 或指定题目库目录
SHANGHAI_QUESTIONS_DIR="/你的/题目库/绝对路径" npm run import-shanghai
```

- 题目 slug 格式：`shanghai-D003`、`shanghai-E001` 等，与源文件 id 对应。
- 详细说明见项目内 **`scripts/README.md`**。

### 题目中的图片

题目内容、答案、解析支持 Markdown，其中图片使用标准语法：`![说明](图片地址)`。

- **在应用内录入题目时**：可先通过 **`POST /api/upload/image`** 上传图片（表单字段 `file`），接口返回 `{ url: "/uploads/xxx.png" }`，把该 URL 写在 Markdown 里即可，例如：`![示意图](/uploads/xxx.png)`。图片会保存在 `public/uploads/`，单张限制 5MB，支持 JPG/PNG/GIF/WebP。
- **从本地 Markdown 导入时**：若题目里有相对路径图片（如 `![](./img/1.png)`），需先把图片放到 `public/uploads/`，并在 Markdown 中改为绝对路径 `/uploads/文件名`，再导入。
- **已批量导入过的题目（如上海题集）**：若当时题目内容里含相对路径图片，可运行 **`npm run fix-imported-images`**，脚本会根据库中保存的源文件路径把图片拷贝到 `public/uploads/` 并自动更新题目中的链接。详见 **`scripts/README.md`** 中的「三、fix-imported-images」。

### 6. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

---

## 脚本说明（详见 scripts/README.md）

| 命令 | 说明 |
|------|------|
| `npm run sync-md` | 同步本项目 `questions/` 下的题目到数据库 |
| `npm run import-shanghai` | 导入「上海高三复习题集」题目库，保留原标签 |

## 题目文件格式

题目存储在 `questions/` 目录，使用 Markdown + YAML frontmatter 格式：

```markdown
---
id: q-001
slug: q-001-derivative-monotone
title: 导数判断单调性
difficulty: 3
source: 2023年高考全国卷I
tags:
  knowledge: [导数, 单调性, 函数]
  method: [导数法, 分类讨论]
  thought: [函数思想, 转化思想]
related: [q-002-derivative-extremum]
---

# 导数判断单调性

## 题目
已知函数 $f(x) = x^3 - 3x + 2$，求 $f(x)$ 的单调递增区间。

## 答案
单调递增区间为 $(-\infty, -1)$ 和 $(1, +\infty)$

## 解析
...

## 扩展
- 相关题目：[[q-002-derivative-extremum]]
- 易错点：...
```

## 目录结构

```
高中数学题库/
├── questions/              # Markdown 题目库
│   ├── algebra/            # 代数（函数/数列/不等式）
│   ├── calculus/           # 微积分（导数/积分）
│   ├── geometry/           # 几何（立体/解析）
│   └── probability/        # 概率统计
├── src/
│   ├── app/                # Next.js 页面
│   │   ├── questions/      # 题库浏览/详情
│   │   ├── tags/           # 标签系统
│   │   ├── graph/          # 知识图谱
│   │   ├── review/         # 间隔复习
│   │   ├── stats/          # 学习统计
│   │   ├── learn/          # AI 助手
│   │   └── api/            # REST API
│   ├── components/         # 可复用组件
│   │   ├── QuestionCard/   # 题目卡片（KaTeX）
│   │   ├── KnowledgeGraph/ # 图谱（Cytoscape.js）
│   │   ├── TagBrowser/     # 标签浏览器
│   │   ├── ReviewSession/  # 复习会话（SM-2）
│   │   └── StatsCharts/    # 统计图表
│   └── lib/
│       ├── ai/             # OpenAI 封装
│       ├── spaced-repetition/ # SM-2 算法
│       └── markdown/       # MD 解析
├── prisma/schema.prisma    # 数据库模型
└── scripts/sync-md.ts      # MD→DB 同步脚本
```

## 数据库表

| 表名 | 说明 |
|------|------|
| `questions` | 题目（含 pgvector embedding） |
| `tags` | 标签（层级结构） |
| `question_tags` | 题目-标签多对多 |
| `question_relations` | 题目双向关联 |
| `users` | 用户 |
| `learning_records` | 做题记录 |
| `review_schedules` | SM-2 复习调度 |
| `knowledge_mastery` | 知识点掌握度 |

## API 接口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/questions` | GET/POST | 题目列表/创建 |
| `/api/questions/[slug]` | GET/PUT/DELETE | 题目详情 |
| `/api/tags` | GET/POST | 标签管理 |
| `/api/graph` | GET | 知识图谱数据 |
| `/api/review` | GET | 今日待复习 |
| `/api/review/submit` | POST | 提交复习结果 |
| `/api/stats` | GET | 学习统计数据 |
| `/api/ai/structurize` | POST | AI 题目结构化 |
| `/api/ai/similar` | POST | 相似题推荐 |
| `/api/ai/explain` | POST | AI 讲题（流式） |
| `/api/ai/variants` | POST | 生成变式题 |
