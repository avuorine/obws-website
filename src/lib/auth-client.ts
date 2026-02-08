'use client'

import { createAuthClient } from 'better-auth/react'
import { adminClient, inferAdditionalFields, magicLinkClient } from 'better-auth/client/plugins'
import { passkeyClient } from '@better-auth/passkey/client'
import type { auth } from './auth'

export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    inferAdditionalFields<typeof auth>(),
    magicLinkClient(),
    passkeyClient(),
  ],
})
