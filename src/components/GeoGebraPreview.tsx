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

export function GeoGebraPreview({ commands, className }: GeoGebraPreviewProps) {
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
            appName: "geometry",
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

  const runCommands = () => {
    setError("");
    try {
      const api = window[appletId] as
        | { evalCommand?: (cmd: string) => boolean; reset?: () => void }
        | undefined;
      if (!api?.evalCommand) {
        setError("GeoGebra 尚未就绪，请稍后再试。");
        return;
      }

      if (typeof api.reset === "function") api.reset();
      for (let i = 0; i < commands.length; i += 1) {
        const cmd = commands[i]?.trim();
        if (!cmd) continue;
        // 跳过明显不是 GeoGebra 命令的说明行，避免整批执行被弹窗打断
        if (!cmd.includes("(") && !cmd.includes("=")) continue;
        if (/^note\s*:|^tips?\s*:|^the\s+/i.test(cmd)) continue;
        const ok = api.evalCommand(cmd);
        if (!ok) {
          setError(`第 ${i + 1} 行命令执行失败：${cmd}`);
          break;
        }
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

