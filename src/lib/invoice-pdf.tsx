import React from 'react'
import path from 'path'
import { Document, Page, Text, View, Image, Svg, Rect, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { formatReferenceNumber } from './reference-number'
import { ASSOCIATION_TIMEZONE, formatBarcodeDateInTz } from './timezone'

const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
  },
  logo: {
    width: 80,
  },
  societyName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  societyDetails: {
    fontSize: 9,
    color: '#666',
    marginBottom: 2,
  },
  invoiceTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 20,
    marginTop: 20,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: 180,
    fontFamily: 'Helvetica-Bold',
  },
  value: {
    flex: 1,
  },
  separator: {
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    marginVertical: 15,
  },
  lineItemHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 4,
    marginBottom: 8,
    fontFamily: 'Helvetica-Bold',
  },
  lineItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  descCol: {
    flex: 1,
  },
  amountCol: {
    width: 80,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: '#333',
    paddingTop: 8,
    marginTop: 8,
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    left: 50,
    right: 50,
  },
  paymentTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  paymentLabel: {
    width: 180,
    fontSize: 9,
    color: '#666',
  },
  paymentValue: {
    fontSize: 9,
  },
  barcodeSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 12,
  },
  barcodeLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 4,
  },
  virtualBarcode: {
    fontSize: 9,
    fontFamily: 'Courier',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
})

/**
 * Generate Finnish virtual barcode string (virtuaaliviivakoodi).
 * Version 4 format (national reference): 54 characters total
 * [1: version "4"][16: IBAN account][8: amount cents][3: reserved "000"][20: reference][6: due YYMMDD]
 */
function generateVirtualBarcode(
  iban: string,
  amountEur: string,
  referenceNumber: string,
  dueDate: Date,
): string {
  // Extract 16-digit account number from Finnish IBAN (remove "FI" + 2 check digits)
  const cleanIban = iban.replace(/\s/g, '').toUpperCase()
  const accountNumber = cleanIban.startsWith('FI') ? cleanIban.slice(2) : cleanIban
  const paddedAccount = accountNumber.padStart(16, '0')

  // Amount in cents, 8 digits
  const cents = Math.round(Number(amountEur) * 100)
  const paddedAmount = String(cents).padStart(8, '0')

  // National reference number, 20 digits
  const cleanRef = referenceNumber.replace(/\s/g, '')
  const paddedRef = cleanRef.padStart(20, '0')

  // Due date as YYMMDD in association timezone
  const { yy, mm, dd } = formatBarcodeDateInTz(dueDate)
  const dueDateStr = yy + mm + dd

  return '4' + paddedAccount + paddedAmount + '000' + paddedRef + dueDateStr
}

/**
 * Encode a numeric string into Code 128C barcode pattern.
 * Code 128C encodes digit pairs (00-99), required by Finnish bank barcode standard.
 * Returns array of bar widths (alternating black/white starting with black).
 */
function encodeCode128C(data: string): number[] {
  // Code 128 encoding table (values 0-106): each entry is 6 bar/space widths
  const patterns: number[][] = [
    [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],
    [1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],
    [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],
    [1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
    [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],
    [3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],
    [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],
    [1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
    [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],
    [1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],
    [2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],
    [3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
    [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2],
    [1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4],
    [1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],
    [2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1],
    [1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],[1,2,4,1,1,2],
    [1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],[2,1,2,1,4,1],
    [2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],
    [1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1],
    [1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],
    [2,1,1,4,1,2], // 103: Start A
    [2,1,1,2,1,4], // 104: Start B
    [2,1,1,2,3,2], // 105: Start C
  ]

  const startC = 105
  const stopPattern = [2,3,3,1,1,1,2]

  // In Code 128C, each symbol encodes a pair of digits (00-99)
  const values: number[] = [startC]
  for (let i = 0; i < data.length; i += 2) {
    values.push(parseInt(data.slice(i, i + 2), 10))
  }

  // Checksum: start value + sum of (value * position)
  let checksum = values[0]
  for (let i = 1; i < values.length; i++) {
    checksum += values[i] * i
  }
  checksum = checksum % 103
  values.push(checksum)

  const bars: number[] = []
  for (const val of values) {
    bars.push(...patterns[val])
  }
  bars.push(...stopPattern)

  return bars
}

interface InvoiceData {
  invoiceNumber: number
  recipientName: string
  recipientEmail: string
  description: string
  amount: string
  dueDate: Date
  referenceNumber: string
  createdAt: Date
}

interface InvoiceSettings {
  name: string
  address: string | null
  businessId: string | null
  iban: string | null
  bic: string | null
}

const logoPath = path.join(process.cwd(), 'public', 'ows_logo_small.png')

function BarcodeSection({
  iban,
  amount,
  referenceNumber,
  dueDate,
}: {
  iban: string
  amount: string
  referenceNumber: string
  dueDate: Date
}) {
  const virtualBarcode = generateVirtualBarcode(iban, amount, referenceNumber, dueDate)
  const bars = encodeCode128C(virtualBarcode)

  const barWidth = 0.8
  const barHeight = 40
  let totalWidth = 0
  for (const w of bars) totalWidth += w * barWidth
  // Add quiet zones
  const quietZone = 10
  const svgWidth = totalWidth + quietZone * 2

  let x = quietZone
  const rects: React.ReactElement[] = []
  for (let i = 0; i < bars.length; i++) {
    const w = bars[i] * barWidth
    if (i % 2 === 0) {
      rects.push(<Rect key={i} x={x} y={0} width={w} height={barHeight} fill="black" />)
    }
    x += w
  }

  return (
    <View style={styles.barcodeSection}>
      <Text style={styles.barcodeLabel}>Virtuaaliviivakoodi / Virtual barcode:</Text>
      <Text style={styles.virtualBarcode}>{virtualBarcode}</Text>
      <Svg width={svgWidth} height={barHeight} viewBox={`0 0 ${svgWidth} ${barHeight}`}>
        {rects}
      </Svg>
    </View>
  )
}

function InvoiceDocument({ invoice, settings }: { invoice: InvoiceData; settings: InvoiceSettings }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.societyName}>{settings.name}</Text>
            {settings.address && <Text style={styles.societyDetails}>{settings.address}</Text>}
            {settings.businessId && <Text style={styles.societyDetails}>Y-tunnus: {settings.businessId}</Text>}
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={logoPath} style={styles.logo} />
        </View>

        <Text style={styles.invoiceTitle}>FAKTURA / LASKU / INVOICE #{invoice.invoiceNumber}</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Datum / Päivämäärä / Date:</Text>
          <Text style={styles.value}>{invoice.createdAt.toLocaleDateString('fi-FI', { timeZone: ASSOCIATION_TIMEZONE })}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Förfallodag / Eräpäivä / Due date:</Text>
          <Text style={styles.value}>{invoice.dueDate.toLocaleDateString('fi-FI', { timeZone: ASSOCIATION_TIMEZONE })}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Referens / Viitenumero / Ref:</Text>
          <Text style={styles.value}>{formatReferenceNumber(invoice.referenceNumber)}</Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.row}>
          <Text style={styles.label}>Mottagare / Vastaanottaja / To:</Text>
          <Text style={styles.value}>{invoice.recipientName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>E-post / Sähköposti / Email:</Text>
          <Text style={styles.value}>{invoice.recipientEmail}</Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.lineItemHeader}>
          <Text style={styles.descCol}>Beskrivning / Kuvaus / Description</Text>
          <Text style={styles.amountCol}>Summa / Amount</Text>
        </View>

        <View style={styles.lineItem}>
          <Text style={styles.descCol}>{invoice.description}</Text>
          <Text style={styles.amountCol}>{'\u20AC'}{invoice.amount}</Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.descCol}>Totalt / Yhteensä / Total</Text>
          <Text style={styles.amountCol}>{'\u20AC'}{invoice.amount}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.paymentTitle}>Betalningsuppgifter / Maksutiedot / Payment details</Text>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>IBAN:</Text>
            <Text style={styles.paymentValue}>{settings.iban || ''}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>BIC:</Text>
            <Text style={styles.paymentValue}>{settings.bic || ''}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Referens / Viitenumero / Ref:</Text>
            <Text style={styles.paymentValue}>{formatReferenceNumber(invoice.referenceNumber)}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Summa / Summa / Amount:</Text>
            <Text style={styles.paymentValue}>{'\u20AC'}{invoice.amount}</Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Förfallodag / Eräpäivä / Due:</Text>
            <Text style={styles.paymentValue}>{invoice.dueDate.toLocaleDateString('fi-FI', { timeZone: ASSOCIATION_TIMEZONE })}</Text>
          </View>

          {settings.iban && (
            <BarcodeSection
              iban={settings.iban}
              amount={invoice.amount}
              referenceNumber={invoice.referenceNumber}
              dueDate={invoice.dueDate}
            />
          )}
        </View>
      </Page>
    </Document>
  )
}

export async function generateInvoicePdf(invoice: InvoiceData, settings: InvoiceSettings): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument invoice={invoice} settings={settings} />)
}
