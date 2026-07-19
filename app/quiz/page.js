"use client"

import { useEffect, useState } from "react"

export default function Quiz(){

  const [questions,setQuestions] = useState([])
  const [index,setIndex] = useState(0)
  const [loading,setLoading] = useState(true)
const [score,setScore] = useState(0)
const [finished,setFinished] = useState(false)
const [wrong,setWrong] = useState([])
  const [selected,setSelected] = useState("")
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


  function choose(option){

    if(selected){
      return
    }


    setSelected(option)


    if(option === q.answer){

      setResult("✅ 回答正确")

    }else{

      setResult(
        "❌ 回答错误，正确答案是：" + q.answer
      )

    }

  }


  function next(){

    setIndex(index + 1)

    setSelected("")

    setResult("")

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



      <button
        onClick={()=>choose("A")}
        disabled={selected}
      >
        A. {q.option_a}
      </button>


      <br/><br/>


      <button
        onClick={()=>choose("B")}
        disabled={selected}
      >
        B. {q.option_b}
      </button>


      <br/><br/>


      <button
        onClick={()=>choose("C")}
        disabled={selected}
      >
        C. {q.option_c}
      </button>


      <br/><br/>


      <button
        onClick={()=>choose("D")}
        disabled={selected}
      >
        D. {q.option_d}
      </button>



      <h3>

        {result}

      </h3>



      {
        selected && (

          <button onClick={next}>

            下一题

          </button>

        )
      }



    </main>

  )

}
