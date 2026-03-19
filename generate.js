const fs = require("fs");
const path = require("path");

const PDFDocument = require("pdfkit");
const XLSX = require("xlsx");
const { PNG } = require("pngjs");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function money(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function writePdfInvoiceLike(outPath, docTitle, meta) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const stream = fs.createWriteStream(outPath);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);

    doc.pipe(stream);

    doc.fontSize(20).text(meta.companyName, { align: "left" });
    doc.fontSize(12).fillColor("#444").text(meta.companyAddress);
    doc.moveDown(0.6);

    doc.fillColor("#000");
    doc.fontSize(18).text(docTitle, { align: "right" });
    doc.fontSize(11).text(`${meta.docNumberLabel}: ${meta.docNumber}`, { align: "right" });
    doc.text(`Date: ${meta.date}`, { align: "right" });
    doc.moveDown(1);

    const leftX = doc.x;
    const topY = doc.y;

    doc.fontSize(11).text("Bill To:", leftX, topY, { continued: false });
    doc.fontSize(11).fillColor("#111").text(meta.billTo.name);
    doc.fillColor("#444").text(meta.billTo.address);
    doc.fillColor("#000");

    doc.moveUp(3.0);
    doc.fontSize(11).text("Ship To:", 320, topY);
    doc.fontSize(11).fillColor("#111").text(meta.shipTo.name, 320);
    doc.fillColor("#444").text(meta.shipTo.address, 320);
    doc.fillColor("#000");

    doc.moveDown(2);

    const tableTop = doc.y;
    const col = { item: 50, desc: 140, qty: 370, unit: 420, total: 490 };
    doc.fontSize(10).fillColor("#fff");
    doc.rect(50, tableTop, 495 - 50, 18).fill("#1f4e79");
    doc.text("Item", col.item, tableTop + 5);
    doc.text("Description", col.desc, tableTop + 5);
    doc.text("Qty", col.qty, tableTop + 5, { width: 40, align: "right" });
    doc.text("Unit Price", col.unit, tableTop + 5, { width: 60, align: "right" });
    doc.text("Line Total", col.total, tableTop + 5, { width: 55, align: "right" });

    doc.fillColor("#000");

    let y = tableTop + 22;
    const rowHeight = 18;

    let subtotal = 0;
    meta.items.forEach((it, idx) => {
      const lineTotal = it.qty * it.unitPrice;
      subtotal += lineTotal;

      if (idx % 2 === 0) {
        doc.rect(50, y - 2, 495 - 50, rowHeight).fill("#f3f6fa");
        doc.fillColor("#000");
      }

      doc.fontSize(10).text(it.item, col.item, y, { width: 80 });
      doc.text(it.description, col.desc, y, { width: 220 });
      doc.text(String(it.qty), col.qty, y, { width: 40, align: "right" });
      doc.text(money(it.unitPrice), col.unit, y, { width: 60, align: "right" });
      doc.text(money(lineTotal), col.total, y, { width: 55, align: "right" });

      y += rowHeight;
    });

    const tax = Math.round(subtotal * meta.taxRate * 100) / 100;
    const shipping = meta.shipping;
    const total = Math.round((subtotal + tax + shipping) * 100) / 100;

    doc.moveDown(1);
    doc.fontSize(11);

    const totalsX = 360;
    doc.text(`Subtotal: ${money(subtotal)}`, totalsX, y + 10, { align: "right", width: 185 });
    doc.text(`Tax (${Math.round(meta.taxRate * 100)}%): ${money(tax)}`, totalsX, y + 28, { align: "right", width: 185 });
    doc.text(`Shipping: ${money(shipping)}`, totalsX, y + 46, { align: "right", width: 185 });
    doc.font("Helvetica-Bold").text(`Total: ${money(total)}`, totalsX, y + 70, { align: "right", width: 185 });
    doc.font("Helvetica");

    doc.moveDown(6);
    doc.fontSize(10).fillColor("#444").text(`Terms: ${meta.terms}`);
    doc.text(`Notes: ${meta.notes}`);

    doc.end();
  });
}

function writeXlsx(outPath, sheets) {
  const wb = XLSX.utils.book_new();
  for (const sh of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sh.data);
    XLSX.utils.book_append_sheet(wb, ws, sh.name);
  }
  XLSX.writeFile(wb, outPath);
}

function writeMeetingNotes(outPath, text) {
  fs.writeFileSync(outPath, text, "utf8");
}

function writeBlueWaveLogoPng(outPath) {
  const size = 512;
  const png = new PNG({ width: size, height: size });

  function setPixel(x, y, r, g, b, a = 255) {
    const idx = (size * y + x) << 2;
    png.data[idx] = r;
    png.data[idx + 1] = g;
    png.data[idx + 2] = b;
    png.data[idx + 3] = a;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) setPixel(x, y, 0x0b, 0x4f, 0xb3, 255);
  }

  for (let x = 0; x < size; x++) {
    const t = (x / size) * Math.PI * 2;
    const mid = Math.floor(size * 0.58 + Math.sin(t) * 18);
    for (let dy = -22; dy <= 22; dy++) {
      const y = mid + dy;
      if (y >= 0 && y < size) {
        const alpha = 255 - Math.min(255, Math.floor((Math.abs(dy) / 22) * 180));
        setPixel(x, y, 255, 255, 255, alpha);
      }
    }
  }

  fs.writeFileSync(outPath, PNG.sync.write(png));
}

async function main() {
  const outDir = path.join(__dirname, "generated");
  ensureDir(outDir);

  await writePdfInvoiceLike(path.join(outDir, "AlphaTech_Sales_Order_SO-10234.pdf"), "SALES ORDER", {
    companyName: "AlphaTech",
    companyAddress: "1200 Innovation Dr\nAustin, TX 78701\nPhone: (512) 555-0199",
    docNumberLabel: "SO",
    docNumber: "SO-10234",
    date: "2026-03-19",
    billTo: { name: "NovaMart - Accounts Payable", address: "88 Commerce Ave\nDallas, TX 75201" },
    shipTo: { name: "NovaMart - Receiving", address: "91 Warehouse Rd\nDallas, TX 75201" },
    items: [
      { item: "AT-100", description: "Wireless Barcode Scanner", qty: 5, unitPrice: 79.99 },
      { item: "AT-220", description: "Thermal Receipt Printer", qty: 2, unitPrice: 189.0 },
      { item: "AT-SVC", description: "Setup & Onboarding (Remote)", qty: 1, unitPrice: 150.0 }
    ],
    taxRate: 0.0825,
    shipping: 35.0,
    terms: "Net 30",
    notes: "Thank you for your business."
  });

  await writePdfInvoiceLike(path.join(outDir, "GreenField_Purchase_Order_PO-77891.pdf"), "PURCHASE ORDER", {
    companyName: "GreenField",
    companyAddress: "455 Meadow Ln\nPortland, OR 97205\nPhone: (503) 555-0142",
    docNumberLabel: "PO",
    docNumber: "PO-77891",
    date: "2026-03-19",
    billTo: { name: "GreenField - Procurement", address: "455 Meadow Ln\nPortland, OR 97205" },
    shipTo: { name: "GreenField - Warehouse", address: "22 River Dock St\nPortland, OR 97217" },
    items: [
      { item: "GF-PLT", description: "Standard Shipping Pallet", qty: 50, unitPrice: 12.5 },
      { item: "GF-BOX", description: "Recycled Cardboard Boxes (Large)", qty: 200, unitPrice: 1.15 },
      { item: "GF-TAPE", description: "Packing Tape (6-pack)", qty: 20, unitPrice: 9.99 }
    ],
    taxRate: 0.0,
    shipping: 0.0,
    terms: "Net 15",
    notes: "Deliver Mon–Fri 9am–4pm. Include packing slip with PO number."
  });

  await writePdfInvoiceLike(path.join(outDir, "NovaMart_Invoice_INV-5567.pdf"), "INVOICE", {
    companyName: "NovaMart",
    companyAddress: "88 Commerce Ave\nDallas, TX 75201\nPhone: (214) 555-0110",
    docNumberLabel: "INV",
    docNumber: "INV-5567",
    date: "2026-03-19",
    billTo: { name: "AlphaTech - Billing", address: "1200 Innovation Dr\nAustin, TX 78701" },
    shipTo: { name: "AlphaTech - Services", address: "1200 Innovation Dr\nAustin, TX 78701" },
    items: [
      { item: "NM-MKT", description: "Co-op Marketing Placement (March)", qty: 1, unitPrice: 500.0 },
      { item: "NM-DATA", description: "Sales Analytics Export (Monthly)", qty: 1, unitPrice: 120.0 }
    ],
    taxRate: 0.0825,
    shipping: 0.0,
    terms: "Due on receipt",
    notes: "Please remit payment referencing invoice number INV-5567."
  });

  await writePdfInvoiceLike(path.join(outDir, "BlueWave_Quotation_QTN-3342.pdf"), "QUOTATION", {
    companyName: "BlueWave",
    companyAddress: "900 Harbor Blvd\nSan Diego, CA 92101\nPhone: (619) 555-0166",
    docNumberLabel: "QTN",
    docNumber: "QTN-3342",
    date: "2026-03-19",
    billTo: { name: "GreenField - Finance", address: "455 Meadow Ln\nPortland, OR 97205" },
    shipTo: { name: "GreenField - Warehouse", address: "22 River Dock St\nPortland, OR 97217" },
    items: [
      { item: "BW-CLOUD", description: "BlueWave Cloud Subscription (12 months)", qty: 1, unitPrice: 2400.0 },
      { item: "BW-SUP", description: "Priority Support (12 months)", qty: 1, unitPrice: 600.0 }
    ],
    taxRate: 0.0,
    shipping: 0.0,
    terms: "Valid for 30 days",
    notes: "Pricing excludes applicable taxes. Delivery of service upon contract signature."
  });

  writeXlsx(path.join(outDir, "AlphaTech_Inventory_Report.xlsx"), [
    { name: "Inventory", data: [
      ["SKU", "Item Name", "Category", "On Hand", "Reorder Level", "Unit Cost (USD)", "Warehouse"],
      ["AT-100", "Wireless Barcode Scanner", "Hardware", 42, 20, 49.5, "AUS-01"],
      ["AT-220", "Thermal Receipt Printer", "Hardware", 18, 10, 120.0, "AUS-01"],
      ["AT-310", "POS Tablet Stand", "Accessories", 65, 25, 18.75, "AUS-02"],
      ["AT-440", "RFID Tags (Pack of 100)", "Consumables", 110, 50, 22.0, "AUS-02"]
    ]}
  ]);

  writeXlsx(path.join(outDir, "GreenField_Supplier_List.xlsx"), [
    { name: "Suppliers", data: [
      ["Supplier Name", "Contact", "Email", "Phone", "Category", "Payment Terms"],
      ["BlueWave", "A. Rivera", "arivera@bluewave.example", "(619) 555-0166", "Software/Services", "Net 30"],
      ["AlphaTech", "M. Chen", "mchen@alphatech.example", "(512) 555-0199", "Hardware", "Net 30"],
      ["PackRight Co.", "J. Patel", "jpatel@packright.example", "(503) 555-0123", "Packaging", "Net 15"]
    ]}
  ]);

  writeMeetingNotes(path.join(outDir, "NovaMart_Meeting_Notes.txt"),
    [
      "NovaMart Weekly Ops Meeting Notes",
      "Date: 2026-03-19",
      "",
      "Attendees:",
      "- Ops: Dana W.",
      "- Sales: Miguel R.",
      "- Finance: Priya S.",
      "- IT: Jordan K.",
      "",
      "Agenda / Notes:",
      "1) Review order fulfillment SLA",
      "   - Current average ship time: 1.8 days",
      "   - Target: <= 2.0 days (on track)",
      "2) Scanner/printer rollout status (AlphaTech devices)",
      "   - Remaining stores: 4",
      "   - Training scheduled next Tuesday",
      "3) Finance: invoice reconciliation",
      "   - INV-5567 pending confirmation of marketing placement deliverable",
      "",
      "Action Items:",
      "- IT to finalize device configuration checklist (Owner: Jordan, Due: 2026-03-22)",
      "- Finance to confirm INV-5567 support docs (Owner: Priya, Due: 2026-03-20)",
      "- Ops to send updated warehouse schedule (Owner: Dana, Due: 2026-03-21)",
      ""
    ].join("\r\n")
  );

  writeBlueWaveLogoPng(path.join(outDir, "BlueWave_Logo.png"));

  console.log("Done. Files generated in:", outDir);
}

main().catch((e) => { console.error(e); process.exit(1); });
