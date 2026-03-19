"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Play } from "lucide-react";

declare global {
  interface Window {
    GGBApplet?: new (params: Record<string, unknown>, useBrowserForJS?: boolean) => {
      inject: (containerId: string, type?: string) => void;
    };
    [key: string]: unknown;
  }
}

interface GeoGebraPreviewProps {
  commands: string[];
  className?: string;
  onCommandFailed?: (failedLine: string, errorHint: string) => Promise<string[] | null>;
}

const GGB_SCRIPT_SRC = "https://www.geogebra.org/apps/deployggb.js";

function ensureGgbScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.GGBApplet) return resolve();

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GGB_SCRIPT_SRC}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("GeoGebra 脚本加载失败")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = GGB_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("GeoGebra 脚本加载失败"));
    document.head.appendChild(script);
  });
}

export function GeoGebraPreview({
  commands,
  className,
  onCommandFailed,
}: GeoGebraPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [booted, setBooted] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appletId = useMemo(
    () => `ggbApplet_${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  useEffect(() => {
    let mounted = true;
    async function init() {
      if (!hostRef.current || booted) return;
      setLoading(true);
      setError("");
      try {
        await ensureGgbScript();
        if (!mounted || !hostRef.current) return;
        if (!window.GGBApplet) throw new Error("GeoGebra 组件不可用");

        hostRef.current.innerHTML = "";
        const container = document.createElement("div");
        container.id = `${appletId}_host`;
        hostRef.current.appendChild(container);

        const applet = new window.GGBApplet(
          {
            id: appletId,
            appName: "classic",
            width: 900,
            height: 520,
            showToolBar: true,
            showAlgebraInput: true,
            showMenuBar: false,
            showResetIcon: true,
            language: "zh",
            borderColor: "#e5e7eb",
            scaleContainerClass: "ggb-scale-container",
            allowStyleBar: true,
            showToolBarHelp: false,
          },
          true
        );
        applet.inject(container.id, "preferhtml5");

        setBooted(true);
        setReady(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "GeoGebra 加载失败";
        setError(msg);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void init();
    return () => {
      mounted = false;
    };
  }, [appletId, booted]);

  const runCommands = async () => {
    setError("");
    try {
      const api = window[appletId] as
        | {
            evalCommand?: (cmd: string) => boolean;
            reset?: () => void;
            setErrorDialogsActive?: (active: boolean) => void;
          }
        | undefined;
      if (!api?.evalCommand) {
        setError("GeoGebra 尚未就绪，请稍后再试。");
        return;
      }

      if (typeof api.setErrorDialogsActive === "function") {
        api.setErrorDialogsActive(false);
      }
      if (typeof api.reset === "function") api.reset();

      const base = commands
        .map((cmd, i) => ({ cmd: cmd.trim(), index: i + 1 }))
        .filter((x) => x.cmd)
        .filter((x) => x.cmd.includes("(") || x.cmd.includes("="))
        .filter((x) => !/^note\s*:|^tips?\s*:|^the\s+/i.test(x.cmd));

      // 允许命令存在依赖顺序问题：多轮尝试，先执行能通过的，剩余命令后续重试
      let pending = base;
      let progressed = true;
      let rounds = 0;
      while (pending.length > 0 && progressed && rounds < 6) {
        progressed = false;
        const next: typeof pending = [];
        for (const item of pending) {
          const ok = api.evalCommand(item.cmd);
          if (ok) progressed = true;
          else next.push(item);
        }
        pending = next;
        rounds += 1;
      }

      if (pending.length > 0) {
        const first = pending[0];
        const errMsg = `第 ${first.index} 行命令执行失败：${first.cmd}`;
        if (onCommandFailed) {
          const repaired = await onCommandFailed(first.cmd, errMsg);
          if (repaired && repaired.length > 0) {
            // 只自动重试一轮，避免循环
            if (typeof api.reset === "function") api.reset();
            for (const item of repaired) {
              const cmd = item.trim();
              if (!cmd) continue;
              if (!cmd.includes("(") && !cmd.includes("=")) continue;
              if (/^note\s*:|^tips?\s*:|^the\s+/i.test(cmd)) continue;
              api.evalCommand(cmd);
            }
            return;
          }
        }
        setError(errMsg);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "命令执行失败");
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">
          内嵌 GeoGebra 预览（点击「应用命令」后自动作图）
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={runCommands}
          disabled={!ready || loading || commands.length === 0}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              加载中
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-1" />
              应用命令
            </>
          )}
        </Button>
      </div>

      <div className="w-full overflow-hidden rounded-lg border bg-background">
        <div ref={hostRef} className="w-full min-h-[520px]" />
      </div>

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}

