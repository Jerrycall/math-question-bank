import { SM2Quality } from "@/types";

export interface SM2State {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
}

export interface SM2Result extends SM2State {
  nextDueDate: Date;
}

/**
 * SM-2 间隔复习算法
 * 
 * 评分标准 (0-5):
 * 5 - 完美回答，反应迅速
 * 4 - 正确回答，轻微犹豫
 * 3 - 正确回答，有明显困难
 * 2 - 错误，但记起后感觉很容易
 * 1 - 错误，正确答案看起来很熟悉
 * 0 - 完全不记得
 */
export function calculateSM2(
  quality: SM2Quality,
  current: SM2State
): SM2Result {
  let { intervalDays, easeFactor, repetitions } = current;

  if (quality >= 3) {
    // 回答正确
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
    repetitions += 1;
  } else {
    // 回答错误，重置
    repetitions = 0;
    intervalDays = 1;
  }

  // 更新易因子（最小值 1.3）
  easeFactor = Math.max(
    1.3,
    easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  );

  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + intervalDays);

  return { intervalDays, easeFactor, repetitions, nextDueDate };
}

export const DEFAULT_SM2_STATE: SM2State = {
  intervalDays: 1,
  easeFactor: 2.5,
  repetitions: 0,
};

/**
 * 将用户评分（正确/错误）转换为 SM2 质量分
 * 正确且快速 → 5，正确 → 4，正确但困难 → 3
 * 错误但熟悉 → 2，错误 → 1，完全不会 → 0
 */
export function isCorrectToQuality(
  isCorrect: boolean,
  timeSpentS: number,
  expectedTimeS = 120
): SM2Quality {
  if (!isCorrect) return 1;
  if (timeSpentS < expectedTimeS * 0.5) return 5;
  if (timeSpentS < expectedTimeS) return 4;
  return 3;
}
