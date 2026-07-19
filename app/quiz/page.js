"use client"

import { useEffect, useState } from "react"


export default function Quiz(){


  const [questions,setQuestions] = useState([])

  const [index,setIndex] = useState(0)

  const [score,setScore] = useState(0)

  const [wrong,setWrong] = useState([])

  const [loading,setLoading] = useState(true)

  const [finished,setFinished] = useState(false)

  const [saved,setSaved] = useState(false)



  useEffect(()=>{


    fetch("/questions")

      .then(res=>res.json())

      .then(data=>{

        setQuestions(data)

        setLoading(false)

      })


  },[])





  useEffect(()=>{


    if(finished && !saved){


      saveRecord()


    }


  },[finished])







  async function saveRecord(){


    const total = questions.length


    const accuracy = Math.round(
      score / total * 100
    )



    await fetch("/records",{

      method:"POST",

      headers:{

        "Content-Type":"application/json"

      },


      body:JSON.stringify({

        username:"游客",

        total:total,

        correct:score,

        accuracy:accuracy,

        wrong_questions:wrong

      })


    })


    setSaved(true)


  }







  function answer(choice){


    const q = questions[index]


    if(choice === q.answer){


      setScore(score+1)


    }else{


      setWrong([

        ...wrong,

        {

          title:q.title,

          content:q.content,

          answer:q.answer,

          analysis:q.analysis

        }

      ])


    }



    next()

  }







  function next(){


    if(index + 1 >= questions.length){


      setFinished(true)


    }else{


      setIndex(index+1)


    }


  }






  if(loading){


    return <h1>题目加载中...</h1>


  }







  if(finished){


    return (

      <main>


        <h1>
          答题完成
        </h1>



        <p>
          总题数：{questions.length}
        </p>



        <p>
          答对：{score}
        </p>



        <p>
          正确率：
          {Math.round(score/questions.length*100)}%
        </p>




        <h2>
          错题回顾
        </h2>



        {
          wrong.map((item,i)=>(


            <div key={i}>


              <hr/>


              <h3>
                {item.title}
              </h3>


              <p>
                题目：{item.content}
              </p>


              <p>
                正确答案：{item.answer}
              </p>


              <p>
                解析：{item.analysis}
              </p>



            </div>


          ))
        }


      </main>


    )

  }






  const q = questions[index]




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



      <button onClick={()=>answer("A")}>

        A. {q.option_a}

      </button>


      <br/><br/>


      <button onClick={()=>answer("B")}>

        B. {q.option_b}

      </button>


      <br/><br/>


      <button onClick={()=>answer("C")}>

        C. {q.option_c}

      </button>


      <br/><br/>


      <button onClick={()=>answer("D")}>

        D. {q.option_d}

      </button>



    </main>

  )

}
