"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ArrowRight,
  Tag,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MathRenderer } from "./MathRenderer";
import {
  Question,
  type Difficulty,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  TAG_TYPE_COLORS,
  TAG_TYPE_LABELS,
  TagType,
} from "@/types";

/** 卡片展示用题目（API 返回可能不含 createdAt，枚举可能是 string） */
export type QuestionCardQuestion = Omit<Question, "createdAt" | "difficulty"> & {
  createdAt?: string | Date;
  difficulty: Question["difficulty"] | string;
};

interface QuestionCardProps {
  question: QuestionCardQuestion;
  showAnswer?: boolean;
  compact?: boolean;
}

export function QuestionCard({
  question,
  showAnswer = false,
  compact = false,
}: QuestionCardProps) {
  const [answerVisible, setAnswerVisible] = useState(showAnswer);

  const knowledgeTags =
    question.tags?.filter((t) => t.tag.type === "KNOWLEDGE") ?? [];
  const methodTags =
    question.tags?.filter((t) => t.tag.type === "METHOD") ?? [];
  const thoughtTags =
    question.tags?.filter((t) => t.tag.type === "THOUGHT") ?? [];
  const sourceTags =
    question.tags?.filter((t) => t.tag.type === "SOURCE") ?? [];

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <Link
            href={`/questions/${question.slug}`}
            className="text-base font-semibold hover:text-primary transition-colors line-clamp-2 flex-1"
          >
            {question.title}
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              className={`text-xs ${DIFFICULTY_COLORS[question.difficulty as Difficulty]}`}
            >
              {"★".repeat(
                { EASY: 1, MEDIUM_LOW: 2, MEDIUM: 3, MEDIUM_HIGH: 4, HARD: 5 }[
                  question.difficulty as Difficulty
                ]
              )}
              {" "}
              {DIFFICULTY_LABELS[question.difficulty as Difficulty]}
            </Badge>
          </div>
        </div>

        {/* 来源信息 */}
        {question.source && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {question.source}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 题目内容 */}
        <div className="rounded-lg bg-muted/40 p-4">
          <MathRenderer content={question.content} />
        </div>

        {/* 标签区域 */}
        {!compact && (
          <div className="space-y-2">
            {[
              { tags: knowledgeTags, type: "KNOWLEDGE" as TagType },
              { tags: methodTags, type: "METHOD" as TagType },
              { tags: thoughtTags, type: "THOUGHT" as TagType },
              { tags: sourceTags, type: "SOURCE" as TagType },
            ]
              .filter(({ tags }) => tags.length > 0)
              .map(({ tags, type }) => (
                <div key={type} className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground w-12 shrink-0">
                    {TAG_TYPE_LABELS[type]}
                  </span>
                  {tags.map(({ tag }) => (
                    <Link key={tag.id} href={`/tags/${tag.slug}`}>
                      <Badge
                        className={`text-xs cursor-pointer hover:opacity-80 ${TAG_TYPE_COLORS[type]}`}
                      >
                        <Tag className="h-2.5 w-2.5 mr-1" />
                        {tag.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ))}
          </div>
        )}

        {/* 答案/解析切换 */}
        <div className="space-y-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAnswerVisible(!answerVisible)}
            className="w-full"
          >
            {answerVisible ? (
              <>
                <ChevronUp className="h-4 w-4" />
                收起答案与解析
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                查看答案与解析
              </>
            )}
          </Button>

          {answerVisible && (
            <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
              {/* 答案 */}
              <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4">
                <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2 uppercase tracking-wide">
                  标准答案
                </p>
                <MathRenderer content={question.answer} />
              </div>

              {/* 解析 */}
              {!compact && question.analysis && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 p-4">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2 uppercase tracking-wide">
                    详细解析
                  </p>
                  <MathRenderer content={question.analysis} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        {!compact && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              {question.relationsFrom && question.relationsFrom.length > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {question.relationsFrom.length} 道相关题
                </span>
              )}
            </div>
            <Link href={`/questions/${question.slug}`}>
              <Button variant="ghost" size="sm" className="text-xs">
                查看详情
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
