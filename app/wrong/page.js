"use client"

import {useEffect,useState} from "react"


export default function Wrong(){


  const [wrong,setWrong]=useState([])

  const [loading,setLoading]=useState(true)



  useEffect(()=>{


    fetch("/api/records")

    .then(res=>res.json())

    .then(data=>{


      let list=[]


      data.forEach(record=>{


        if(record.wrong_questions){


          list=[
            ...list,
            ...record.wrong_questions
          ]


        }


      })


      setWrong(list)

      setLoading(false)


    })


  },[])





  if(loading){


    return <h1>加载中...</h1>


  }




  return (

    <main>


      <h1>
        我的错题本
      </h1>


      <hr/>




      {
        wrong.length===0 ?


        <h2>
          暂无错题
        </h2>


        :


        wrong.map((item,index)=>(


          <div key={index}>


            <h2>
              {item.title}
            </h2>


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


            <hr/>


          </div>


        ))


      }



    </main>


  )


}
