import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { formatCurrency, formatDate } from "./format";

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
}

interface InvoiceData {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  customer_name: string;
  customer_address: string;
  customer_city: string;
  customer_zip: string;
  items: InvoiceItem[];
  notes?: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
  },
  companyInfo: {
    textAlign: "right",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    marginBottom: 5,
  },
  label: {
    width: 120,
    fontWeight: "bold",
  },
  value: {
    flex: 1,
  },
  table: {
    marginTop: 20,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    padding: 8,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    padding: 8,
  },
  col1: { width: "50%" },
  col2: { width: "15%", textAlign: "right" },
  col3: { width: "15%", textAlign: "right" },
  col4: { width: "20%", textAlign: "right" },
  summary: {
    marginLeft: "auto",
    width: 200,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  summaryLabel: {
    fontWeight: "bold",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 2,
    borderTopColor: "#000",
    fontSize: 12,
    fontWeight: "bold",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#666",
  },
});

export function InvoicePDF({ data }: { data: InvoiceData }) {
  const calculateSubtotal = () => {
    return data.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  };

  const calculateVAT = () => {
    return data.items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unit_price;
      return sum + (itemTotal * item.vat_rate) / 100;
    }, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateVAT();
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "bold" }}>Gross ICT</Text>
            <Text>Musterstrasse 123</Text>
            <Text>8000 Zürich</Text>
            <Text>Schweiz</Text>
            <Text style={{ marginTop: 10 }}>Tel: +41 44 123 45 67</Text>
            <Text>E-Mail: info@gross-ict.ch</Text>
          </View>
          <View style={styles.companyInfo}>
            <Text style={{ fontSize: 14, fontWeight: "bold" }}>RECHNUNG</Text>
            <Text style={{ marginTop: 10 }}>Nr: {data.invoice_number}</Text>
            <Text>Datum: {formatDate(data.invoice_date)}</Text>
            <Text>Fällig: {formatDate(data.due_date)}</Text>
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rechnungsempfänger</Text>
          <Text>{data.customer_name}</Text>
          <Text>{data.customer_address}</Text>
          <Text>
            {data.customer_zip} {data.customer_city}
          </Text>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Beschreibung</Text>
            <Text style={styles.col2}>Menge</Text>
            <Text style={styles.col3}>Preis</Text>
            <Text style={styles.col4}>Betrag</Text>
          </View>
          {data.items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.col1}>{item.description}</Text>
              <Text style={styles.col2}>{item.quantity}</Text>
              <Text style={styles.col3}>{formatCurrency(item.unit_price)}</Text>
              <Text style={styles.col4}>{formatCurrency(item.quantity * item.unit_price)}</Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Zwischensumme:</Text>
            <Text>{formatCurrency(calculateSubtotal())}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>MwSt:</Text>
            <Text>{formatCurrency(calculateVAT())}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>TOTAL:</Text>
            <Text>{formatCurrency(calculateTotal())}</Text>
          </View>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={[styles.section, { marginTop: 30 }]}>
            <Text style={styles.sectionTitle}>Bemerkungen</Text>
            <Text>{data.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Gross ICT | MWST-Nr: CHE-123.456.789 MWST</Text>
          <Text>Bank: UBS | IBAN: CH12 3456 7890 1234 5678 9 | BIC: UBSWCHZH80A</Text>
          <Text>Zahlbar innert 30 Tagen netto</Text>
        </View>
      </Page>
    </Document>
  );
}
