/**
 * Build a CSV string with UTF-8 BOM for Excel compatibility.
 */
export function toCsv(headers: string[], rows: string[][]): string {
  const escape = (field: string) => {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`
    }
    return field
  }

  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ]

  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}
