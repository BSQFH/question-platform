"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { collectWrongQuestions, formatAnswer } from "../lib/quiz"
import {
  getLocalRecords,
  getMasteredQuestionIds,
  markQuestionMastered,
  unmarkQuestionMastered
} from "../lib/storage"

export default function WrongBook() {
  const [allWrongQuestions, setAllWrongQuestions] = useState([])
  const [masteredIds, setMasteredIds] = useState([])
  const [view, setView] = useState("pending")
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [loaded, setLoaded] = useState(false)

  function refreshWrongQuestions() {
    setAllWrongQuestions(collectWrongQuestions(getLocalRecords()))
    setMasteredIds(getMasteredQuestionIds())
  }

  useEffect(() => {
    refreshWrongQuestions()
    setLoaded(true)
  }, [])

  const masteredSet = useMemo(() => new Set(masteredIds), [masteredIds])
  const pendingQuestions = useMemo(
    () => allWrongQuestions.filter((item) => !masteredSet.has(item.key)),
    [allWrongQuestions, masteredSet]
  )
  const masteredQuestions = useMemo(
    () => allWrongQuestions.filter((item) => masteredSet.has(item.key)),
    [allWrongQuestions, masteredSet]
  )
  const sourceQuestions = view === "mastered" ? masteredQuestions : pendingQuestions
  const categories = useMemo(
    () => Array.from(new Set(allWrongQuestions.map((item) => item.category).filter(Boolean))),
    [allWrongQuestions]
  )
  const visibleQuestions = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("zh-CN")
    return sourceQuestions.filter((item) => (
      (category === "all" || item.category === category) &&
      (!keyword || `${item.title} ${item.content}`.toLocaleLowerCase("zh-CN").includes(keyword))
    ))
  }, [category, search, sourceQuestions])

  function setMastered(id, mastered) {
    if (mastered) markQuestionMastered(id)
    else unmarkQuestionMastered(id)
    refreshWrongQuestions()
  }

  if (!loaded) {
    return (
      <main className="page narrow">
        <section className="panel status-panel" aria-live="polite">
          <h1>正在整理错题</h1>
          <div className="loading-bar" aria-hidden="true" />
        </section>
      </main>
    )
  }

  return (
    <main className="page narrow wrong-page">
      <header className="page-heading wrong-page-heading">
        <div>
          <p className="eyebrow">重点复习</p>
          <h1>错题集</h1>
        </div>
        {pendingQuestions.length > 0 && (
          <Link className="button primary" href="/quiz?session=practice&mode=wrong&count=200&shuffle=1&category=all&difficulty=all&type=all">
            开始重练
          </Link>
        )}
      </header>

      {allWrongQuestions.length === 0 ? (
        <section className="panel empty-state">
          <h2>还没有错题</h2>
          <p>练习或考试中的错题会自动进入这里。</p>
          <Link className="button primary" href="/">去自由组卷</Link>
        </section>
      ) : (
        <>
          <div className="wrong-tabs" role="tablist" aria-label="错题状态">
            <button
              className={view === "pending" ? "active" : ""}
              type="button"
              role="tab"
              aria-selected={view === "pending"}
              onClick={() => setView("pending")}
            >
              待复习 <span>{pendingQuestions.length}</span>
            </button>
            <button
              className={view === "mastered" ? "active" : ""}
              type="button"
              role="tab"
              aria-selected={view === "mastered"}
              onClick={() => setView("mastered")}
            >
              已掌握 <span>{masteredQuestions.length}</span>
            </button>
          </div>

          <section className="wrong-filters" aria-label="筛选错题">
            <label className="search-field">
              <span className="sr-only">搜索错题</span>
              <input
                type="search"
                value={search}
                placeholder="搜索题目"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="form-field compact-field">
              <span className="sr-only">按分类筛选</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">全部分类</option>
                {categories.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>
          </section>

          {visibleQuestions.length === 0 ? (
            <section className="panel filtered-empty">
              <h2>{view === "mastered" ? "暂无已掌握题目" : "没有符合条件的错题"}</h2>
              <p>可以切换状态或调整搜索条件。</p>
            </section>
          ) : (
            <section className="wrong-list" aria-label={view === "mastered" ? "已掌握题目" : "待复习错题"}>
              {visibleQuestions.map((item) => (
                <article className="wrong-item" key={item.key}>
                  <details>
                    <summary>
                      <span>{item.content}</span>
                      <span className="tag">{item.type}</span>
                    </summary>
                    <div className="wrong-body">
                      <div className="question-tags">
                        <span className="tag">{item.category}</span>
                        <span className="tag">{item.difficulty}</span>
                      </div>
                      {item.selectedAnswer && (
                        <p><strong>上次选择：</strong>{formatAnswer(item, item.selectedAnswer)}</p>
                      )}
                      <p><strong>正确答案：</strong>{formatAnswer(item, item.answer)}</p>
                      <p><strong>解析：</strong>{item.analysis}</p>
                    </div>
                  </details>
                  <div className="wrong-item-footer">
                    <span className="wrong-count">累计答错 {item.count} 次</span>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => setMastered(item.key, view !== "mastered")}
                    >
                      {view === "mastered" ? "恢复复习" : "标记已掌握"}
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  )
}
