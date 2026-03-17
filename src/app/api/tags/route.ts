import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TagType } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slugParam = searchParams.get("slug");
    if (slugParam) {
      const slug = decodeURIComponent(slugParam);
      const tag = await db.tag.findUnique({
        where: { slug },
        include: {
          parent: { select: { id: true, name: true, slug: true } },
          children: {
            include: { _count: { select: { questions: true } } },
          },
          questions: {
            include: {
              question: {
                include: {
                  tags: { include: { tag: true } },
                  relationsFrom: { include: { to: true } },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          _count: { select: { questions: true } },
        },
      });
      if (!tag) return NextResponse.json(null, { status: 404 });
      return NextResponse.json(tag);
    }

    const type = searchParams.get("type") as TagType | null;
    const withCount = searchParams.get("withCount") === "true";
    const tree = searchParams.get("tree") === "true";

    const tags = await db.tag.findMany({
      where: type ? { type } : undefined,
      include: {
        children: withCount
          ? {
              include: {
                _count: { select: { questions: true } },
                children: {
                  include: { _count: { select: { questions: true } } },
                  orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
                },
              },
              orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            }
          : { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
        _count: withCount ? { select: { questions: true } } : undefined,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    if (tree) {
      const roots = tags.filter((t) => !t.parentId);
      return NextResponse.json(roots);
    }

    return NextResponse.json(tags);
  } catch (err) {
    console.error("[api/tags] DB error:", err);
    // 数据库未连接或报错时返回空数组，保证前端能解析 JSON
    if (request.nextUrl.searchParams.get("tree") === "true") {
      return NextResponse.json([]);
    }
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, type, description, parentId } = body;

  const slug = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-\u4e00-\u9fa5]/g, "");

  const tag = await db.tag.create({
    data: { name, slug, type, description, parentId },
  });

  return NextResponse.json(tag, { status: 201 });
}
