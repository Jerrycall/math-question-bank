import OpenAI from "openai";

/**
 * 对话/结构化等：支持 OpenAI 官方或任意 OpenAI 兼容网关（如 DeepSeek）。
 *
 * 环境变量：
 * - `AI_API_KEY`：优先用于对话（可与 OPENAI 分开，便于「对话 DeepSeek + 向量 OpenAI」）
 * - `OPENAI_API_KEY`：未设 AI_API_KEY 时用于对话；同时也是向量接口的默认 Key
 * - `AI_API_BASE_URL`：如 `https://api.deepseek.com`（不要末尾 /v1，SDK 会自动加）
 * - `AI_CHAT_MODEL`：如 `deepseek-chat`；不设且 base 含 deepseek 时默认为 deepseek-chat，否则 gpt-4o
 *
 * 向量（相似题）：
 * - `OPENAI_API_KEY` 或 `AI_EMBEDDING_API_KEY`（二选一即可）
 * - `AI_EMBEDDING_BASE_URL` / `AI_EMBEDDING_MODEL` 可选
 */
export function getChatClient(): OpenAI {
  const key =
    process.env.AI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "请配置 AI_API_KEY（如 DeepSeek）或 OPENAI_API_KEY。DeepSeek 示例：AI_API_BASE_URL=https://api.deepseek.com + AI_API_KEY=你的密钥。"
    );
  }
  const baseURL = process.env.AI_API_BASE_URL?.trim() || undefined;
  return new OpenAI({
    apiKey: key,
    ...(baseURL ? { baseURL } : {}),
  });
}

export function getChatModel(): string {
  const explicit = process.env.AI_CHAT_MODEL?.trim();
  if (explicit) return explicit;
  const base = (process.env.AI_API_BASE_URL ?? "").toLowerCase();
  if (base.includes("deepseek")) return "deepseek-chat";
  return "gpt-4o";
}

/**
 * 无可用配置时返回 null（相似题不可用）。
 * 若已设置 AI_API_BASE_URL（对话走 DeepSeek 等），则不会误用同一 OPENAI_API_KEY 去打 OpenAI 官方 embedding，
 * 此时请另设 AI_EMBEDDING_API_KEY（或仅对话用 AI_API_KEY、向量用 OPENAI_API_KEY）。
 */
export function getEmbeddingClient(): OpenAI | null {
  const embedKey = process.env.AI_EMBEDDING_API_KEY?.trim();
  const embedBase = process.env.AI_EMBEDDING_BASE_URL?.trim();
  if (embedKey) {
    return new OpenAI({
      apiKey: embedKey,
      ...(embedBase ? { baseURL: embedBase } : {}),
    });
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openaiKey) return null;

  const chatBase = process.env.AI_API_BASE_URL?.trim();
  const separateChatKey = Boolean(process.env.AI_API_KEY?.trim());

  if (chatBase) {
    if (separateChatKey) {
      return new OpenAI({ apiKey: openaiKey });
    }
    return null;
  }

  return new OpenAI({ apiKey: openaiKey });
}

export function getEmbeddingModel(): string {
  return process.env.AI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
}

/** @deprecated 请使用 getChatClient */
export function getOpenAI(): OpenAI {
  return getChatClient();
}
