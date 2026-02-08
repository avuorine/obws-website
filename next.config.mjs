import { withBotId } from 'botid/next/config'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {}

export default withBotId(withNextIntl(nextConfig))
