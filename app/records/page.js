"use client"

import { useEffect, useState } from "react"


export default function Records(){


  const [records,setRecords] = useState([])

  const [loading,setLoading] = useState(true)



  useEffect(()=>{


    fetch("/api/records")
    .then(res=>res.json())

    .then(data=>{

      setRecords(data)

      setLoading(false)

    })


  },[])





  if(loading){


    return (

      <main>

        <h1>
          成绩加载中...
        </h1>

      </main>

    )


  }





  return (

    <main>


      <h1>
        我的成绩
      </h1>



      {
        records.length===0 &&

        <p>
          暂无答题记录
        </p>

      }




      {

      records.map((item)=>(
        

        <div key={item.id}>


          <hr/>


          <h2>
            用户：{item.username}
          </h2>



          <p>
            时间：
            {new Date(item.created_at).toLocaleString()}
          </p>



          <p>
            总题数：
            {item.total}
          </p>



          <p>
            答对：
            {item.correct}
          </p>



          <p>
            正确率：
            {item.accuracy}%
          </p>



          <h3>
            错题数量：
            {item.wrong_questions.length}
          </h3>



        </div>


      ))

      }



    </main>

  )


}
