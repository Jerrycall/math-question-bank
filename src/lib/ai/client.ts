import OpenAI from "openai";

/**
 * 延迟获取 OpenAI 客户端，仅在调用时且 OPENAI_API_KEY 存在时创建。
 * 构建阶段不会实例化，避免 Vercel 等环境未配置 key 时 build 失败。
 */
export function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) {
    throw new Error(
      "OPENAI_API_KEY 未配置。请在 .env.local 或 Vercel 环境变量中配置；不配置则 AI 功能不可用。"
    );
  }
  return new OpenAI({ apiKey: key });
}
