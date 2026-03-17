---
id: q-005
slug: q-005-geometric-sequence
title: 等比数列前n项和
difficulty: 3
source: 2024年高考模拟题
sourceYear: 2024
createdAt: 2026-03-17
tags:
  knowledge: [数列, 等比数列, 求和公式]
  method: [公式法, 错位相减法]
  thought: [转化思想]
related: [q-004-arithmetic-sequence, q-006-sequence-sum]
---

# 等比数列前n项和

## 题目

等比数列 $\{a_n\}$ 的公比 $q \neq 1$，已知 $a_1 = 2$，$a_1 + a_2 + a_3 = 14$，求数列 $\{a_n\}$ 的前 $n$ 项和 $S_n$。

## 答案

$S_n = 2(3^n - 1)$（当 $q = 3$）

## 解析

**第一步：** 利用已知条件求公比 $q$

$$a_1 + a_2 + a_3 = a_1(1 + q + q^2) = 2(1 + q + q^2) = 14$$

$$1 + q + q^2 = 7 \Rightarrow q^2 + q - 6 = 0$$

$$(q+3)(q-2) = 0 \Rightarrow q = -3 \text{ 或 } q = 2$$

**第二步：** 分情况讨论

**当 $q = 2$ 时：**

$$S_n = \frac{a_1(1-q^n)}{1-q} = \frac{2(1-2^n)}{1-2} = 2(2^n - 1)$$

**当 $q = -3$ 时：**

$$S_n = \frac{2(1-(-3)^n)}{1-(-3)} = \frac{2(1-(-3)^n)}{4} = \frac{1-(-3)^n}{2}$$

**第三步：** 结论

$$S_n = \begin{cases} 2(2^n - 1), & q = 2 \\ \dfrac{1-(-3)^n}{2}, & q = -3 \end{cases}$$

## 标签

- 知识点：数列、等比数列、求和公式
- 方法：公式法、错位相减法
- 思想：转化思想
- 来源：2024年高考模拟题

## 扩展

- 相关题目：[[q-004-arithmetic-sequence]]、[[q-006-sequence-sum]]
- 易错点：公比 $q$ 可能有两个解，需要分类讨论；$q=1$ 时公式不适用
- 变式方向：等比数列与等差数列混合题型
