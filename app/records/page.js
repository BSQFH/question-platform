"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { formatDuration, summarizeRecords } from "../lib/quiz"
import { clearLocalRecords, getLocalRecords } from "../lib/storage"

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value))
  } catch {
    return "--"
  }
}

export default function Records() {
  const [records, setRecords] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [mode, setMode] = useState("all")
  const summary = useMemo(() => summarizeRecords(records), [records])
  const visibleRecords = useMemo(
    () => records.filter((item) => mode === "all" || item.mode === mode),
    [mode, records]
  )

  useEffect(() => {
    setRecords(getLocalRecords())
    setLoaded(true)
  }, [])

  function clearRecords() {
    if (!window.confirm("确定清空这台设备上的全部答题记录吗？")) return
    clearLocalRecords()
    setRecords([])
  }

  if (!loaded) {
    return (
      <main className="page">
        <section className="panel status-panel" aria-live="polite">
          <h1>正在读取成绩</h1>
          <div className="loading-bar" aria-hidden="true" />
        </section>
      </main>
    )
  }

  return (
    <main className="page">
      <header className="page-heading">
        <p className="eyebrow">学习记录</p>
        <h1>成绩记录</h1>
      </header>

      <section className="summary-grid" aria-label="累计成绩摘要">
        <div className="stat-item"><strong className="stat-value">{summary.sessions}</strong><span className="stat-label">完成次数</span></div>
        <div className="stat-item"><strong className="stat-value">{summary.totalAnswered}</strong><span className="stat-label">累计答题</span></div>
        <div className="stat-item"><strong className="stat-value">{summary.accuracy}%</strong><span className="stat-label">平均正确率</span></div>
        <div className="stat-item"><strong className="stat-value">{summary.bestAccuracy}%</strong><span className="stat-label">最佳成绩</span></div>
      </section>

      <section className="panel records-panel" aria-labelledby="history-title">
        <div className="records-toolbar">
          <div>
            <h2 id="history-title">答题历史</h2>
            <span className="muted">共 {records.length} 次</span>
          </div>
          {records.length > 0 && (
            <button className="button danger" type="button" onClick={clearRecords}>清空本机记录</button>
          )}
        </div>

        {records.length > 0 && (
          <div className="records-mode-tabs" role="tablist" aria-label="记录类型">
            {[
              ["all", "全部"],
              ["practice", "练习"],
              ["exam", "考试"]
            ].map(([value, label]) => (
              <button
                className={mode === value ? "active" : ""}
                type="button"
                role="tab"
                aria-selected={mode === value}
                key={value}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {records.length === 0 && (
          <div className="empty-state">
            <h2>还没有成绩记录</h2>
            <p>完成一次练习后，成绩会显示在这里。</p>
            <Link className="button primary" href="/quiz?count=10&shuffle=1">开始练习</Link>
          </div>
        )}

        {records.length > 0 && visibleRecords.length === 0 && (
          <div className="filtered-empty">
            <h2>暂无这类记录</h2>
            <p>切换到其他类型查看历史成绩。</p>
          </div>
        )}

        {visibleRecords.length > 0 && (
          <div className="table-wrap">
            <table className="records-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>模式</th>
                  <th className="number">题数</th>
                  <th className="number">答对</th>
                  <th className="number">错题</th>
                  <th className="number">正确率</th>
                  <th className="number">用时</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((item) => (
                  <tr key={item.id}>
                    <td data-label="时间">{formatDate(item.created_at)}</td>
                    <td data-label="模式">
                      {item.mode === "exam" ? "模拟考试" : item.source === "wrong" ? "错题练习" : "刷题练习"}
                    </td>
                    <td className="number" data-label="题数">{item.total}</td>
                    <td className="number" data-label="答对">{item.correct}</td>
                    <td className="number" data-label="错题">{item.wrong_questions.length}</td>
                    <td
                      className={`number ${item.accuracy >= 80 ? "accuracy-good" : "accuracy-review"}`}
                      data-label="正确率"
                    >
                      {item.accuracy}%
                    </td>
                    <td className="number" data-label="用时">{formatDuration(item.duration_seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
