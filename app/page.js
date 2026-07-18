import Link from "next/link"

export default function Home(){

  return (

    <main>

      <h1>
        在线题库系统
      </h1>

      <p>
        欢迎来到我的刷题平台
      </p>

      <Link href="/quiz">
        <button>
          开始刷题
        </button>
      </Link>

    </main>

  )

}
