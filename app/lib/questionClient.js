import { normalizeQuestions } from "./quiz"

let cachedQuestionBank = null
let questionBankPromise = null

export async function loadQuestionBank({ refresh = false } = {}) {
  if (refresh) {
    cachedQuestionBank = null
    questionBankPromise = null
  }
  if (cachedQuestionBank) return cachedQuestionBank

  if (!questionBankPromise) {
    questionBankPromise = fetch("/questions")
      .then((response) => {
        if (!response.ok) throw new Error("题库读取失败")
        return response.json()
      })
      .then(normalizeQuestions)
  }

  try {
    cachedQuestionBank = await questionBankPromise
    return cachedQuestionBank
  } catch (error) {
    questionBankPromise = null
    throw error
  }
}
