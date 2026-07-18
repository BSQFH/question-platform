"use client"

import { useEffect, useState } from "react"

export default function Quiz(){

  const [question,setQuestion] = useState(null)

  useEffect(()=>{

    fetch("/api/questions")
    .then(res=>res.json())
    .then(data=>{
      console.log(data)
      setQuestion(data[0])
    })

  },[])


  if(!question){
    return <h1>题目加载中...</h1>
  }


  return (
    <main>

      <h1>{question.title}</h1>

      <p>{question.content}</p>


      <button>
        A. {question.option_a}
      </button>

      <button>
        B. {question.option_b}
      </button>

      <button>
        C. {question.option_c}
      </button>

      <button>
        D. {question.option_d}
      </button>


    </main>
  )

}
