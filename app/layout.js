import "./globals.css"
import AppHeader from "./components/AppHeader"

export const metadata = {
  title: {
    default: "我爱我家",
    template: "%s | 我爱我家"
  },
  description: "轨道交通岗位知识在线练习平台"
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e"
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppHeader />
        <div className="app-content">{children}</div>
      </body>
    </html>
  )
}
