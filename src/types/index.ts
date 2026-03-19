export type Difficulty = "EASY" | "MEDIUM_LOW" | "MEDIUM" | "MEDIUM_HIGH" | "HARD";
export type TagType = "KNOWLEDGE" | "METHOD" | "THOUGHT" | "SOURCE";
export type RelationType = "SIMILAR" | "VARIANT" | "ADVANCED";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "简单",
  MEDIUM_LOW: "中低",
  MEDIUM: "中等",
  MEDIUM_HIGH: "中高",
  HARD: "困难",
};

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  EASY: "bg-green-100 text-green-700 border-green-200",
  MEDIUM_LOW: "bg-blue-100 text-blue-700 border-blue-200",
  MEDIUM: "bg-yellow-100 text-yellow-700 border-yellow-200",
  MEDIUM_HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  HARD: "bg-red-100 text-red-700 border-red-200",
};

export const TAG_TYPE_LABELS: Record<TagType, string> = {
  KNOWLEDGE: "知识点",
  METHOD: "方法",
  THOUGHT: "思想",
  SOURCE: "来源",
};

export const TAG_TYPE_COLORS: Record<TagType, string> = {
  KNOWLEDGE: "bg-purple-100 text-purple-700 border-purple-200",
  METHOD: "bg-cyan-100 text-cyan-700 border-cyan-200",
  THOUGHT: "bg-amber-100 text-amber-700 border-amber-200",
  SOURCE: "bg-gray-100 text-gray-700 border-gray-200",
};

export interface Tag {
  id: string;
  name: string;
  slug: string;
  type: TagType;
  description?: string | null;
  parentId?: string | null;
  sortOrder: number;
  children?: Tag[];
  _count?: { questions: number };
}

export interface Question {
  id: string;
  slug: string;
  title: string;
  content: string;
  answer: string;
  analysis: string;
  difficulty: Difficulty;
  source?: string | null;
  sourceYear?: number | null;
  createdAt: string | Date;
  tags?: Array<{ tag: Tag }>;
  relationsFrom?: Array<{ to: Question; relationType: RelationType }>;
  relationsTo?: Array<{ from: Question; relationType: RelationType }>;
}

export interface LearningRecord {
  id: string;
  accountId: string;
  questionId: string;
  isCorrect: boolean;
  timeSpentS: number;
  answeredAt: string | Date;
}

export interface ReviewSchedule {
  id: string;
  accountId: string;
  questionId: string;
  dueDate: string | Date;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  question?: Question;
}

export interface KnowledgeMastery {
  id: string;
  accountId: string;
  tagId: string;
  masteryScore: number;
  totalAttempts: number;
  correctAttempts: number;
  tag?: Tag;
}

// SM-2 评分（0-5）
export type SM2Quality = 0 | 1 | 2 | 3 | 4 | 5;

export interface GraphNode {
  id: string;
  label: string;
  type: "question" | "knowledge" | "method" | "thought" | "source";
  data?: Question | Tag;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: RelationType | "tagged";
}
