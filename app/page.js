"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  collectWrongQuestions,
  filterQuestions,
  normalizeQuestion,
  normalizeQuestions,
  questionFingerprint,
  requiresManualGrading,
  summarizeRecords
} from "./lib/quiz"
import { getLocalRecords, getMasteredQuestionIds } from "./lib/storage"

const emptyStats = {
  sessions: 0,
  totalAnswered: 0,
  accuracy: 0,
  bestAccuracy: 0,
  wrongCount: 0
}

const initialConfig = {
  session: "practice",
  source: "all",
  category: "all",
  difficulty: "all",
  type: "all",
  count: 10,
  order: "random",
  minutes: "20"
}

function uniqueValues(items, key) {
  return Array.from(new Set(items.map((item) => item[key]).filter(Boolean)))
}

export default function Home() {
  const router = useRouter()
  const [stats, setStats] = useState(emptyStats)
  const [questions, setQuestions] = useState([])
  const [wrongQuestions, setWrongQuestions] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [config, setConfig] = useState(initialConfig)

  useEffect(() => {
    const records = getLocalRecords()
    const pendingWrong = collectWrongQuestions(records, getMasteredQuestionIds())
    const summary = summarizeRecords(records)
    setStats({ ...summary, wrongCount: pendingWrong.length })
    setWrongQuestions(pendingWrong)

    fetch("/questions", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : [])
      .then((data) => setQuestions(normalizeQuestions(data)))
      .catch(() => setQuestions([]))
      .finally(() => setLoaded(true))
  }, [])

  const questionPool = useMemo(() => {
    if (config.source !== "wrong") return questions

    const wrongKeys = new Set(
      wrongQuestions.flatMap((item) => [item.id, item.key].filter(Boolean))
    )
    const matched = questions.filter((question) => (
      wrongKeys.has(question.id) || wrongKeys.has(questionFingerprint(question))
    ))
    const embedded = wrongQuestions
      .map((item, index) => normalizeQuestion(item, index))
      .filter(Boolean)
      .filter((item) => !matched.some((question) => question.id === item.id))
    return [...matched, ...embedded]
  }, [config.source, questions, wrongQuestions])

  const sessionQuestionPool = useMemo(
    () => config.session === "exam"
      ? questionPool.filter((question) => !requiresManualGrading(question))
      : questionPool,
    [config.session, questionPool]
  )
  const filteredQuestions = useMemo(
    () => filterQuestions(sessionQuestionPool, config),
    [config, sessionQuestionPool]
  )
  const availableCount = filteredQuestions.length
  const maxSessionCount = Math.max(1, Math.min(200, availableCount))
  const selectedCount = Math.min(Math.max(1, config.count), maxSessionCount)
  const categories = useMemo(() => uniqueValues(sessionQuestionPool, "category"), [sessionQuestionPool])
  const difficulties = useMemo(() => uniqueValues(sessionQuestionPool, "difficulty"), [sessionQuestionPool])
  const types = useMemo(() => uniqueValues(sessionQuestionPool, "type"), [sessionQuestionPool])

  useEffect(() => {
    if (loaded && availableCount > 0 && config.count !== selectedCount) {
      setConfig((current) => ({ ...current, count: selectedCount }))
    }
  }, [availableCount, config.count, loaded, selectedCount])

  function updateConfig(key, value) {
    setConfig((current) => {
      if (key === "source") {
        return { ...current, source: value, category: "all", difficulty: "all", type: "all" }
      }
      if (key === "session") {
        return {
          ...current,
          session: value,
          type: value === "exam" && current.type === "简答题" ? "all" : current.type
        }
      }
      return { ...current, [key]: value }
    })
  }

  function startSession(event) {
    event.preventDefault()
    if (!availableCount) return

    const params = new URLSearchParams({
      session: config.session,
      mode: config.source === "wrong" ? "wrong" : "normal",
      count: String(selectedCount),
      shuffle: config.order === "random" ? "1" : "0",
      category: config.category,
      difficulty: config.difficulty,
      type: config.type
    })
    if (config.session === "exam") params.set("minutes", config.minutes)
    router.push(`/quiz?${params.toString()}`)
  }

  const startLabel = config.session === "exam"
    ? "开始考试"
    : config.source === "wrong"
      ? "开始错题练习"
      : "开始刷题"

  return (
    <main className="page home-page">
      <header className="page-heading home-heading">
        <div>
          <p className="eyebrow">移动学习台</p>
          <h1>今天练什么？</h1>
        </div>
        <div className="home-streak" aria-label={`累计答题 ${stats.totalAnswered} 道`}>
          <strong>{stats.totalAnswered}</strong>
          <span>累计答题</span>
        </div>
      </header>

      <section className="panel setup-panel" aria-labelledby="setup-title">
        <div className="setup-heading">
          <div>
            <h2 id="setup-title">自由组卷</h2>
            <p>按当前目标组合一套题目</p>
          </div>
          <span className={`availability ${availableCount ? "" : "empty"}`} aria-live="polite">
            {loaded ? `${availableCount} 题可用` : "读取题库"}
          </span>
        </div>

        <form className="setup-form" onSubmit={startSession}>
          <fieldset className="setup-fieldset">
            <legend>答题模式</legend>
            <div className="segmented-control two-columns">
              <label>
                <input
                  type="radio"
                  name="session"
                  value="practice"
                  checked={config.session === "practice"}
                  onChange={(event) => updateConfig("session", event.target.value)}
                />
                <span><strong>刷题练习</strong><small>逐题判定与解析</small></span>
              </label>
              <label>
                <input
                  type="radio"
                  name="session"
                  value="exam"
                  checked={config.session === "exam"}
                  onChange={(event) => updateConfig("session", event.target.value)}
                />
                <span><strong>模拟考试</strong><small>交卷后统一判分</small></span>
              </label>
            </div>
          </fieldset>

          <fieldset className="setup-fieldset">
            <legend>题目范围</legend>
            <div className="segmented-control compact">
              <label>
                <input
                  type="radio"
                  name="source"
                  value="all"
                  checked={config.source === "all"}
                  onChange={(event) => updateConfig("source", event.target.value)}
                />
                <span>全部题库</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="source"
                  value="wrong"
                  checked={config.source === "wrong"}
                  onChange={(event) => updateConfig("source", event.target.value)}
                />
                <span>错题集 · {stats.wrongCount}</span>
              </label>
            </div>
          </fieldset>

          <div className="filter-grid">
            <label className="form-field">
              <span>分类</span>
              <select value={config.category} onChange={(event) => updateConfig("category", event.target.value)}>
                <option value="all">全部分类</option>
                {categories.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>难度</span>
              <select value={config.difficulty} onChange={(event) => updateConfig("difficulty", event.target.value)}>
                <option value="all">全部难度</option>
                {difficulties.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>题型</span>
              <select value={config.type} onChange={(event) => updateConfig("type", event.target.value)}>
                <option value="all">全部题型</option>
                {types.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>
            {config.session === "exam" && (
              <label className="form-field">
                <span>考试时长</span>
                <select value={config.minutes} onChange={(event) => updateConfig("minutes", event.target.value)}>
                  <option value="0">不限时</option>
                  <option value="10">10 分钟</option>
                  <option value="20">20 分钟</option>
                  <option value="30">30 分钟</option>
                  <option value="60">60 分钟</option>
                </select>
              </label>
            )}
          </div>

          <fieldset className="setup-fieldset horizontal-fieldset">
            <legend>出题顺序</legend>
            <div className="segmented-control compact">
              <label>
                <input
                  type="radio"
                  name="order"
                  value="random"
                  checked={config.order === "random"}
                  onChange={(event) => updateConfig("order", event.target.value)}
                />
                <span>随机</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="order"
                  value="sequential"
                  checked={config.order === "sequential"}
                  onChange={(event) => updateConfig("order", event.target.value)}
                />
                <span>顺序</span>
              </label>
            </div>
          </fieldset>

          <div className="count-control">
            <div className="count-heading">
              <label htmlFor="question-count">题目数量</label>
              <output htmlFor="question-count">{availableCount ? selectedCount : 0} 题</output>
            </div>
            <input
              id="question-count"
              type="range"
              min="1"
              max={maxSessionCount}
              value={selectedCount}
              disabled={!availableCount}
              onChange={(event) => updateConfig("count", Number(event.target.value))}
            />
            <div className="range-labels" aria-hidden="true">
              <span>1</span>
              <span>{availableCount ? maxSessionCount : "--"}</span>
            </div>
          </div>

          <button className="button primary start-button" type="submit" disabled={!loaded || !availableCount}>
            <span>{startLabel}</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>

      <div className="home-secondary-grid">
        <section className="panel stats-panel" aria-labelledby="stats-title">
          <div className="section-header">
            <h2 id="stats-title">学习概览</h2>
            <Link className="text-link" href="/records">全部记录</Link>
          </div>
          <div className="stat-grid">
            <div className="stat-item"><strong className="stat-value">{stats.sessions}</strong><span className="stat-label">完成次数</span></div>
            <div className="stat-item"><strong className="stat-value">{stats.accuracy}%</strong><span className="stat-label">平均正确率</span></div>
            <div className="stat-item"><strong className="stat-value">{stats.bestAccuracy}%</strong><span className="stat-label">最佳成绩</span></div>
            <div className="stat-item"><strong className="stat-value">{stats.wrongCount}</strong><span className="stat-label">待复习错题</span></div>
          </div>
        </section>

        <section className="panel quick-panel" aria-labelledby="quick-title">
          <div className="section-header"><h2 id="quick-title">快捷入口</h2></div>
          <div className="quick-list">
            <Link href="/quiz?session=practice&mode=normal&count=10&shuffle=1&category=all&difficulty=all&type=all">
              <span><strong>10 题速练</strong><small>随机抽题，即答即看</small></span><span aria-hidden="true">→</span>
            </Link>
            <Link href="/wrong">
              <span><strong>管理错题集</strong><small>{stats.wrongCount} 题待复习</small></span><span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
