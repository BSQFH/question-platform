import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"


const supabase = createClient(

  process.env.NEXT_PUBLIC_SUPABASE_URL,

  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

)



// 保存成绩
export async function POST(request){


  const body = await request.json()



  const {data,error} = await supabase

    .from("records")

    .insert([body])



  if(error){

    return NextResponse.json(
      {
        error:error.message
      },
      {
        status:500
      }
    )

  }



  return NextResponse.json(data)


}





// 获取成绩
export async function GET(){


  const {data,error}=await supabase

    .from("records")

    .select("*")

    .order(
      "created_at",
      {
        ascending:false
      }
    )



  if(error){

    return NextResponse.json(
      {
        error:error.message
      },
      {
        status:500
      }
    )

  }



  return NextResponse.json(data)


}
