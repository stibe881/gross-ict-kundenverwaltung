import fetch from 'node-fetch';

async function test() {
  const invoiceId = '389e154d-797e-4e9d-928e-624d9d836154'; // The invoice created just now
  console.log("Testing POST to https://kundenverwaltung.gross-ict.ch/api/send-invoice-email");
  
  try {
    const res = await fetch("https://kundenverwaltung.gross-ict.ch/api/send-invoice-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: invoiceId })
    });
    
    console.log("Status:", res.status);
    console.log("Text:", await res.text());
  } catch (e) {
    console.error("Fetch failed", e);
  }

  console.log("Testing POST to http://localhost:3000/api/send-invoice-email");
  try {
    const res2 = await fetch("http://localhost:3000/api/send-invoice-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: invoiceId })
    });
    console.log("Local Status:", res2.status);
    console.log("Local Text:", await res2.text());
  } catch (e) {
    console.error("Local fetch failed", e);
  }
}

test();
