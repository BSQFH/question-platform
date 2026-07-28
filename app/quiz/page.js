"use client"

import Link from "next/link"
import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  ANSWER_KEYS,
  buildRecord,
  collectWrongQuestions,
  evaluateAnswer,
  filterQuestions,
  formatAnswer,
  formatDuration,
  isChoiceQuestion,
  isMultipleChoiceQuestion,
  normalizeQuestion,
  normalizeQuestions,
  normalizeResponse,
  questionFingerprint,
  requiresManualGrading,
  shuffleItems
} from "../lib/quiz"
import {
  getLocalRecords,
  getMasteredQuestionIds,
  saveLocalRecord
} from "../lib/storage"

function LoadingState() {
  return (
    <main className="page narrow quiz-page">
      <section className="panel status-panel" aria-live="polite">
        <h1>正在准备题目</h1>
        <p>正在按照你的设置组卷</p>
        <div className="loading-bar" aria-hidden="true" />
      </section>
    </main>
  )
}

function QuizContent() {
  const searchParams = useSearchParams()
  const sessionType = searchParams.get("session") === "exam" ? "exam" : "practice"
  const sourceMode = searchParams.get("mode") === "wrong" ? "wrong" : "normal"
  const countParam = searchParams.get("count") || "10"
  const shouldShuffle = searchParams.get("shuffle") !== "0"
  const category = searchParams.get("category") || "all"
  const difficulty = searchParams.get("difficulty") || "all"
  const questionType = searchParams.get("type") || "all"
  const minutes = Math.max(0, Math.min(180, Number.parseInt(searchParams.get("minutes"), 10) || 0))
  const timeLimitSeconds = sessionType === "exam" ? minutes * 60 : 0

  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [responses, setResponses] = useState({})
  const [answered, setAnswered] = useState(false)
  const [status, setStatus] = useState("loading")
  const [error, setError] = useState("")
  const [result, setResult] = useState(null)
  const [saveMessage, setSaveMessage] = useState("")
  const [reloadToken, setReloadToken] = useState(0)
  const [secondsRemaining, setSecondsRemaining] = useState(timeLimitSeconds)
  const [submitWarning, setSubmitWarning] = useState(false)
  const [finishReason, setFinishReason] = useState("manual")
  const [manualGrades, setManualGrades] = useState({})
  const startedAt = useRef(new Date().toISOString())
  const finishing = useRef(false)
  const responsesRef = useRef({})
  const manualGradesRef = useRef({})
  const submitWarningRef = useRef(null)
  const isExam = sessionType === "exam"

  useEffect(() => {
    responsesRef.current = responses
  }, [responses])

  useEffect(() => {
    manualGradesRef.current = manualGrades
  }, [manualGrades])

  useEffect(() => {
    if (!submitWarning || !submitWarningRef.current) return
    const warning = submitWarningRef.current
    warning.focus({ preventScroll: true })
    warning.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center"
    })
  }, [submitWarning])

  useEffect(() => {
    const controller = new AbortController()

    async function loadQuestions() {
      setStatus("loading")
      setError("")

      try {
        const response = await fetch("/questions", {
          cache: "no-store",
          signal: controller.signal
        })
        if (!response.ok) throw new Error("题库读取失败")

        const payload = await response.json()
        let available = normalizeQuestions(payload)

        if (sourceMode === "wrong") {
          const wrongItems = collectWrongQuestions(
            getLocalRecords(),
            getMasteredQuestionIds()
          )
          const wrongKeys = new Set(wrongItems.flatMap((item) => [item.id, item.key]))
          const matched = available.filter((question) => (
            wrongKeys.has(question.id) || wrongKeys.has(questionFingerprint(question))
          ))
          const embedded = wrongItems
            .map((item, itemIndex) => normalizeQuestion(item, itemIndex))
            .filter(Boolean)
            .filter((item) => !matched.some((question) => question.id === item.id))
          available = [...matched, ...embedded]
        }

        if (isExam) {
          available = available.filter((question) => !requiresManualGrading(question))
        }

        available = filterQuestions(available, {
          category,
          difficulty,
          type: questionType
        })
        if (shouldShuffle) available = shuffleItems(available)

        const requestedCount = countParam === "all"
          ? available.length
          : Math.max(1, Math.min(200, Number.parseInt(countParam, 10) || 10))
        available = available.slice(0, requestedCount)

        setQuestions(available)
        setIndex(0)
        setResponses({})
        responsesRef.current = {}
        setManualGrades({})
        manualGradesRef.current = {}
        setAnswered(false)
        setResult(null)
        setSubmitWarning(false)
        setSecondsRemaining(timeLimitSeconds)
        finishing.current = false
        startedAt.current = new Date().toISOString()
        setStatus(available.length ? "ready" : "empty")
      } catch (loadError) {
        if (loadError.name === "AbortError") return
        setError("暂时无法读取题库，请重试。")
        setStatus("error")
      }
    }

    loadQuestions()
    return () => controller.abort()
  }, [
    category,
    countParam,
    difficulty,
    questionType,
    reloadToken,
    shouldShuffle,
    sourceMode,
    timeLimitSeconds,
    isExam
  ])

  useEffect(() => {
    if (!isExam || status !== "ready" || timeLimitSeconds <= 0) return undefined
    const timer = window.setInterval(() => {
      setSecondsRemaining((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [isExam, status, timeLimitSeconds])

  useEffect(() => {
    if (isExam && status === "ready" && timeLimitSeconds > 0 && secondsRemaining === 0) {
      finishQuiz(responsesRef.current, "timeout")
    }
  }, [isExam, secondsRemaining, status, timeLimitSeconds])

  const currentQuestion = questions[index]
  const selectedAnswer = currentQuestion ? responses[currentQuestion.id] ?? "" : ""
  const answeredCount = questions.reduce(
    (count, question) => count + (String(responses[question.id] ?? "").trim() ? 1 : 0),
    0
  )
  const unansweredCount = Math.max(0, questions.length - answeredCount)

  const chooseAnswer = useCallback((answer) => {
    if (!currentQuestion || (!isExam && answered)) return
    const optionKeys = currentQuestion.optionKeys?.length
      ? currentQuestion.optionKeys
      : ANSWER_KEYS.filter((key) => currentQuestion.options[key])
    if (!optionKeys.includes(answer)) return
    setResponses((current) => {
      const selected = String(current[currentQuestion.id] ?? "")
      const nextAnswer = isMultipleChoiceQuestion(currentQuestion)
        ? normalizeResponse(
            currentQuestion,
            selected.includes(answer)
              ? selected.replace(answer, "")
              : `${selected}${answer}`
          )
        : answer
      return { ...current, [currentQuestion.id]: nextAnswer }
    })
    setSubmitWarning(false)
  }, [answered, currentQuestion, isExam])

  const enterTextAnswer = useCallback((value) => {
    if (!currentQuestion || isChoiceQuestion(currentQuestion) || (!isExam && answered)) return
    setResponses((current) => ({
      ...current,
      [currentQuestion.id]: value.slice(0, 4000)
    }))
    setSubmitWarning(false)
  }, [answered, currentQuestion, isExam])

  useEffect(() => {
    function handleKeyDown(event) {
      if (status !== "ready") return
      if (["INPUT", "TEXTAREA"].includes(event.target?.tagName)) {
        const submitFill = currentQuestion?.type === "填空题" && event.key === "Enter"
        const submitShort = currentQuestion?.type === "简答题" && event.key === "Enter" && (event.ctrlKey || event.metaKey)
        if (!isExam && !answered && String(selectedAnswer).trim() && (submitFill || submitShort)) {
          event.preventDefault()
          document.querySelector("[data-submit-answer]")?.click()
        }
        return
      }
      const optionKeys = currentQuestion?.optionKeys ?? ANSWER_KEYS
      const number = Number.parseInt(event.key, 10)
      if (isChoiceQuestion(currentQuestion) && number >= 1 && number <= optionKeys.length) {
        chooseAnswer(optionKeys[number - 1])
      }
      if (isChoiceQuestion(currentQuestion) && !isExam && event.key === "Enter" && selectedAnswer && !answered) {
        document.querySelector("[data-submit-answer]")?.click()
      }
      if (isExam && event.key === "ArrowLeft") moveExam(-1)
      if (isExam && event.key === "ArrowRight") moveExam(1)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [answered, chooseAnswer, currentQuestion, isExam, selectedAnswer, status])

  function submitAnswer() {
    if (!currentQuestion || !String(selectedAnswer).trim() || answered) return
    setAnswered(true)
  }

  function gradeManualAnswer(value) {
    if (!currentQuestion || !requiresManualGrading(currentQuestion) || !answered) return
    const nextGrades = { ...manualGradesRef.current, [currentQuestion.id]: value }
    manualGradesRef.current = nextGrades
    setManualGrades(nextGrades)
  }

  function goForward() {
    if (!answered) return
    if (requiresManualGrading(currentQuestion) && manualGradesRef.current[currentQuestion.id] == null) return
    if (index + 1 >= questions.length) {
      finishQuiz(responsesRef.current)
      return
    }
    setIndex((value) => value + 1)
    setAnswered(false)
  }

  function moveExam(offset) {
    if (!isExam) return
    setIndex((value) => Math.max(0, Math.min(questions.length - 1, value + offset)))
    setSubmitWarning(false)
  }

  function jumpToQuestion(targetIndex) {
    if (!isExam || targetIndex < 0 || targetIndex >= questions.length) return
    setIndex(targetIndex)
    setSubmitWarning(false)
  }

  function requestExamFinish() {
    if (unansweredCount > 0) {
      setSubmitWarning(true)
      return
    }
    finishQuiz(responsesRef.current)
  }

  function restartQuiz() {
    setReloadToken((value) => value + 1)
  }

  async function finishQuiz(responseMap, reason = "manual") {
    if (finishing.current || !questions.length) return
    finishing.current = true

    const finalAnswers = questions.map((question) => {
      const answer = responseMap[question.id] ?? ""
      return {
        question,
        selectedAnswer: answer,
        isCorrect: requiresManualGrading(question)
          ? manualGradesRef.current[question.id] === true
          : evaluateAnswer(question, answer)
      }
    })
    const durationSeconds = Math.max(
      0,
      Math.round((Date.now() - new Date(startedAt.current).getTime()) / 1000)
    )
    const record = buildRecord({
      questions,
      answers: finalAnswers,
      startedAt: startedAt.current,
      sessionType,
      source: sourceMode,
      durationSeconds,
      settings: {
        category,
        difficulty,
        type: questionType,
        shuffled: shouldShuffle
      }
    })
    const savedLocally = saveLocalRecord(record)
    setResult(record)
    setFinishReason(reason)
    setStatus("finished")
    setSaveMessage(savedLocally ? "成绩已保存在本机" : "浏览器未能保存成绩")

    try {
      await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total: record.total,
          correct: record.correct,
          accuracy: record.accuracy,
          wrong_questions: record.wrong_questions,
          mode: record.mode,
          source: record.source,
          settings: record.settings,
          duration_seconds: record.duration_seconds
        })
      })
    } catch {
      // Local persistence remains authoritative when optional remote sync is unavailable.
    }
  }

  if (status === "loading") return <LoadingState />

  if (status === "error") {
    return (
      <main className="page narrow quiz-page">
        <section className="panel status-panel" role="alert">
          <h1>题库加载失败</h1>
          <p>{error}</p>
          <div className="button-row centered">
            <button className="button primary" onClick={() => setReloadToken((value) => value + 1)}>
              重新加载
            </button>
            <Link className="button secondary" href="/">返回设置</Link>
          </div>
        </section>
      </main>
    )
  }

  if (status === "empty") {
    return (
      <main className="page narrow quiz-page">
        <section className="panel status-panel">
          <h1>{sourceMode === "wrong" ? "没有符合条件的错题" : "没有符合条件的题目"}</h1>
          <p>返回组卷台，调整题目范围或筛选条件。</p>
          <Link className="button primary" href="/">调整组卷设置</Link>
        </section>
      </main>
    )
  }

  if (status === "finished" && result) {
    const resultLabel = result.mode === "exam" ? "考试完成" : "练习完成"
    return (
      <main className="page narrow quiz-page result-page">
        <section className="panel result-header" aria-labelledby="result-title">
          <div className="score-block">
            <strong className="score-number">{result.accuracy}</strong>
            <span className="score-unit">正确率 %</span>
          </div>
          <div className="result-copy">
            <p className="eyebrow">{resultLabel}</p>
            <h1 id="result-title">本次成绩</h1>
            <p aria-live="polite">
              {finishReason === "timeout" ? "考试时间已到，系统已自动交卷。" : saveMessage}
            </p>
            <div className="button-row">
              <button className="button primary" type="button" onClick={restartQuiz}>
                {result.mode === "exam" ? "再考一次" : "再练一次"}
              </button>
              {result.wrong_questions.length > 0 && (
                <Link className="button secondary" href="/quiz?session=practice&mode=wrong&count=200&shuffle=1&category=all&difficulty=all&type=all">
                  只练错题
                </Link>
              )}
              <Link className="button secondary" href="/records">查看记录</Link>
            </div>
          </div>
        </section>

        <section className="result-stats four" aria-label="成绩摘要">
          <div className="result-stat"><strong>{result.total}</strong><span>总题数</span></div>
          <div className="result-stat"><strong>{result.correct}</strong><span>答对</span></div>
          <div className="result-stat"><strong>{result.wrong_questions.length}</strong><span>答错/未答</span></div>
          <div className="result-stat"><strong>{formatDuration(result.duration_seconds)}</strong><span>用时</span></div>
        </section>

        {result.wrong_questions.length > 0 && (
          <section className="section-block" aria-labelledby="review-title">
            <div className="section-header">
              <h2 id="review-title">错题回顾</h2>
              <span className="muted">{result.wrong_questions.length} 题</span>
            </div>
            <div className="review-list">
              {result.wrong_questions.map((item, itemIndex) => (
                <details className="review-item" key={`${item.id}-${itemIndex}`}>
                  <summary>
                    <span>{item.content}</span>
                    <span className="tag">{item.type}</span>
                  </summary>
                  <div className="review-body">
                    <p><strong>你的答案：</strong>{formatAnswer(item, item.selectedAnswer) || "未作答"}</p>
                    <p><strong>{isChoiceQuestion(item) ? "正确答案" : "参考答案"}：</strong>{formatAnswer(item, item.answer)}</p>
                    <p><strong>解析：</strong>{item.analysis}</p>
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}
      </main>
    )
  }

  const optionKeys = currentQuestion.optionKeys?.length
    ? currentQuestion.optionKeys
    : ANSWER_KEYS.filter((key) => currentQuestion.options[key])
  const choiceQuestion = isChoiceQuestion(currentQuestion)
  const multipleChoice = isMultipleChoiceQuestion(currentQuestion)
  const manualQuestion = requiresManualGrading(currentQuestion)
  const manualGrade = manualGrades[currentQuestion.id]
  const isCorrect = manualQuestion
    ? manualGrade === true
    : evaluateAnswer(currentQuestion, selectedAnswer)
  const sessionLabel = isExam
    ? "模拟考试"
    : sourceMode === "wrong"
      ? "错题练习"
      : "刷题练习"

  return (
    <main className="page narrow quiz-page">
      <div className="quiz-topbar">
        <div className="quiz-meta">
          <span>{sessionLabel}</span>
          <span>
            {isExam && timeLimitSeconds > 0
              ? `剩余 ${formatDuration(secondsRemaining)}`
              : `第 ${index + 1} / ${questions.length} 题`}
          </span>
        </div>
        <progress
          className="progress-track"
          max={questions.length}
          value={isExam ? answeredCount : index + 1}
          aria-label={isExam
            ? `考试进度：已答 ${answeredCount} 题，共 ${questions.length} 题`
            : `答题进度：第 ${index + 1} 题，共 ${questions.length} 题`}
        />
        <div className="quiz-context-row">
          <span>{isExam ? `第 ${index + 1} 题 · 已答 ${answeredCount} 题` : `${currentQuestion.type} · ${currentQuestion.difficulty}`}</span>
          <Link className="quiz-exit-link" href="/">退出</Link>
        </div>
      </div>

      {isExam && (
        <section className="exam-palette-panel" aria-label="考试答题卡">
          <div className="exam-palette-heading">
            <strong>答题卡</strong>
            <button className="text-button" type="button" onClick={requestExamFinish}>交卷</button>
          </div>
          <div className="exam-palette">
            {questions.map((question, questionIndex) => {
              const hasResponse = Boolean(String(responses[question.id] ?? "").trim())
              const classNames = [
                "palette-button",
                questionIndex === index ? "current" : "",
                hasResponse ? "answered" : ""
              ].filter(Boolean).join(" ")
              return (
                <button
                  type="button"
                  className={classNames}
                  key={question.id}
                  aria-label={`第 ${questionIndex + 1} 题${hasResponse ? "，已答" : "，未答"}`}
                  aria-current={questionIndex === index ? "step" : undefined}
                  onClick={() => jumpToQuestion(questionIndex)}
                >
                  {questionIndex + 1}
                </button>
              )
            })}
          </div>
        </section>
      )}

      <section className="panel question-panel">
        <div className="question-tags">
          <span className="tag">{currentQuestion.category}</span>
          <span className="tag">{currentQuestion.difficulty}</span>
          <span className="tag">{currentQuestion.type}</span>
        </div>
        <h1 className="question-title">{currentQuestion.title}</h1>
        <p className="question-content">{currentQuestion.content}</p>

        {choiceQuestion ? (
          <fieldset className="option-fieldset">
            <legend className="sr-only">
              {multipleChoice ? "请选择所有正确答案" : "请选择一个答案"}
            </legend>
            <div className="option-list">
              {optionKeys.map((key) => {
                const isSelected = multipleChoice
                  ? selectedAnswer.includes(key)
                  : selectedAnswer === key
                const showFeedback = !isExam && answered
                const showCorrect = showFeedback && currentQuestion.answer.includes(key)
                const showIncorrect = showFeedback && isSelected && !currentQuestion.answer.includes(key)
                const classNames = [
                  "option-button",
                  isSelected && !showFeedback ? "selected" : "",
                  showCorrect ? "correct" : "",
                  showIncorrect ? "incorrect" : ""
                ].filter(Boolean).join(" ")
                const statusText = showCorrect
                  ? "正确答案"
                  : showIncorrect
                    ? "你的答案"
                    : isSelected
                      ? "已选择"
                      : ""

                return (
                  <button
                    className={classNames}
                    type="button"
                    key={key}
                    disabled={!isExam && answered}
                    aria-pressed={isSelected}
                    onClick={() => chooseAnswer(key)}
                  >
                    <span className="option-key">{key}</span>
                    <span className="option-text">{currentQuestion.options[key]}</span>
                    <span className="option-status">{statusText}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        ) : (
          <label className="text-answer-field">
            <span>你的答案</span>
            {currentQuestion.type === "简答题" ? (
              <textarea
                rows="6"
                value={selectedAnswer}
                readOnly={!isExam && answered}
                onChange={(event) => enterTextAnswer(event.target.value)}
              />
            ) : (
              <input
                type="text"
                value={selectedAnswer}
                readOnly={!isExam && answered}
                autoComplete="off"
                onChange={(event) => enterTextAnswer(event.target.value)}
              />
            )}
          </label>
        )}

        {!isExam && answered && (
          <div
            className={`feedback ${manualQuestion && manualGrade == null ? "manual" : isCorrect ? "" : "wrong"}`}
            aria-live="polite"
          >
            <p className="feedback-heading">
              {manualQuestion
                ? manualGrade == null
                  ? "请对照参考答案完成自评"
                  : manualGrade
                    ? "已标记为掌握"
                    : "已加入待复习"
                : choiceQuestion
                  ? isCorrect ? "回答正确" : "回答错误"
                  : isCorrect ? "与参考答案一致" : "请对照参考答案复习"}
            </p>
            {(manualQuestion || !isCorrect) && (
              <p>
                <strong>{choiceQuestion ? "正确答案" : "参考答案"}：</strong>
                {formatAnswer(currentQuestion, currentQuestion.answer)}
              </p>
            )}
            <p><strong>解析：</strong>{currentQuestion.analysis}</p>
            {manualQuestion && (
              <div className="manual-grade-actions" aria-label="简答题自评">
                <button
                  className="button secondary"
                  type="button"
                  aria-pressed={manualGrade === true}
                  onClick={() => gradeManualAnswer(true)}
                >
                  我已掌握
                </button>
                <button
                  className="button secondary"
                  type="button"
                  aria-pressed={manualGrade === false}
                  onClick={() => gradeManualAnswer(false)}
                >
                  需要复习
                </button>
              </div>
            )}
          </div>
        )}

        {isExam && submitWarning && (
          <div
            className="exam-submit-warning"
            role="alert"
            tabIndex="-1"
            ref={submitWarningRef}
          >
            <p><strong>还有 {unansweredCount} 题未作答</strong></p>
            <p>未答题将按错误计入成绩，确认现在交卷吗？</p>
            <div className="button-row">
              <button className="button secondary" type="button" onClick={() => setSubmitWarning(false)}>继续作答</button>
              <button className="button primary" type="button" onClick={() => finishQuiz(responsesRef.current)}>确认交卷</button>
            </div>
          </div>
        )}

        <div className={`quiz-actions ${isExam ? "exam-actions" : ""}`}>
          {isExam ? (
            <>
              <button className="button secondary" type="button" disabled={index === 0} onClick={() => moveExam(-1)}>
                上一题
              </button>
              {index + 1 < questions.length ? (
                <button className="button primary" type="button" onClick={() => moveExam(1)}>下一题</button>
              ) : (
                <button className="button primary" type="button" onClick={requestExamFinish}>检查并交卷</button>
              )}
            </>
          ) : (
            <>
              <Link className="button secondary" href="/">退出练习</Link>
              {!answered ? (
                <button
                  className="button primary"
                  type="button"
                  data-submit-answer
                  disabled={!String(selectedAnswer).trim()}
                  onClick={submitAnswer}
                >
                  提交答案
                </button>
              ) : (
                <button
                  className="button primary"
                  type="button"
                  disabled={manualQuestion && manualGrade == null}
                  onClick={goForward}
                >
                  {index + 1 >= questions.length ? "查看结果" : "下一题"}
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  )
}

export default function QuizPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <QuizContent />
    </Suspense>
  )
}
