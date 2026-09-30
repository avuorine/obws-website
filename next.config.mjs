import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// pdfkit (via @react-pdf/renderer) loads its built-in fonts through a
// package "imports" alias (#standard-fonts/...) that Next's file tracer
// cannot follow, so serverless bundles on Vercel ship without them and PDF
// generation fails with MODULE_NOT_FOUND. Include the directory explicitly
// for every route that renders a PDF (invoice and participant-list API
// routes, members' own invoice PDFs and the admin pages whose server
// actions send invoices).
const pdfkitFonts = ['./node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/standard-fonts/**']

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/invoices/**': pdfkitFonts,
    '/api/export/events/**': pdfkitFonts,
    '/api/members/**': pdfkitFonts,
    '/members/admin/**': pdfkitFonts,
  },
}

export default withNextIntl(nextConfig)
