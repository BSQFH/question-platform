export async function fetchAllRemoteQuestions(supabase, pageSize = 1000) {
  const rows = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error

    const page = Array.isArray(data) ? data : []
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}
