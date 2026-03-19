"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type MeResponse = {
  user: null | { id: string; username: string; createdAt: string | Date };
};

export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<MeResponse["user"]>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function loadMe() {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          if (alive) setUser(null);
          return;
        }
        const data = (await res.json()) as MeResponse;
        if (alive) setUser(data.user ?? null);

        // 已登录后停止轮询，避免持续打接口
        if (data.user) {
          if (timer) clearInterval(timer);
          timer = null;
        }
      } catch {
        if (alive) setUser(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    // 首次立即加载
    loadMe();
    // 登录后通常会在 1-3 秒内刷新成已登录状态；轮询直到检测到已登录
    timer = setInterval(loadMe, 2500);

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    router.push("/questions");
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">加载中...</div>;
  }

  if (!user) {
    return (
      <Link href={`/login?returnTo=/collections`}>
        <Button size="sm" variant="outline">
          登录
        </Button>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-sm text-muted-foreground whitespace-nowrap">
        {user.username}
      </div>
      <Button size="sm" variant="outline" onClick={logout}>
        退出
      </Button>
    </div>
  );
}

