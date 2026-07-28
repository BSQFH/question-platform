export const ANSWER_KEYS = ["A", "B", "C", "D", "E", "F"]
export const CHOICE_TYPES = ["单选题", "多选题", "判断题"]
export const TEXT_TYPES = ["填空题", "简答题"]

export function normalizeAnswer(value) {
  const answer = String(value ?? "").trim().toUpperCase()
  return ANSWER_KEYS.includes(answer) ? answer : ""
}

export function normalizeChoiceAnswers(value) {
  const supplied = new Set(String(value ?? "").toUpperCase())
  return ANSWER_KEYS.filter((key) => supplied.has(key)).join("")
}

export function normalizeTextAnswer(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim()
}

function normalizeQuestionType(value, optionKeys, rawAnswer) {
  const type = String(value ?? "").trim()
  if ([...CHOICE_TYPES, ...TEXT_TYPES].includes(type)) return type
  if (optionKeys.length < 2) return "单选题"
  if (normalizeChoiceAnswers(rawAnswer).length > 1) return "多选题"
  return optionKeys.length === 2 ? "判断题" : "单选题"
}

export function isChoiceQuestion(question) {
  return CHOICE_TYPES.includes(question?.type)
}

export function isMultipleChoiceQuestion(question) {
  return question?.type === "多选题"
}

export function requiresManualGrading(question) {
  return question?.type === "简答题"
}

export function normalizeResponse(question, value) {
  if (!isChoiceQuestion(question)) return normalizeTextAnswer(value)
  if (isMultipleChoiceQuestion(question)) return normalizeChoiceAnswers(value)
  return normalizeAnswer(value)
}

function comparableText(value) {
  return normalizeTextAnswer(value)
    .normalize("NFKC")
    .replace(/^答[：:]\s*/, "")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\s,，、;；|。．.]/g, "")
}

export function evaluateAnswer(question, value) {
  if (requiresManualGrading(question)) return false
  const response = normalizeResponse(question, value)
  if (!response) return false
  if (isChoiceQuestion(question)) {
    return response === normalizeResponse(question, question.answer)
  }
  return comparableText(response) === comparableText(question.answer)
}

export function formatAnswer(question, value) {
  const answer = normalizeResponse(question, value)
  if (!answer || !isChoiceQuestion(question)) return answer
  return answer
    .split("")
    .map((key) => question.options?.[key] ? `${key}. ${question.options[key]}` : key)
    .join("；")
}

export function normalizeQuestion(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null

  const options = raw.options && typeof raw.options === "object"
    ? raw.options
    : {
        A: raw.option_a,
        B: raw.option_b,
        C: raw.option_c,
        D: raw.option_d,
        E: raw.option_e,
        F: raw.option_f
      }

  const normalizedOptions = Object.fromEntries(
    ANSWER_KEYS.map((key) => [
      key,
      String(options[key] ?? options[key.toLowerCase()] ?? "").trim()
    ]).filter(([, value]) => value)
  )
  const optionKeys = ANSWER_KEYS.filter((key) => normalizedOptions[key])
  const content = String(raw.content ?? raw.question ?? "").trim()
  const type = normalizeQuestionType(
    raw.type ?? raw.question_type,
    optionKeys,
    raw.answer
  )
  const answer = normalizeResponse({ type }, raw.answer)
  const hasValidChoiceAnswer = !isChoiceQuestion({ type }) || (
    optionKeys.length >= 2 &&
    answer.length >= 1 &&
    answer.split("").every((key) => optionKeys.includes(key)) &&
    (type === "多选题" || answer.length === 1)
  )

  if (!content || !answer || !hasValidChoiceAnswer) return null

  const normalized = {
    id: String(raw.id ?? `question-${index + 1}`),
    title: String(raw.title ?? `第 ${index + 1} 题`).trim(),
    content,
    options: normalizedOptions,
    optionKeys,
    answer,
    analysis: String(raw.analysis ?? "暂无解析").trim(),
    category: String(raw.category ?? "综合知识").trim(),
    difficulty: String(raw.difficulty ?? "基础").trim(),
    type
  }
  if (raw.source) normalized.source = String(raw.source).trim()
  if (raw.source_no ?? raw.sourceNo) {
    normalized.sourceNo = String(raw.source_no ?? raw.sourceNo).trim()
  }
  if (raw.grading_mode ?? raw.gradingMode) {
    normalized.gradingMode = String(raw.grading_mode ?? raw.gradingMode)
  }
  if (raw.import_status ?? raw.importStatus) {
    normalized.importStatus = String(raw.import_status ?? raw.importStatus)
  }
  if (raw.review_note ?? raw.reviewNote) {
    normalized.reviewNote = String(raw.review_note ?? raw.reviewNote).trim()
  }
  return normalized
}

export function normalizeQuestions(input, options = {}) {
  if (!Array.isArray(input)) return []
  const includeNeedsReview = options.includeNeedsReview === true
  return input
    .map(normalizeQuestion)
    .filter(Boolean)
    .filter((question) => includeNeedsReview || question.importStatus !== "needs_review")
}

export function filterQuestions(input, filters = {}) {
  const category = String(filters.category ?? "all")
  const difficulty = String(filters.difficulty ?? "all")
  const type = String(filters.type ?? "all")

  return normalizeQuestions(input).filter((question) => (
    (category === "all" || question.category === category) &&
    (difficulty === "all" || question.difficulty === difficulty) &&
    (type === "all" || question.type === type)
  ))
}

export function shuffleItems(items, random = Math.random) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

export function calculateAccuracy(correct, total) {
  if (!Number.isFinite(total) || total <= 0) return 0
  return Math.round((Math.max(0, Number(correct) || 0) / total) * 100)
}

export function questionFingerprint(question) {
  if (!question || typeof question !== "object") return ""
  return String(question.id ?? `${question.title ?? ""}|${question.content ?? ""}`)
}

export function buildRecord({
  questions,
  answers,
  startedAt,
  sessionType = "practice",
  source = "all",
  settings = {},
  durationSeconds
}) {
  const normalizedAnswers = Array.isArray(answers) ? answers : []
  const safeQuestions = Array.isArray(questions) ? questions : []
  const answersByQuestion = new Map(
    normalizedAnswers
      .filter((item) => item?.question)
      .map((item) => [questionFingerprint(item.question), item])
  )
  const completedAnswers = safeQuestions.map((question) => (
    answersByQuestion.get(questionFingerprint(question)) ?? {
      question,
      selectedAnswer: "",
      isCorrect: false
    }
  ))
  const correct = completedAnswers.filter((item) => item.isCorrect).length
  const wrongQuestions = completedAnswers
    .filter((item) => !item.isCorrect)
    .map((item) => ({
      id: item.question.id,
      title: item.question.title,
      content: item.question.content,
      options: item.question.options,
      optionKeys: item.question.optionKeys,
      answer: item.question.answer,
      selectedAnswer: normalizeResponse(item.question, item.selectedAnswer),
      analysis: item.question.analysis,
      category: item.question.category,
      difficulty: item.question.difficulty,
      type: item.question.type,
      source: item.question.source
    }))
  const createdAt = new Date().toISOString()
  const safeDuration = Number.isFinite(Number(durationSeconds))
    ? Math.max(0, Math.round(Number(durationSeconds)))
    : Math.max(0, Math.round((new Date(createdAt) - new Date(startedAt || createdAt)) / 1000))

  return {
    id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    username: "本机用户",
    total: safeQuestions.length,
    correct,
    accuracy: calculateAccuracy(correct, safeQuestions.length),
    wrong_questions: wrongQuestions,
    mode: sessionType === "exam" ? "exam" : "practice",
    source: source === "wrong" ? "wrong" : "all",
    settings: {
      category: String(settings.category ?? "all"),
      difficulty: String(settings.difficulty ?? "all"),
      type: String(settings.type ?? "all"),
      shuffled: settings.shuffled !== false
    },
    duration_seconds: safeDuration,
    started_at: startedAt || createdAt,
    created_at: createdAt
  }
}

export function normalizeWrongQuestions(value) {
  let entries = value
  if (typeof entries === "string") {
    try {
      entries = JSON.parse(entries)
    } catch {
      return []
    }
  }
  if (!Array.isArray(entries)) return []

  return entries
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const options = item.options && typeof item.options === "object" ? item.options : {}
      const optionKeys = Array.isArray(item.optionKeys)
        ? item.optionKeys.filter((key) => ANSWER_KEYS.includes(key))
        : ANSWER_KEYS.filter((key) => options[key])
      const type = normalizeQuestionType(
        item.type ?? item.question_type,
        optionKeys,
        item.answer
      )
      const question = { type, options, optionKeys }

      return {
        id: String(item.id ?? `${item.title ?? "wrong"}-${index}`),
        title: String(item.title ?? "错题").trim(),
        content: String(item.content ?? "").trim(),
        options,
        optionKeys,
        answer: normalizeResponse(question, item.answer),
        selectedAnswer: normalizeResponse(
          question,
          item.selectedAnswer ?? item.selected_answer
        ),
        analysis: String(item.analysis ?? "暂无解析").trim(),
        category: String(item.category ?? "综合知识").trim(),
        difficulty: String(item.difficulty ?? "基础").trim(),
        type,
        source: String(item.source ?? item.category ?? "内置题库").trim()
      }
    })
    .filter((item) => item.content)
}

export function normalizeRecord(raw, index = 0) {
  if (!raw || typeof raw !== "object") return null
  const total = Math.max(0, Number(raw.total) || 0)
  const correct = Math.min(total, Math.max(0, Number(raw.correct) || 0))
  const createdAt = raw.created_at ? new Date(raw.created_at) : new Date()

  return {
    id: String(raw.id ?? `record-${index}-${createdAt.getTime()}`),
    username: String(raw.username ?? "本机用户"),
    total,
    correct,
    accuracy: Number.isFinite(Number(raw.accuracy))
      ? Math.max(0, Math.min(100, Math.round(Number(raw.accuracy))))
      : calculateAccuracy(correct, total),
    wrong_questions: normalizeWrongQuestions(raw.wrong_questions),
    mode: raw.mode === "exam" ? "exam" : "practice",
    source: raw.source === "wrong" ? "wrong" : "all",
    settings: raw.settings && typeof raw.settings === "object" ? raw.settings : {},
    duration_seconds: Math.max(0, Number(raw.duration_seconds) || 0),
    created_at: Number.isNaN(createdAt.getTime())
      ? new Date().toISOString()
      : createdAt.toISOString()
  }
}

export function normalizeRecords(input) {
  if (!Array.isArray(input)) return []
  return input.map(normalizeRecord).filter(Boolean)
}

export function sanitizeRecordPayload(body) {
  if (!body || typeof body !== "object") return null
  const total = Number(body.total)
  if (!Number.isInteger(total) || total < 1 || total > 200) return null

  const wrongQuestions = normalizeWrongQuestions(body.wrong_questions).slice(0, total)
  const submittedCorrect = Number(body.correct)
  const correct = Number.isInteger(submittedCorrect)
    ? Math.max(0, Math.min(total, submittedCorrect))
    : total - wrongQuestions.length

  if (correct + wrongQuestions.length !== total) return null

  return {
    username: "本机用户",
    total,
    correct,
    accuracy: calculateAccuracy(correct, total),
    wrong_questions: wrongQuestions
  }
}

export function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0))
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
}

export function summarizeRecords(records) {
  const safeRecords = normalizeRecords(records)
  const totalAnswered = safeRecords.reduce((sum, item) => sum + item.total, 0)
  const totalCorrect = safeRecords.reduce((sum, item) => sum + item.correct, 0)
  const bestAccuracy = safeRecords.reduce((best, item) => Math.max(best, item.accuracy), 0)

  return {
    sessions: safeRecords.length,
    totalAnswered,
    accuracy: calculateAccuracy(totalCorrect, totalAnswered),
    bestAccuracy
  }
}

export function collectWrongQuestions(records, masteredIds = []) {
  const mastered = new Set(masteredIds.map(String))
  const collected = new Map()

  normalizeRecords(records).forEach((record) => {
    record.wrong_questions.forEach((question) => {
      const key = questionFingerprint(question)
      if (!key || mastered.has(key)) return
      const current = collected.get(key)
      const isNewer = !current || new Date(record.created_at) > new Date(current.lastWrongAt)
      collected.set(key, {
        ...(isNewer ? question : current),
        key,
        count: (current?.count ?? 0) + 1,
        lastWrongAt: isNewer ? record.created_at : current.lastWrongAt
      })
    })
  })

  return Array.from(collected.values()).sort(
    (left, right) => new Date(right.lastWrongAt) - new Date(left.lastWrongAt)
  )
}
