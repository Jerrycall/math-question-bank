import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Difficulty } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tags = searchParams.getAll("tags");
    const tagMode = searchParams.get("tagMode") ?? "or"; // "and" 交集 | "or" 并集
    const difficulty = searchParams.get("difficulty") as Difficulty | null;
    const q = searchParams.get("q");
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "12");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (tags.length > 0) {
      if (tagMode === "and") {
        // 交集：题目必须同时拥有所有选中标签
        where.AND = (where.AND as unknown[] ?? []).concat(
          tags.map((slug) => ({
            tags: { some: { tag: { slug } } },
          }))
        );
      } else {
        // 并集：题目拥有任意一个选中标签即可
        where.tags = {
          some: {
            tag: {
              slug: { in: tags },
            },
          },
        };
      }
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
      ];
    }

    const [questions, total] = await Promise.all([
      db.question.findMany({
        where,
        include: {
          tags: {
            include: { tag: true },
          },
          relationsFrom: {
            include: {
              to: {
                select: { id: true, slug: true, title: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.question.count({ where }),
    ]);

    return NextResponse.json({
      questions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[api/questions] DB error:", err);
    return NextResponse.json({
      questions: [],
      total: 0,
      page: 1,
      totalPages: 0,
    });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, content, answer, analysis, difficulty, source, sourceYear, tagIds } = body;

  const question = await db.question.create({
    data: {
      slug: `q-${Date.now()}`,
      title,
      content,
      answer,
      analysis,
      difficulty: difficulty ?? "MEDIUM",
      source,
      sourceYear,
      tags: tagIds
        ? {
            create: tagIds.map((tagId: string) => ({ tagId })),
          }
        : undefined,
    },
    include: {
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json(question, { status: 201 });
}
