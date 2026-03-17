import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <p className="mt-2 text-muted-foreground">页面不存在</p>
      <p className="mt-1 text-sm text-muted-foreground">
        请检查地址是否正确，或返回首页
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/">
          <Button className="gap-2">
            <Home className="h-4 w-4" />
            返回首页
          </Button>
        </Link>
        <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          上一页
        </Button>
      </div>
    </div>
  );
}
