import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { MathRenderer } from "@/components/QuestionCard/MathRenderer";
import { DIFFICULTY_LABELS, type Difficulty } from "@/types";
import { PrintButton } from "./PrintButton";
import styles from "./print.module.css";
import { cn } from "@/lib/utils";
import { marked } from "marked";

export const dynamic = "force-dynamic";
type PrintRow = {
  id: string;
  slug: string;
  title: string;
  content: string;
  answer: string;
  analysis: string;
  difficulty: string;
  source: string | null;
  pageBreakBefore: boolean;
};

function decodeBase64Utf8(value?: string): string {
  if (!value) return "";
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function isHtmlLike(s: string): boolean {
  return /<\/?(p|h[1-6]|ul|ol|li|strong|em|blockquote|pre|code|div|span|table|thead|tbody|tr|th|td|img|a|br|hr)(\s[^>]*)?>/i.test(
    s
  );
}

function toIntroHtml(raw: string): string {
  const src = (raw || "").trim();
  if (!src) return "";
  if (isHtmlLike(src)) return src;
  return marked.parse(src) as string;
}

/** 浏览器「另存为 PDF」默认文件名通常取自 document.title，需去掉文件名非法字符 */
function titleForPdfFilename(name: string): string {
  const trimmed = name.trim() || "题集";
  return trimmed.replace(/[/\\:*?"<>|#\n\r\t]/g, "_").slice(0, 120);
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const accountId = token ? verifySession(token) : null;
  if (!accountId) {
    return { title: "题集讲义" };
  }

  const collection = await db.collection.findFirst({
    where: { id: params.id, accountId },
    select: { name: true },
  });

  const title = collection?.name
    ? titleForPdfFilename(collection.name)
    : "题集讲义";

  return { title };
}

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: {
    showAnswers?: string;
    answerSpace?: string;
    introType?: string;
    introTitleB64?: string;
    introContentB64?: string;
  };
}) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return notFound();

  const accountId = verifySession(token);
  if (!accountId) return notFound();

  const collectionId = params.id;
  const showAnswers = (searchParams?.showAnswers ?? "0") === "1";
  const showAnswerSpace = (searchParams?.answerSpace ?? "1") !== "0";
  const introTypeRaw = (searchParams?.introType ?? "").toUpperCase();
  const introTypeFromQuery =
    introTypeRaw === "METHOD" || introTypeRaw === "KNOWLEDGE" ? introTypeRaw : "";
  const introTitleFromQuery = decodeBase64Utf8(searchParams?.introTitleB64);
  const introContentFromQuery = decodeBase64Utf8(searchParams?.introContentB64);

  const collection = await db.collection.findUnique({
    where: { id: collectionId },
    select: {
      id: true,
      name: true,
      accountId: true,
      introType: true,
      introTitle: true,
      introContent: true,
      questions: {
        orderBy: { sortOrder: "asc" },
        include: {
          question: {
            select: {
              id: true,
              slug: true,
              title: true,
              content: true,
              answer: true,
              analysis: true,
              difficulty: true,
              source: true,
            },
          },
        },
      },
    },
  });

  if (!collection || collection.accountId !== accountId) return notFound();

  const introTypeSaved =
    collection.introType === "METHOD" || collection.introType === "KNOWLEDGE"
      ? collection.introType
      : "";
  const introType = introTypeFromQuery || introTypeSaved;
  const introTitle =
    (introTitleFromQuery || collection.introTitle || "").trim() || "导学";
  const introContent = (introContentFromQuery || collection.introContent || "").trim();
  const introHtml = toIntroHtml(introContent);

  const rows: PrintRow[] = collection.questions.map((cq) => ({
    pageBreakBefore: cq.pageBreakBefore,
    ...cq.question,
  }));

  return (
    <div className={styles.page}>
      <div className={styles.printButton}>
        <PrintButton />
      </div>

      <header className={styles.docHeader}>
        <h1 className={styles.docTitle}>{collection.name}</h1>
        <div className={styles.docSubtitle}>
          <span className={styles.docBadge}>题集讲义</span>
          <span className={showAnswers ? styles.docBadgeStrong : styles.docBadge}>
            {showAnswers ? "题目 + 答案 + 解析" : "仅题目（无答案）"}
          </span>
          <span>共 {rows.length} 题</span>
          {showAnswerSpace ? (
            <span className={styles.docBadge}>含手写答题区</span>
          ) : null}
          {introContent.trim() ? (
            <span className={styles.docBadge}>
              含导学前言{introType ? `（${introType === "KNOWLEDGE" ? "知识点" : "方法"}）` : ""}
            </span>
          ) : null}
        </div>
      </header>

      {introHtml ? (
        <section className={styles.introSection}>
          <h2 className={styles.introTitle}>{introTitle}</h2>
          <div className={styles.introBody} dangerouslySetInnerHTML={{ __html: introHtml }} />
        </section>
      ) : null}

      <div className={styles.qList}>
        {rows.map((q, idx) => {
          const diffLabel =
            DIFFICULTY_LABELS[q.difficulty as Difficulty] ?? String(q.difficulty);
          const forcePageBreak = q.pageBreakBefore && idx > 0;
          return (
            <article
              key={q.id}
              className={cn(styles.qBlock, forcePageBreak && styles.pageBreakBefore)}
            >
              <div className={styles.qHead}>
                <div className={styles.qNum} aria-hidden>
                  {idx + 1}
                </div>
                <div className={styles.qHeadText}>
                  <h2 className={styles.qTitle}>{q.title}</h2>
                  <div className={styles.qMeta}>
                    <span>难度：{diffLabel}</span>
                    {q.source ? <span>来源：{q.source}</span> : null}
                  </div>
                </div>
              </div>

              <div className={styles.qStem}>
                <MathRenderer content={q.content} />
              </div>

              {showAnswers && (
                <>
                  <div className={styles.answerBox}>
                    <div className={styles.boxLabel}>标准答案</div>
                    <div className={styles.boxBody}>
                      <MathRenderer content={q.answer} />
                    </div>
                  </div>

                  <div className={styles.analysisBox}>
                    <div className={styles.boxLabel}>详细解析</div>
                    <div className={styles.boxBody}>
                      <MathRenderer content={q.analysis || "（暂无解析）"} />
                    </div>
                  </div>
                </>
              )}

              {showAnswerSpace && (
                <div className={styles.answerRegion}>
                  <div className={styles.answerRegionLabel}>答题区（手写）</div>
                  <div className={styles.answerLines} aria-hidden />
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
