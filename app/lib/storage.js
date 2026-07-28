import { normalizeRecords, questionFingerprint } from "./quiz.js"

const RECORDS_KEY = "question-platform.records.v1"
const MASTERED_KEY = "question-platform.mastered.v1"
const MAX_LOCAL_RECORDS = 200
const RECORDS_STORAGE_BUDGET = 3_000_000

function readArray(key) {
  if (typeof window === "undefined") return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeArray(key, value) {
  if (typeof window === "undefined") return false
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function fitRecordsToBudget(records) {
  const fitted = records.slice(0, MAX_LOCAL_RECORDS)
  while (fitted.length > 1 && JSON.stringify(fitted).length > RECORDS_STORAGE_BUDGET) {
    fitted.pop()
  }
  return fitted
}

function writeRecords(records) {
  let candidate = fitRecordsToBudget(records)

  while (candidate.length > 0) {
    if (writeArray(RECORDS_KEY, candidate)) return true
    if (candidate.length === 1) return false

    candidate = candidate.slice(0, Math.max(1, Math.floor(candidate.length * 0.75)))
  }

  return false
}

export function getLocalRecords() {
  return normalizeRecords(readArray(RECORDS_KEY))
}

export function saveLocalRecord(record) {
  const records = getLocalRecords()
  const saved = writeRecords([record, ...records])

  if (saved) {
    const wrongQuestionKeys = new Set(
      normalizeRecords([record])[0]?.wrong_questions
        .map(questionFingerprint)
        .filter(Boolean) ?? []
    )
    if (wrongQuestionKeys.size > 0) {
      writeArray(
        MASTERED_KEY,
        getMasteredQuestionIds().filter((id) => !wrongQuestionKeys.has(id))
      )
    }
  }

  return saved
}

export function clearLocalRecords() {
  const recordsCleared = writeArray(RECORDS_KEY, [])
  const masteredCleared = writeArray(MASTERED_KEY, [])
  return recordsCleared && masteredCleared
}

export function getMasteredQuestionIds() {
  return readArray(MASTERED_KEY).map(String)
}

export function markQuestionMastered(id) {
  const mastered = new Set(getMasteredQuestionIds())
  mastered.add(String(id))
  return writeArray(MASTERED_KEY, Array.from(mastered))
}

export function unmarkQuestionMastered(id) {
  return writeArray(
    MASTERED_KEY,
    getMasteredQuestionIds().filter((item) => item !== String(id))
  )
}
