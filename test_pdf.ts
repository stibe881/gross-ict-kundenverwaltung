import fs from 'fs';
import { generateInvoicePDF, InvoiceData } from './supabase/functions/send-invoice-email/pdf-generator.ts';

const data: InvoiceData = {
  invoiceNumber: 'RE-2026-001',
  invoiceDate: '2026-03-13T10:17:08.429007+00:00',
  dueDate: '2026-04-12T10:17:08.429007+00:00',
  customerName: 'Max Mustermann',
  customerAddress: 'Max Mustermann\nMusterstrasse 12\n8000 Zürich\nSchweiz',
  items: [
    { description: 'IT Support Stundensatz', quantity: 2, unitPrice: 150, vatRate: 8.1, total: 300 },
    { description: 'Microsoft 365 Business Premium Lizenzen (Jährlich)\nInklusive Setup und Migration', quantity: 5, unitPrice: 240, vatRate: 8.1, total: 1200 }
  ],
  subtotal: 1500,
  totalVat: 121.5,
  total: 1621.5,
  notes: 'Vielen Dank für Ihren Auftrag.\nBei Fragen stehen wir Ihnen gerne zur Verfügung.'
};

const base64 = generateInvoicePDF(data);
fs.writeFileSync('test_invoice.pdf', Buffer.from(base64, 'base64'));
console.log('test_invoice.pdf generated');
