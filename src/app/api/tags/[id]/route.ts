import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { parentId, sortOrder } = body;

    const data: { parentId?: string | null; sortOrder?: number } = {};
    if (parentId !== undefined) data.parentId = parentId === "" ? null : parentId;
    if (typeof sortOrder === "number") data.sortOrder = sortOrder;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "无有效更新字段" }, { status: 400 });
    }

    const tag = await db.tag.update({
      where: { id },
      data,
    });
    return NextResponse.json(tag);
  } catch (e) {
    console.error("[api/tags/[id]] PATCH error:", e);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
