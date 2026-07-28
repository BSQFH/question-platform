"use client"

import Link from "next/link"
import { useDeferredValue, useEffect, useMemo, useState } from "react"
import { formatAnswer, matchesQuestionSearch } from "../lib/quiz"
import { loadQuestionBank } from "../lib/questionClient"

const PAGE_SIZE = 30

export default function QuestionSearch() {
  const [questions, setQuestions] = useState([])
  const [query, setQuery] = useState("")
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE)
  const [status, setStatus] = useState("loading")
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true

    async function loadQuestions() {
      setStatus("loading")

      try {
        const payload = await loadQuestionBank({ refresh: reloadToken > 0 })
        if (!active) return
        setQuestions(payload)
        setStatus("ready")
      } catch {
        if (active) setStatus("error")
      }
    }

    loadQuestions()
    return () => {
      active = false
    }
  }, [reloadToken])

  const trimmedQuery = query.trim()
  const deferredQuery = useDeferredValue(trimmedQuery)
  const isSearchPending = trimmedQuery !== deferredQuery
  const results = useMemo(
    () => deferredQuery
      ? questions.filter((question) => matchesQuestionSearch(question, deferredQuery))
      : [],
    [deferredQuery, questions]
  )
  const visibleResults = results.slice(0, visibleLimit)
  const practiceCount = Math.min(200, results.length)
  const practiceParams = new URLSearchParams({
    session: "practice",
    mode: "normal",
    count: String(practiceCount),
    shuffle: "0",
    category: "all",
    difficulty: "all",
    type: "all",
    q: deferredQuery
  })

  function updateQuery(value) {
    setQuery(value.slice(0, 120))
    setVisibleLimit(PAGE_SIZE)
  }

  return (
    <main className="page narrow search-page">
      <header className="page-heading">
        <p className="eyebrow">全库检索</p>
        <h1>搜题</h1>
      </header>

      <section className="panel search-panel" aria-label="搜索题库">
        <label className="search-field search-input-field" htmlFor="question-search">
          <span>搜索关键词</span>
          <input
            id="question-search"
            type="search"
            value={query}
            maxLength="120"
            autoComplete="off"
            placeholder="输入关键词"
            onChange={(event) => updateQuery(event.target.value)}
          />
        </label>
        <div className="search-summary" aria-live="polite">
          <span>
            {status === "loading"
              ? "正在读取题库"
              : status === "error"
                ? "题库读取失败"
                : isSearchPending
                  ? "正在搜索"
                  : trimmedQuery
                    ? `找到 ${results.length} 题`
                    : `题库共 ${questions.length} 题`}
          </span>
          {status === "error" && (
            <button className="button secondary" type="button" onClick={() => setReloadToken((value) => value + 1)}>
              重新读取
            </button>
          )}
          {status === "ready" && !isSearchPending && results.length > 0 && (
            <Link className="button primary" href={`/quiz?${practiceParams.toString()}`}>
              练习这 {practiceCount} 题
            </Link>
          )}
        </div>
      </section>

      {status === "ready" && !isSearchPending && trimmedQuery && results.length === 0 && (
        <section className="panel filtered-empty" aria-live="polite">
          <h2>没有找到相关题目</h2>
          <p>请调整关键词后重试。</p>
        </section>
      )}

      {visibleResults.length > 0 && (
        <section className="search-results" aria-label="搜题结果">
          <div className="search-list">
            {visibleResults.map((item) => (
              <article className="search-result" key={item.id}>
                <details>
                  <summary>
                    <span className="search-result-heading">
                      <small>{item.title}</small>
                      <strong>{item.content}</strong>
                    </span>
                    <span className="tag">{item.type}</span>
                  </summary>
                  <div className="search-result-body">
                    <div className="question-tags">
                      <span className="tag">{item.category}</span>
                      <span className="tag">{item.difficulty}</span>
                    </div>
                    {item.optionKeys.length > 0 && (
                      <ul className="search-options">
                        {item.optionKeys.map((key) => (
                          <li key={key}><strong>{key}.</strong> {item.options[key]}</li>
                        ))}
                      </ul>
                    )}
                    <p><strong>正确答案：</strong>{formatAnswer(item, item.answer)}</p>
                    <p><strong>解析：</strong>{item.analysis}</p>
                  </div>
                </details>
              </article>
            ))}
          </div>
          {visibleLimit < results.length && (
            <button
              className="button secondary search-load-more"
              type="button"
              onClick={() => setVisibleLimit((value) => value + PAGE_SIZE)}
            >
              加载更多
            </button>
          )}
        </section>
      )}
    </main>
  )
}
