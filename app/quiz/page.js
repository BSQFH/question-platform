"use client"

import { useEffect, useState } from "react"


export default function Quiz(){


  const [questions,setQuestions] = useState([])

  const [index,setIndex] = useState(0)

  const [loading,setLoading] = useState(true)

  const [score,setScore] = useState(0)

  const [finished,setFinished] = useState(false)

  const [wrong,setWrong] = useState([])

  const [answered,setAnswered] = useState(false)

  const [message,setMessage] = useState("")



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




  if(finished){


    return (

      <main>


        <h1>
          答题完成
        </h1>



        <p>
          总题数：
          {questions.length}
        </p>



        <p>
          答对：
          {score}
        </p>




        <p>

          正确率：

          {
            questions.length===0
            ?
            0
            :
            Math.round(
              score/questions.length*100
            )
          }

          %

        </p>




        <h2>
          错题回顾
        </h2>



        {
          wrong.length===0

          ?

          <p>
            恭喜，没有错题！
          </p>


          :


          wrong.map(item=>(


            <div key={item.id}>


              <hr/>


              <h3>
                {item.title}
              </h3>



              <p>
                题目：
                {item.content}
              </p>



              <p>
                正确答案：
                {item.answer}
              </p>



              <p>
                解析：
                {item.analysis}
              </p>



            </div>


          ))

        }



      </main>

    )


  }





  const q = questions[index]



  if(!q){


    return (

      <main>

        <h1>
          暂无题目
        </h1>


      </main>

    )


  }





  function checkAnswer(answer){


    if(answered){

      return

    }



    setAnswered(true)



    if(
      answer.trim() === q.answer.trim()
    ){


      setScore(
        score + 1
      )


      setMessage(
        "✅ 回答正确"
      )


    }

    else{


      setWrong([
        ...wrong,
        q
      ])


      setMessage(
        "❌ 回答错误"
      )


    }



  }





  function nextQuestion(){



    setMessage("")

    setAnswered(false)



    if(
      index + 1 < questions.length
    ){


      setIndex(
        index + 1
      )


    }

    else{


      setFinished(true)


    }



  }





  return (

    <main>


      <h1>
        在线题库
      </h1>



      <h2>
        第 {index+1} 题
      </h2>



      <h3>
        {q.title}
      </h3>



      <p>
        {q.content}
      </p>




      <button
      onClick={()=>checkAnswer("A")}
      >
        A. {q.option_a}
      </button>



      <br/><br/>




      <button
      onClick={()=>checkAnswer("B")}
      >
        B. {q.option_b}
      </button>



      <br/><br/>




      <button
      onClick={()=>checkAnswer("C")}
      >
        C. {q.option_c}
      </button>



      <br/><br/>




      <button
      onClick={()=>checkAnswer("D")}
      >
        D. {q.option_d}
      </button>




      {
        answered &&

        <>

        <h3>
          {message}
        </h3>


        <p>
          正确答案：
          {q.answer}
        </p>


        </>
      }




      {
        answered &&


        <button
        onClick={nextQuestion}
        >

          {
            index+1===questions.length

            ?

            "查看成绩"

            :

            "下一题"

          }


        </button>

      }



    </main>

  )


}
