"use client"

import { useEffect, useState } from "react"


export default function Quiz(){

  const [questions,setQuestions] = useState([])
  const [index,setIndex] = useState(0)
  const [loading,setLoading] = useState(true)
  const [result,setResult] = useState("")


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

        <h1>
          在线题库
        </h1>

        <p>
          题目加载中...
        </p>

      </main>

    )

  }



  const q = questions[index]



  function checkAnswer(option){

    if(option === q.answer){

      setResult("✅ 回答正确")

    }else{

      setResult(
        "❌ 回答错误，正确答案：" + q.answer
      )

    }

  }



  function nextQuestion(){

    setResult("")

    setIndex(index + 1)

  }



  return (

    <main>


      <h1>
        在线题库
      </h1>


      <h2>
        第 {index + 1} 题
      </h2>


      <h3>
        {q.title}
      </h3>


      <p>
        {q.content}
      </p>



      <button onClick={()=>checkAnswer("A")}>
        A. {q.option_a}
      </button>

      <br/><br/>


      <button onClick={()=>checkAnswer("B")}>
        B. {q.option_b}
      </button>

      <br/><br/>


      <button onClick={()=>checkAnswer("C")}>
        C. {q.option_c}
      </button>

      <br/><br/>


      <button onClick={()=>checkAnswer("D")}>
        D. {q.option_d}
      </button>



      <h3>
        {result}
      </h3>


      <button onClick={nextQuestion}>
        下一题
      </button>


    </main>

  )

}
