import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { user } from '@/db/schema'
import { generateUnsubscribeToken } from '@/lib/unsubscribe'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  const uid = request.nextUrl.searchParams.get('uid')

  if (!token || !uid) {
    return new NextResponse('Bad request', { status: 400 })
  }

  const expected = generateUnsubscribeToken(uid)
  if (token !== expected) {
    return new NextResponse('Invalid token', { status: 403 })
  }

  await db.update(user).set({ marketingEmails: false }).where(eq(user.id, uid))

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Unsubscribed</title></head>
<body style="font-family: Arial, sans-serif; max-width: 500px; margin: 60px auto; text-align: center; padding: 20px;">
  <h1 style="color: #492a0d;">&#10003;</h1>
  <p><strong>SV:</strong> Du har avregistrerats från marknadsföringsutskick.</p>
  <p><strong>FI:</strong> Olet peruuttanut markkinointiviestien tilauksen.</p>
  <p><strong>EN:</strong> You have been unsubscribed from marketing emails.</p>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
