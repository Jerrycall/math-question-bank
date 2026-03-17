import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const UPLOAD_DIR = "public/uploads";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function safeFilename(originalName: string, mime: string): string {
  const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1] || "png";
  const base = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${base}.${ext}`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "请选择一张图片（字段名：file）" },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "图片大小不能超过 5MB" },
        { status: 400 }
      );
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "仅支持 JPG、PNG、GIF、WebP" },
        { status: 400 }
      );
    }

    const dir = join(process.cwd(), UPLOAD_DIR);
    await mkdir(dir, { recursive: true });
    const filename = safeFilename(file.name, file.type);
    const path = join(dir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path, buffer);

    const url = `/uploads/${filename}`;
    return NextResponse.json({ url });
  } catch (e) {
    console.error("Upload error:", e);
    return NextResponse.json(
      { error: "上传失败，请稍后重试" },
      { status: 500 }
    );
  }
}
