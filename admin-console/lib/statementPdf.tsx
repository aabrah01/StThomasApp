import path from 'path';
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

export interface StatementData {
  churchName: string;
  churchAddress: string;
  membershipId: string;
  year: number;
  asofDate: string;
  greeting: string;
  introParagraph: string;
  closingParagraph: string;
  contributions: { category: string; amount: number }[];
  categoryAmounts: Record<string, number>;
}

const FOOTER_TEXT = 'Website: www.stthomasli.org  •  Telephone (516) 646-8263  •  Email: treasurer@stthomasli.org';

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: 'Helvetica', color: '#1a1a1a' },
  letterhead: { flexDirection: 'row', alignItems: 'center', paddingBottom: 12, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#999' },
  logo: { width: 83, height: 83, marginRight: 20 },
  letterheadText: { flex: 1, alignItems: 'center' },
  churchNameLine: { fontFamily: 'Times-Bold', fontSize: 17, color: '#000000', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center' },
  churchAddressLine: { fontFamily: 'Helvetica', fontSize: 9, color: '#000000', textTransform: 'uppercase', letterSpacing: 1, marginTop: 6, textAlign: 'center' },
  statementMeta: { marginBottom: 16 },
  statementTitle: { fontSize: 10, color: '#000000', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  membershipId: { fontSize: 9, color: '#000000', marginTop: 2 },
  greeting: { marginBottom: 12, fontWeight: 700 },
  paragraph: { marginBottom: 10, lineHeight: 1.3 },
  table: { marginTop: 8, marginBottom: 14, borderWidth: 1, borderColor: '#ddd' },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#f5f0e8', borderBottomWidth: 1, borderBottomColor: '#ddd' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tableRowLast: { flexDirection: 'row' },
  totalRow: { flexDirection: 'row', backgroundColor: '#f5f0e8', borderTopWidth: 1, borderTopColor: '#ddd' },
  cellCategory: { flex: 2, padding: 6, fontSize: 10 },
  cellAmount: { flex: 1, padding: 6, fontSize: 10, textAlign: 'right' },
  headerCell: { fontWeight: 700, fontSize: 9, textTransform: 'uppercase', color: '#5C1A1F' },
  footer: { position: 'absolute', bottom: 24, left: 48, right: 48, textAlign: 'center', fontSize: 8, color: '#000000', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 },
});

const formatMoney = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function StatementDocument({ data }: { data: StatementData }) {
  const { churchName, churchAddress, membershipId, year, asofDate, greeting, introParagraph, closingParagraph, contributions, categoryAmounts } = data;

  const byCategory = contributions.reduce<Record<string, number>>((acc, c) => {
    acc[c.category] = (acc[c.category] ?? 0) + c.amount;
    return acc;
  }, {});
  const categories = Object.keys(byCategory).sort((a, b) => (categoryAmounts[b] ?? -1) - (categoryAmounts[a] ?? -1) || a.localeCompare(b));
  const total = contributions.reduce((s, c) => s + c.amount, 0);
  const hasRequested = categories.some(c => categoryAmounts[c] != null);

  const logoPath = path.join(process.cwd(), 'public', 'logo-transparent.png');

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.letterhead}>
          <Image src={logoPath} style={styles.logo} />
          <View style={styles.letterheadText}>
            <Text style={styles.churchNameLine}>{churchName}</Text>
            <Text style={styles.churchNameLine}>Long Island, New York</Text>
            {!!churchAddress && <Text style={styles.churchAddressLine}>{churchAddress}</Text>}
          </View>
        </View>

        <View style={styles.statementMeta}>
          <Text style={styles.statementTitle}>{year} Giving Statement — as of {asofDate}</Text>
          <Text style={styles.membershipId}>Membership ID: {membershipId}</Text>
        </View>

        <Text style={styles.greeting}>{greeting}</Text>

        {introParagraph.split(/\n{2,}/).filter(Boolean).map((p, i) => (
          <Text key={i} style={styles.paragraph}>{p}</Text>
        ))}

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.cellCategory, styles.headerCell]}>Category</Text>
            {hasRequested && <Text style={[styles.cellAmount, styles.headerCell]}>Requested</Text>}
            <Text style={[styles.cellAmount, styles.headerCell]}>Given</Text>
          </View>
          {categories.map((category, i) => (
            <View key={category} style={i === categories.length - 1 ? styles.tableRowLast : styles.tableRow}>
              <Text style={styles.cellCategory}>{category}</Text>
              {hasRequested && (
                <Text style={styles.cellAmount}>
                  {categoryAmounts[category] != null ? formatMoney(categoryAmounts[category]) : '—'}
                </Text>
              )}
              <Text style={styles.cellAmount}>{formatMoney(byCategory[category])}</Text>
            </View>
          ))}
          {categories.length === 0 && (
            <View style={styles.tableRowLast}>
              <Text style={styles.cellCategory}>No contributions on record for {year}.</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={[styles.cellCategory, styles.headerCell]}>Total</Text>
            {hasRequested && <Text style={styles.cellAmount} />}
            <Text style={[styles.cellAmount, styles.headerCell]}>{formatMoney(total)}</Text>
          </View>
        </View>

        {closingParagraph.split(/\n{2,}/).filter(Boolean).map((p, i) => (
          <Text key={i} style={styles.paragraph}>{p}</Text>
        ))}

        <Text style={styles.footer} fixed>{FOOTER_TEXT}</Text>
      </Page>
    </Document>
  );
}

export async function renderStatementPdf(data: StatementData): Promise<Buffer> {
  return renderToBuffer(<StatementDocument data={data} />);
}
