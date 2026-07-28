"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { href: "/", label: "首页" },
  { href: "/quiz", label: "答题" },
  { href: "/records", label: "成绩" },
  { href: "/wrong", label: "错题" }
]

export default function AppHeader() {
  const pathname = usePathname()
  const isQuiz = pathname === "/quiz"

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <Link className="brand" href="/" aria-label="锡铁刷题首页">
            <span className="brand-mark" aria-hidden="true">锡</span>
            <span>锡铁刷题</span>
          </Link>
          <nav className="desktop-nav" aria-label="主导航">
            {navItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link className={active ? "active" : ""} aria-current={active ? "page" : undefined} key={item.href} href={item.href}>
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>
      {!isQuiz && (
        <nav className="mobile-nav" aria-label="移动端主导航">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link className={active ? "active" : ""} aria-current={active ? "page" : undefined} key={item.href} href={item.href}>
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}
    </>
  )
}
