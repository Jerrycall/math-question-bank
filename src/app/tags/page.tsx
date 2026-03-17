export const dynamic = "force-dynamic";

import React from "react";
import { db } from "@/lib/db";
import { TagsPageClient } from "./TagsPageClient";

async function getTags() {
  return db.tag.findMany({
    where: { parentId: null },
    include: {
      children: {
        include: {
          _count: { select: { questions: true } },
          children: {
            include: { _count: { select: { questions: true } } },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { questions: true } },
    },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
  });
}

export default async function TagsPage() {
  const tags = await getTags();
  return (
    <div className="space-y-8">
      <TagsPageClient tags={tags} />
    </div>
  );
}
