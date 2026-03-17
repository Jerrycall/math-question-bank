import matter from "gray-matter";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

export interface QuestionFrontmatter {
  id: string;
  slug: string;
  title: string;
  difficulty: number;
  source?: string;
  sourceYear?: number;
  createdAt: string;
  tags: {
    knowledge?: string[];
    method?: string[];
    thought?: string[];
    source?: string[];
  };
  related?: string[];
}

export interface ParsedQuestion {
  frontmatter: QuestionFrontmatter;
  content: string;    // 题目内容（去除 frontmatter 后的全文）
  question: string;   // ## 题目 章节
  answer: string;     // ## 答案 章节
  analysis: string;   // ## 解析 章节
  filePath: string;
}

function extractSection(content: string, heading: string): string {
  const regex = new RegExp(
    `## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`,
    "i"
  );
  const match = content.match(regex);
  return match ? match[1].trim() : "";
}

export function parseQuestionFile(filePath: string): ParsedQuestion {
  const fileContent = readFileSync(filePath, "utf-8");
  const { data, content } = matter(fileContent);

  return {
    frontmatter: data as QuestionFrontmatter,
    content,
    question: extractSection(content, "题目"),
    answer: extractSection(content, "答案"),
    analysis: extractSection(content, "解析"),
    filePath,
  };
}

export function getAllQuestionFiles(questionsDir: string): string[] {
  const files: string[] = [];

  function traverse(dir: string) {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (entry.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }

  traverse(questionsDir);
  return files;
}
