"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [returnTo, setReturnTo] = useState("/questions");

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 避免使用 useSearchParams（Next 对它要求 Suspense）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    setReturnTo(sp.get("returnTo") || "/questions");
  }, []);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "操作失败");
        return;
      }

      if (mode === "register") {
        // 注册成功后，引导用户切换到登录
        setMode("login");
        return;
      }

      // 通知顶部栏立即刷新登录状态（避免不刷新、没有「管理」按钮）
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:changed"));
      }
      router.push(returnTo);
    } catch (e) {
      console.error("login page submit error:", e);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "login" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setMode("login")}
            >
              登录
            </Button>
            <Button
              type="button"
              variant={mode === "register" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setMode("register")}
            >
              注册
            </Button>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            {mode === "login" ? "使用账号密码进入我的题集" : "创建账号后即可保存题集"}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <div className="text-sm font-medium">用户名</div>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例如：zhangsan"
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-sm font-medium">密码</div>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <Button
            type="button"
            className="w-full"
            disabled={loading}
            onClick={submit}
          >
            {loading ? "处理中..." : mode === "login" ? "登录" : "注册"}
          </Button>

          {mode === "login" && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              忘记密码？本站未绑定邮箱，无法自助找回。请联系管理员在「管理」后台为你重置密码；若你是站主且管理员账号遗忘，需在数据库中手动更新密码哈希。
            </p>
          )}

          {mode === "register" && (
            <div className="text-xs text-muted-foreground">
              注册成功后将自动切换到登录界面。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

