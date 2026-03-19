import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { MathRenderer } from "@/components/QuestionCard/MathRenderer";
import { PrintButton } from "./PrintButton";
import styles from "./print.module.css";

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { showAnswers?: string };
}) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return notFound();

  const accountId = verifySession(token);
  if (!accountId) return notFound();

  const collectionId = params.id;
  const showAnswers = (searchParams?.showAnswers ?? "0") === "1";

  const collection = await db.collection.findUnique({
    where: { id: collectionId },
    select: {
      id: true,
      name: true,
      accountId: true,
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

  const questions = collection.questions.map((cq) => cq.question);

  return (
    <div className={styles.page}>
      <div className={styles.printButton}>
        <PrintButton />
      </div>

      <div className={styles.title}>
        {collection.name} 题集讲义
      </div>
      <div className={styles.meta}>
        {showAnswers ? "含答案与解析" : "只含题目"} · 共 {questions.length} 道题
      </div>

      <div className="space-y-6">
        {questions.map((q, idx) => (
          <div key={q.id} className={styles.question}>
            <div className={styles.questionHead}>
              {idx + 1}. {q.title}
            </div>

            <MathRenderer content={q.content} />

            {showAnswers && (
              <>
                <div className={styles.divider} />
                <div className={styles.questionHead}>标准答案</div>
                <MathRenderer content={q.answer} />

                <div className={styles.divider} />
                <div className={styles.questionHead}>详细解析</div>
                <MathRenderer content={q.analysis} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

