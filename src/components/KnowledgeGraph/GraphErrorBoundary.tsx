"use client";

import React, { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
}

export class GraphErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(): void {
    // 可在此上报错误
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="h-[600px] rounded-xl border border-border bg-muted/40 flex items-center justify-center p-8">
          <div className="text-center max-w-sm space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-amber-500" />
            <p className="text-muted-foreground text-sm">
              图谱渲染时出错，可能是数据量较大或页面切换过快导致。
            </p>
            {this.props.onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  this.setState({ hasError: false });
                  this.props.onRetry?.();
                }}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                重试
              </Button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
