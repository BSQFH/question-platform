"use client"

import { useEffect, useState } from "react"

export default function Quiz(){

  const [questions,setQuestions] = useState([])
  const [index,setIndex] = useState(0)
  const [loading,setLoading] = useState(true)

  useEffect(()=>{

    fetch("/questions")
      .then(res=>res.json())
      .then(data=>{
        setQuestions(data)
        setLoading(false)
      })

  },[])


  if(loading){
    return (
      <main>
        <h1>开始刷题</h1>
        <p>题目加载中...</p>
      </main>
    )
  }


  const q = questions[index]


  return (
    <main>

      <h1>在线题库</h1>

      <h2>
        {q.title}
      </h2>

      <p>
        {q.content}
      </p>


      <button>
        A. {q.option_a}
      </button>

      <br/>


      <button>
        B. {q.option_b}
      </button>

      <br/>


      <button>
        C. {q.option_c}
      </button>

      <br/>


      <button>
        D. {q.option_d}
      </button>


    </main>
  )
}
