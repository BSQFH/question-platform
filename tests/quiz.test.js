import test from "node:test"
import assert from "node:assert/strict"
import {
  buildRecord,
  calculateAccuracy,
  collectWrongQuestions,
  evaluateAnswer,
  filterQuestions,
  formatAnswer,
  formatDuration,
  matchesQuestionSearch,
  normalizeQuestion,
  normalizeQuestions,
  normalizeRecord,
  normalizeWrongQuestions,
  requiresManualGrading,
  sanitizeRecordPayload,
  shuffleItems
} from "../app/lib/quiz.js"
import {
  clearLocalRecords,
  getMasteredQuestionIds,
  markQuestionMastered,
  saveLocalRecord,
  unmarkQuestionMastered
} from "../app/lib/storage.js"
import { fallbackQuestions } from "../app/data/questions.js"

const question = {
  id: "q1",
  title: "示例",
  content: "正确答案是哪一项？",
  option_a: "答案 A",
  option_b: "答案 B",
  option_c: "答案 C",
  option_d: "答案 D",
  answer: " b ",
  analysis: "解析"
}

test("normalizes legacy question fields and answer casing", () => {
  assert.deepEqual(normalizeQuestion(question), {
    id: "q1",
    title: "示例",
    content: "正确答案是哪一项？",
    options: { A: "答案 A", B: "答案 B", C: "答案 C", D: "答案 D" },
    optionKeys: ["A", "B", "C", "D"],
    answer: "B",
    analysis: "解析",
    category: "综合知识",
    difficulty: "基础",
    type: "单选题"
  })
})

test("rejects incomplete questions", () => {
  assert.equal(normalizeQuestion({ content: "缺少选项", answer: "A" }), null)
})

test("supports two-option judgment questions", () => {
  const judgment = normalizeQuestion({
    content: "设备检修前应切断能源。",
    option_a: "正确",
    option_b: "错误",
    answer: "A"
  })

  assert.deepEqual(judgment.optionKeys, ["A", "B"])
  assert.equal(judgment.type, "判断题")
})

test("supports multiple-choice questions with up to six options", () => {
  const multiple = normalizeQuestion({
    content: "请选择全部正确选项",
    option_a: "选项 A",
    option_b: "选项 B",
    option_c: "选项 C",
    option_d: "选项 D",
    option_e: "选项 E",
    option_f: "选项 F",
    answer: "fca",
    type: "多选题"
  })

  assert.deepEqual(multiple.optionKeys, ["A", "B", "C", "D", "E", "F"])
  assert.equal(multiple.answer, "ACF")
  assert.equal(evaluateAnswer(multiple, "fca"), true)
  assert.equal(evaluateAnswer(multiple, "ac"), false)
  assert.match(formatAnswer(multiple, "AF"), /A\. 选项 A；F\. 选项 F/)
})

test("supports fill-in and short-answer normalization", () => {
  const fill = normalizeQuestion({
    content: "企业文化目标包含哪些词？",
    answer: "安全|舒适",
    type: "填空题"
  })
  const short = normalizeQuestion({
    content: "简述两个要点",
    answer: "答：检查供电；检查线路。",
    type: "简答题"
  })

  assert.deepEqual(fill.optionKeys, [])
  assert.equal(evaluateAnswer(fill, "安全，舒适"), true)
  assert.equal(requiresManualGrading(short), true)
  assert.equal(evaluateAnswer(short, "检查供电, 检查线路"), false)
  assert.equal(evaluateAnswer(short, "只检查供电"), false)
})

test("filters questions by category, difficulty and type", () => {
  const items = [
    { ...question, id: "a", category: "电气", difficulty: "基础", type: "单选题" },
    { ...question, id: "b", category: "安全", difficulty: "进阶", type: "单选题" },
    {
      id: "c",
      content: "判断题",
      option_a: "正确",
      option_b: "错误",
      answer: "A",
      category: "安全",
      difficulty: "基础",
      type: "判断题"
    }
  ]

  assert.deepEqual(
    filterQuestions(items, { category: "安全", difficulty: "基础", type: "判断题" }).map((item) => item.id),
    ["c"]
  )
})

test("searches question titles, content and options with normalized terms", () => {
  const items = [
    {
      ...question,
      id: "search-a",
      title: "ALPHA 巡检",
      content: "列车出库前应检查哪些项目？",
      option_a: "车门状态",
      option_b: "受电弓状态",
      analysis: "仅供内部复核",
      category: "车辆",
      difficulty: "基础"
    },
    {
      ...question,
      id: "search-b",
      title: "安全作业",
      content: "进入轨行区前需要确认什么？",
      option_a: "施工令",
      option_b: "照明状态",
      category: "安全",
      difficulty: "进阶"
    }
  ]

  assert.deepEqual(filterQuestions(items, { query: "列车 出库" }).map((item) => item.id), ["search-a"])
  assert.deepEqual(filterQuestions(items, { query: "ＡＬＰＨＡ" }).map((item) => item.id), ["search-a"])
  assert.deepEqual(filterQuestions(items, { query: "受电弓" }).map((item) => item.id), ["search-a"])
  assert.deepEqual(
    filterQuestions(items, { query: "轨行区", category: "安全", difficulty: "进阶", type: "单选题" }).map((item) => item.id),
    ["search-b"]
  )
})

test("question search excludes answers and analysis", () => {
  const normalized = normalizeQuestion({
    ...question,
    option_a: "车门状态",
    option_b: "受电弓状态",
    analysis: "绝密解析词"
  })

  assert.equal(matchesQuestionSearch(normalized, "受电弓"), true)
  assert.equal(matchesQuestionSearch(normalized, "绝密解析词"), false)
  assert.equal(matchesQuestionSearch(normalized, ""), true)

  const textQuestion = normalizeQuestion({
    content: "填写设备名称",
    answer: "答案独有关键词",
    analysis: "普通解析",
    type: "填空题"
  })
  assert.equal(matchesQuestionSearch(textQuestion, "答案独有关键词"), false)
})

test("the built-in bank contains valid single-choice and judgment questions", () => {
  const normalized = fallbackQuestions.map(normalizeQuestion).filter(Boolean)
  const available = normalizeQuestions(fallbackQuestions)
  const counts = normalized.reduce((result, item) => ({
    ...result,
    [item.type]: (result[item.type] ?? 0) + 1
  }), {})

  assert.equal(normalized.length, fallbackQuestions.length)
  assert.equal(normalized.length, 3410)
  assert.equal(available.length, 3397)
  assert.equal(available.some((item) => item.importStatus === "needs_review"), false)
  assert.equal(counts["单选题"], 721)
  assert.equal(counts["多选题"], 174)
  assert.equal(counts["判断题"], 899)
  assert.equal(counts["填空题"], 1369)
  assert.equal(counts["简答题"], 247)
  assert.equal(new Set(normalized.map((item) => item.id)).size, normalized.length)
  assert.equal(normalized.some((item) => item.type === "单选题"), true)
  assert.equal(normalized.some((item) => item.type === "判断题"), true)
})

test("accuracy is safe for empty and invalid totals", () => {
  assert.equal(calculateAccuracy(1, 0), 0)
  assert.equal(calculateAccuracy(7, 10), 70)
})

test("buildRecord stores full wrong-question context", () => {
  const normalized = normalizeQuestion(question)
  const record = buildRecord({
    questions: [normalized],
    answers: [{ question: normalized, selectedAnswer: "A", isCorrect: false }]
  })

  assert.equal(record.total, 1)
  assert.equal(record.correct, 0)
  assert.equal(record.accuracy, 0)
  assert.equal(record.wrong_questions[0].selectedAnswer, "A")
  assert.equal(record.wrong_questions[0].options.B, "答案 B")
  assert.equal(record.mode, "practice")
})

test("stores exam metadata and formats elapsed time", () => {
  const normalized = normalizeQuestion(question)
  const record = buildRecord({
    questions: [normalized],
    answers: [{ question: normalized, selectedAnswer: "B", isCorrect: true }],
    sessionType: "exam",
    durationSeconds: 125,
    settings: { query: "列车", type: "单选题", shuffled: false }
  })

  assert.equal(record.mode, "exam")
  assert.equal(record.duration_seconds, 125)
  assert.equal(record.settings.query, "列车")
  assert.equal(record.settings.shuffled, false)
  assert.equal(formatDuration(125), "02:05")
})

test("counts unanswered exam questions as wrong", () => {
  const normalized = normalizeQuestion(question)
  const record = buildRecord({ questions: [normalized], answers: [], sessionType: "exam" })

  assert.equal(record.correct, 0)
  assert.equal(record.wrong_questions.length, 1)
  assert.equal(record.wrong_questions[0].selectedAnswer, "")
})

test("normalizes null and serialized wrong-question collections", () => {
  assert.deepEqual(normalizeWrongQuestions(null), [])
  const serialized = JSON.stringify([{ ...question, selected_answer: "a" }])
  assert.equal(normalizeWrongQuestions(serialized)[0].selectedAnswer, "A")
})

test("deduplicates wrong questions and respects mastered ids", () => {
  const wrong = {
    id: "q1",
    title: "示例",
    content: "正确答案是哪一项？",
    answer: "B",
    analysis: "解析"
  }
  const records = [
    normalizeRecord({ id: "r1", total: 1, correct: 0, wrong_questions: [wrong] }),
    normalizeRecord({ id: "r2", total: 1, correct: 0, wrong_questions: [wrong] })
  ]

  assert.equal(collectWrongQuestions(records).length, 1)
  assert.equal(collectWrongQuestions(records)[0].count, 2)
  assert.equal(collectWrongQuestions(records, ["q1"]).length, 0)
})

test("keeps the newest answer when a wrong question repeats", () => {
  const base = {
    id: "q1",
    content: "重复错题",
    answer: "B",
    analysis: "解析"
  }
  const records = [
    normalizeRecord({ id: "old", total: 1, correct: 0, created_at: "2025-01-01T00:00:00Z", wrong_questions: [{ ...base, selectedAnswer: "A" }] }),
    normalizeRecord({ id: "new", total: 1, correct: 0, created_at: "2025-02-01T00:00:00Z", wrong_questions: [{ ...base, selectedAnswer: "C" }] })
  ]
  const [collected] = collectWrongQuestions(records)

  assert.equal(collected.selectedAnswer, "C")
  assert.equal(collected.lastWrongAt, "2025-02-01T00:00:00.000Z")
})

test("shuffle preserves all values", () => {
  const shuffled = shuffleItems([1, 2, 3], () => 0)
  assert.deepEqual([...shuffled].sort(), [1, 2, 3])
})

test("sanitizes record payloads and rejects inconsistent scores", () => {
  const wrong = [{
    id: "q1",
    content: "题目",
    answer: "B",
    selectedAnswer: "A"
  }]
  const sanitized = sanitizeRecordPayload({ total: 2, correct: 1, wrong_questions: wrong })

  assert.equal(sanitized.username, "本机用户")
  assert.equal(sanitized.accuracy, 50)
  assert.equal(sanitizeRecordPayload({ total: 0, correct: 0 }), null)
  assert.equal(sanitizeRecordPayload({ total: 1, correct: 1, wrong_questions: wrong }), null)
  assert.equal(sanitizeRecordPayload({ total: 2, correct: 1, wrong_questions: [] }), null)
})

test("a new mistake reopens a mastered question and clearing records resets mastery", () => {
  const values = new Map()
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value)
    }
  }

  try {
    const normalized = normalizeQuestion(question)
    const record = buildRecord({
      questions: [normalized],
      answers: [{ question: normalized, selectedAnswer: "A", isCorrect: false }]
    })

    markQuestionMastered("q1")
    assert.deepEqual(getMasteredQuestionIds(), ["q1"])
    assert.equal(unmarkQuestionMastered("q1"), true)
    assert.deepEqual(getMasteredQuestionIds(), [])

    markQuestionMastered("q1")
    assert.equal(saveLocalRecord(record), true)
    assert.deepEqual(getMasteredQuestionIds(), [])

    markQuestionMastered("q1")
    assert.equal(clearLocalRecords(), true)
    assert.deepEqual(getMasteredQuestionIds(), [])
  } finally {
    delete globalThis.window
  }
})

test("drops the oldest records when local storage reaches its quota", () => {
  const values = new Map()
  const quota = 1_200
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        if (value.length > quota) {
          const error = new Error("Quota exceeded")
          error.name = "QuotaExceededError"
          throw error
        }
        values.set(key, value)
      }
    }
  }

  try {
    const normalized = normalizeQuestion(question)
    for (let index = 0; index < 8; index += 1) {
      const record = buildRecord({
        questions: [normalized],
        answers: [{ question: normalized, selectedAnswer: "A", isCorrect: false }]
      })
      record.id = `record-${index}`
      assert.equal(saveLocalRecord(record), true)
    }

    const stored = JSON.parse(values.get("question-platform.records.v1"))
    assert.equal(stored[0].id, "record-7")
    assert.equal(stored.length < 8, true)
    assert.equal(values.get("question-platform.records.v1").length <= quota, true)
  } finally {
    delete globalThis.window
  }
})
