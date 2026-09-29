import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 48, fontSize: 9, fontFamily: 'Helvetica' },
  society: { fontSize: 9, color: '#666', marginBottom: 4 },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  meta: { fontSize: 10, color: '#333', marginBottom: 2 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, marginBottom: 16 },
  summaryItem: { marginRight: 24, marginBottom: 4 },
  summaryLabel: { fontSize: 8, color: '#666' },
  summaryValue: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 12, marginBottom: 6 },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 3,
    fontFamily: 'Helvetica-Bold',
  },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ccc', paddingVertical: 4 },
  num: { width: 22 },
  name: { flex: 3 },
  email: { flex: 4 },
  phone: { flex: 2.5 },
  guests: { width: 40, textAlign: 'right', paddingRight: 8 },
  payment: { flex: 2 },
  amount: { width: 90, textAlign: 'right' },
  check: { width: 50, textAlign: 'center', alignItems: 'center' },
  checkbox: { width: 9, height: 9, borderWidth: 0.75, borderColor: '#333' },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#888',
  },
})

export interface ParticipantRow {
  name: string
  email: string
  phone: string
  guestCount: number
  /** Already translated; null for free events. */
  paymentLabel: string | null
  paymentAmount: string | null
}

export interface ParticipantSection {
  title: string
  rows: ParticipantRow[]
}

export interface ParticipantsPdfData {
  societyName: string
  eventTitle: string
  eventMeta: string[]
  summary: { label: string; value: string }[]
  sections: ParticipantSection[]
  showPayment: boolean
  labels: {
    name: string
    email: string
    phone: string
    guests: string
    payment: string
    amount: string
    present: string
    generated: string
    page: string
  }
}

function ParticipantsDocument({ data }: { data: ParticipantsPdfData }) {
  const { labels, showPayment } = data
  return (
    <Document title={data.eventTitle}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {data.societyName && <Text style={styles.society}>{data.societyName}</Text>}
        <Text style={styles.title}>{data.eventTitle}</Text>
        {data.eventMeta.map((line) => (
          <Text key={line} style={styles.meta}>{line}</Text>
        ))}

        <View style={styles.summary}>
          {data.summary.map((item) => (
            <View key={item.label} style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {data.sections
          .filter((section) => section.rows.length > 0)
          .map((section) => (
            <View key={section.title}>
              <Text style={styles.sectionTitle}>
                {section.title} ({section.rows.length})
              </Text>
              <View style={styles.headerRow} fixed>
                <Text style={styles.num}>#</Text>
                <Text style={styles.name}>{labels.name}</Text>
                <Text style={styles.email}>{labels.email}</Text>
                <Text style={styles.phone}>{labels.phone}</Text>
                <Text style={styles.guests}>{labels.guests}</Text>
                {showPayment && <Text style={styles.payment}>{labels.payment}</Text>}
                {showPayment && <Text style={styles.amount}>{labels.amount}</Text>}
                <Text style={styles.check}>{labels.present}</Text>
              </View>
              {section.rows.map((row, i) => (
                <View key={i} style={styles.row} wrap={false}>
                  <Text style={styles.num}>{i + 1}</Text>
                  <Text style={styles.name}>{row.name}</Text>
                  <Text style={styles.email}>{row.email}</Text>
                  <Text style={styles.phone}>{row.phone || '—'}</Text>
                  <Text style={styles.guests}>{row.guestCount > 0 ? `+${row.guestCount}` : '—'}</Text>
                  {showPayment && <Text style={styles.payment}>{row.paymentLabel ?? '—'}</Text>}
                  {showPayment && <Text style={styles.amount}>{row.paymentAmount ?? '—'}</Text>}
                  <View style={styles.check}>
                    <View style={styles.checkbox} />
                  </View>
                </View>
              ))}
            </View>
          ))}

        <View style={styles.footer} fixed>
          <Text>{labels.generated}</Text>
          <Text
            render={({ pageNumber, totalPages }) => `${labels.page} ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}

export async function generateParticipantsPdf(data: ParticipantsPdfData): Promise<Buffer> {
  return renderToBuffer(<ParticipantsDocument data={data} />)
}
