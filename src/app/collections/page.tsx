"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type MyCollection = {
  id: string;
  name: string;
  createdAt: string | Date;
  _count?: { questions: number };
};

export default function CollectionsPage() {
  const router = useRouter();
  const [collections, setCollections] = useState<MyCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function ensureAuthAndLoad() {
    setLoading(true);
    setError(null);
    try {
      const meRes = await fetch("/api/auth/me", { credentials: "include" });
      if (!meRes.ok) {
        router.push(`/login?returnTo=/collections`);
        return;
      }

      const listRes = await fetch("/api/collections", { credentials: "include" });
      const data = await listRes.json().catch(() => ({}));
      setCollections(Array.isArray(data?.collections) ? data.collections : []);
    } catch (e) {
      console.error("load collections error:", e);
      setError("加载失败，请刷新重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    ensureAuthAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCollection() {
    const name = window.prompt("请输入题集名称（最多 50 字）");
    if (!name) return;

    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data?.error || "创建失败");
      return;
    }
    await ensureAuthAndLoad();
  }

  const title = useMemo(() => "我的题集", []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <Button onClick={createCollection}>+ 新建题集</Button>
      </div>

      {loading && <div className="text-sm text-muted-foreground">加载中...</div>}
      {error && <div className="text-sm text-destructive">{error}</div>}

      {!loading && collections.length === 0 && (
        <div className="text-sm text-muted-foreground">
          你还没有题集。点击「新建题集」开始保存你勾选的题目。
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {collections.map((c) => (
          <Link key={c.id} href={`/collections/${c.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold line-clamp-1">{c.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {c._count?.questions ?? 0} 题
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-sm text-muted-foreground">
                  点击进入查看题目并导出 PDF
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

