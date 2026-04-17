import { generateInvoicePDF } from "./server/pdf-generator";
const data = {
  invoiceNumber: "INV-123",
  invoiceDate: "",
  dueDate: "",
  customerName: "Test Customer",
  customerAddress: "Test Address",
  items: [
    { description: "Test Item", quantity: 1, unitPrice: 100, vatRate: 8.1, total: 100 }
  ],
  subtotal: 100,
  totalVat: 8.1,
  total: 108.1
};

generateInvoicePDF(data).then(() => {
  console.log("Success");
}).catch((e) => {
  console.error("Failed:", e);
});
