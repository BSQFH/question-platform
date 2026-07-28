import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { sanitizeRecordPayload } from "../../lib/quiz"

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求内容无效" }, { status: 400 })
  }

  const record = sanitizeRecordPayload(body)
  if (!record) {
    return NextResponse.json({ error: "成绩数据无效" }, { status: 400 })
  }

  if (process.env.SUPABASE_SYNC_RECORDS !== "true") {
    return NextResponse.json({ saved: false, mode: "local" }, { status: 202 })
  }

  try {
    const supabase = getSupabase()
    if (!supabase) {
      return NextResponse.json({ saved: false, mode: "local" }, { status: 202 })
    }

    const { error } = await supabase.from("records").insert([record])
    if (error) throw error
    return NextResponse.json({ saved: true, mode: "supabase" })
  } catch {
    return NextResponse.json({ error: "成绩同步失败" }, { status: 503 })
  }
}

export async function GET() {
  if (process.env.SUPABASE_READ_SHARED_RECORDS !== "true") {
    return NextResponse.json([])
  }

  try {
    const supabase = getSupabase()
    if (!supabase) return NextResponse.json([])

    const { data, error } = await supabase
      .from("records")
      .select("id,username,total,correct,accuracy,wrong_questions,created_at")
      .order("created_at", { ascending: false })
      .limit(50)
    if (error) throw error
    return NextResponse.json(Array.isArray(data) ? data : [])
  } catch {
    return NextResponse.json({ error: "成绩读取失败" }, { status: 503 })
  }
}
