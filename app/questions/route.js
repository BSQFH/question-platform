import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { fallbackQuestions } from "../data/questions"
import { normalizeQuestions } from "../lib/quiz"
import { fetchAllRemoteQuestions } from "../lib/supabaseQuestions.js"

function fallbackResponse() {
  return NextResponse.json(normalizeQuestions(fallbackQuestions), {
    headers: { "X-Question-Source": "built-in" }
  })
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) return fallbackResponse()

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
    const data = await fetchAllRemoteQuestions(supabase)

    const questions = normalizeQuestions(data)
    if (!questions.length) return fallbackResponse()

    return NextResponse.json(questions, {
      headers: { "X-Question-Source": "supabase" }
    })
  } catch {
    return fallbackResponse()
  }
}
