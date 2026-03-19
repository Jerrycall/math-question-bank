import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateSM2, DEFAULT_SM2_STATE } from "@/lib/spaced-repetition/sm2";
import { SM2Quality } from "@/types";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

async function requireAccount(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function POST(request: NextRequest) {
  const accountId = await requireAccount(request);
  if (!accountId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { scheduleId, questionId, quality, timeSpentS, isCorrect } =
    await request.json();

  // 记录做题记录
  await db.learningRecord.create({
    data: {
      accountId,
      questionId,
      isCorrect,
      timeSpentS,
    },
  });

  // 更新 SM-2 调度
  const existing = scheduleId
    ? await db.reviewSchedule.findUnique({ where: { id: scheduleId } })
    : await db.reviewSchedule.findUnique({
        where: { accountId_questionId: { accountId, questionId } },
      });

  const currentState = existing
    ? {
        intervalDays: existing.intervalDays,
        easeFactor: existing.easeFactor,
        repetitions: existing.repetitions,
      }
    : DEFAULT_SM2_STATE;

  const result = calculateSM2(quality as SM2Quality, currentState);

  if (existing) {
    await db.reviewSchedule.update({
      where: { id: existing.id },
      data: {
        dueDate: result.nextDueDate,
        intervalDays: result.intervalDays,
        easeFactor: result.easeFactor,
        repetitions: result.repetitions,
        lastReviewAt: new Date(),
      },
    });
  } else {
    await db.reviewSchedule.create({
      data: {
        accountId,
        questionId,
        dueDate: result.nextDueDate,
        intervalDays: result.intervalDays,
        easeFactor: result.easeFactor,
        repetitions: result.repetitions,
        lastReviewAt: new Date(),
      },
    });
  }

  // 更新知识点掌握度
  const question = await db.question.findUnique({
    where: { id: questionId },
    include: {
      tags: {
        where: { tag: { type: "KNOWLEDGE" } },
        include: { tag: true },
      },
    },
  });

  if (question) {
    for (const { tag } of question.tags) {
      const mastery = await db.knowledgeMastery.upsert({
        where: { accountId_tagId: { accountId, tagId: tag.id } },
        create: {
          accountId,
          tagId: tag.id,
          masteryScore: isCorrect ? 20 : 0,
          totalAttempts: 1,
          correctAttempts: isCorrect ? 1 : 0,
        },
        update: {
          totalAttempts: { increment: 1 },
          correctAttempts: isCorrect ? { increment: 1 } : undefined,
        },
      });

      // 重新计算掌握度分数
      const score = Math.round(
        (mastery.correctAttempts / mastery.totalAttempts) * 100
      );
      await db.knowledgeMastery.update({
        where: { id: mastery.id },
        data: { masteryScore: score },
      });
    }
  }

  return NextResponse.json({ ok: true, nextDue: result.nextDueDate });
}
