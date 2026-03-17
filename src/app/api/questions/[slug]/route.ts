import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const question = await db.question.findUnique({
    where: { slug: params.slug },
    include: {
      tags: {
        include: { tag: { include: { children: true } } },
      },
      relationsFrom: {
        include: {
          to: {
            include: {
              tags: { include: { tag: true } },
            },
          },
        },
      },
      relationsTo: {
        include: {
          from: {
            include: {
              tags: { include: { tag: true } },
            },
          },
        },
      },
    },
  });

  if (!question) {
    return NextResponse.json({ error: "题目不存在" }, { status: 404 });
  }

  return NextResponse.json(question);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const body = await request.json();
  const { title, content, answer, analysis, difficulty, source, tagIds } = body;

  const question = await db.question.update({
    where: { slug: params.slug },
    data: {
      title,
      content,
      answer,
      analysis,
      difficulty,
      source,
      tags: tagIds
        ? {
            deleteMany: {},
            create: tagIds.map((tagId: string) => ({ tagId })),
          }
        : undefined,
    },
    include: {
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json(question);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  await db.question.delete({ where: { slug: params.slug } });
  return NextResponse.json({ ok: true });
}
