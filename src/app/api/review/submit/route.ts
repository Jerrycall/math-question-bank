import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calculateSM2, DEFAULT_SM2_STATE } from "@/lib/spaced-repetition/sm2";
import { SM2Quality } from "@/types";

const DEFAULT_USER_ID = "user-default";

export async function POST(request: NextRequest) {
  const { scheduleId, questionId, quality, timeSpentS, isCorrect } =
    await request.json();
  const userId = DEFAULT_USER_ID;

  // 记录做题记录
  await db.learningRecord.create({
    data: {
      userId,
      questionId,
      isCorrect,
      timeSpentS,
    },
  });

  // 更新 SM-2 调度
  const existing = scheduleId
    ? await db.reviewSchedule.findUnique({ where: { id: scheduleId } })
    : await db.reviewSchedule.findUnique({
        where: { userId_questionId: { userId, questionId } },
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
        userId,
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
        where: { userId_tagId: { userId, tagId: tag.id } },
        create: {
          userId,
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
