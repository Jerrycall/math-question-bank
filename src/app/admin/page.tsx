"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Users, Bookmark, AlertTriangle } from "lucide-react";

type AccountRow = {
  id: string;
  username: string;
  createdAt: string;
  _count: { collections: number };
};

type CollectionRow = {
  id: string;
  name: string;
  createdAt: string;
  account: { id: string; username: string };
  _count: { questions: number };
};

export default function AdminPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setForbidden(false);
    setError(null);
    try {
      const [accRes, colRes] = await Promise.all([
        fetch("/api/admin/accounts", { credentials: "include" }),
        fetch("/api/admin/collections", { credentials: "include" }),
      ]);

      if (accRes.status === 403 || colRes.status === 403) {
        setForbidden(true);
        setLoading(false);
        return;
      }

      const accData = await accRes.json().catch(() => ({}));
      const colData = await colRes.json().catch(() => ({}));
      setAccounts(Array.isArray(accData?.accounts) ? accData.accounts : []);
      setCollections(Array.isArray(colData?.collections) ? colData.collections : []);
    } catch (e) {
      console.error("admin load error:", e);
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggleAccount(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirmChecked) {
      setError("请先勾选「我已知晓删除后果」");
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          checkbox_confirm: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "删除失败");
        return;
      }
      setSelectedIds(new Set());
      setConfirmChecked(false);
      await load();
    } catch (e) {
      setError("删除请求失败");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-8 bg-muted rounded w-1/3 animate-pulse" />
        <div className="h-48 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">需要管理员权限</h1>
            <p className="text-sm text-muted-foreground">仅管理员可访问此页面</p>
          </div>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p className="mb-4">当前账号不在管理员白名单中。</p>
            <p className="text-sm mb-4">
              管理员通过环境变量 <code className="bg-muted px-1 rounded">ADMIN_USERNAMES</code> 指定（逗号分隔用户名）。
            </p>
            <Button asChild variant="outline">
              <Link href="/">返回首页</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
          <Shield className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">管理员后台</h1>
          <p className="text-sm text-muted-foreground">用户与题集管理</p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-md">
          {error}
        </div>
      )}

      {/* 用户列表 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            全部用户
          </CardTitle>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                />
                我已知晓删除后果，确认删除所选账号
              </label>
              <Button
                variant="destructive"
                size="sm"
                disabled={!confirmChecked || deleting}
                onClick={deleteSelected}
              >
                {deleting ? "删除中…" : `删除 (${selectedIds.size})`}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无用户</p>
          ) : (
            <ul className="space-y-2">
              {accounts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(a.id)}
                    onChange={() => toggleAccount(a.id)}
                  />
                  <span className="font-medium">{a.username}</span>
                  <span className="text-xs text-muted-foreground">
                    {a._count?.collections ?? 0} 个题集
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 全部题集 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bookmark className="h-5 w-5" />
            全部用户的题集
          </CardTitle>
        </CardHeader>
        <CardContent>
          {collections.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无题集</p>
          ) : (
            <ul className="space-y-2">
              {collections.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                >
                  <Link
                    href={`/collections/${c.id}`}
                    className="font-medium hover:text-primary"
                  >
                    {c.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {c.account?.username ?? "—"} · {c._count?.questions ?? 0} 题
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
