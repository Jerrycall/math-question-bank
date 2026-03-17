export const dynamic = "force-dynamic";

import React from "react";
import { TagDetailClient } from "./TagDetailClient";

export default async function TagDetailPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const resolved = await Promise.resolve(params);
  return <TagDetailClient slug={resolved.slug} />;
}
