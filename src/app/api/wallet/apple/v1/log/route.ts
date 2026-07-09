export const runtime = 'nodejs'

/** PassKit error log sink. */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (body?.logs?.length) console.error('[ApplePassKit]', body.logs)
  } catch {
    /* ignore malformed bodies */
  }
  return new Response(null, { status: 200 })
}
