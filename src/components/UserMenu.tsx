"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const AUTH_CHANGED_EVENT = "auth:changed";

type MeResponse = {
  user: null | { id: string; username: string; createdAt: string | Date };
  isAdmin?: boolean;
};

export function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<MeResponse["user"]>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) {
        setUser(null);
        setIsAdmin(false);
        return;
      }
      const data = (await res.json()) as MeResponse;
      setUser(data.user ?? null);
      setIsAdmin(!!data.isAdmin);
    } catch {
      setUser(null);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadMe();
  }, [loadMe, pathname]);

  // 登录/登出后其它页面发事件，立即刷新
  useEffect(() => {
    const onAuthChanged = () => {
      setLoading(true);
      loadMe();
    };
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
  }, [loadMe]);

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
      {isAdmin && (
        <Link href="/admin">
          <Button size="sm" variant="ghost">
            管理
          </Button>
        </Link>
      )}
      <div className="text-sm text-muted-foreground whitespace-nowrap">
        {user.username}
      </div>
      <Button size="sm" variant="outline" onClick={logout}>
        退出
      </Button>
    </div>
  );
}

