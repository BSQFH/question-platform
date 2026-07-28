import test from "node:test"
import assert from "node:assert/strict"
import { fetchAllRemoteQuestions } from "../app/lib/supabaseQuestions.js"

function createSupabaseStub(rows) {
  const ranges = []
  const query = {
    select: () => query,
    order: () => query,
    range: async (from, to) => {
      ranges.push([from, to])
      return { data: rows.slice(from, to + 1), error: null }
    }
  }

  return {
    client: { from: () => query },
    ranges
  }
}

test("loads every Supabase question page in a stable order", async () => {
  const rows = Array.from({ length: 2_501 }, (_, index) => ({ id: index + 1 }))
  const { client, ranges } = createSupabaseStub(rows)

  const result = await fetchAllRemoteQuestions(client, 1_000)

  assert.equal(result.length, rows.length)
  assert.deepEqual(result.map((item) => item.id), rows.map((item) => item.id))
  assert.deepEqual(ranges, [[0, 999], [1000, 1999], [2000, 2999]])
})

test("rejects a partial Supabase result when any page fails", async () => {
  const query = {
    select: () => query,
    order: () => query,
    range: async (from) => from === 0
      ? { data: Array.from({ length: 2 }, (_, id) => ({ id })), error: null }
      : { data: null, error: new Error("request failed") }
  }

  await assert.rejects(
    fetchAllRemoteQuestions({ from: () => query }, 2),
    /request failed/
  )
})
