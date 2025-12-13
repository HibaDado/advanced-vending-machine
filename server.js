import express from "express";
import fs from "fs";
import QRCode from "qrcode";
import { randomUUID } from "crypto";
import cron from "node-cron";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

const DRINKS_FILE = "./data/drinks.json";
const PAYMENTS_FILE = "./data/payments.json";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getBaseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

// Simple health endpoint for uptime checks
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// ---- Drinks ----
app.get("/api/drinks", (req, res) => {
  const drinks = readJson(DRINKS_FILE);
  res.json(drinks);
});

app.get("/api/drinks/:id", (req, res) => {
  const drinks = readJson(DRINKS_FILE);
  const d = drinks.find(x => x.id === req.params.id);
  if (!d) return res.sendStatus(404);
  res.json(d);
});

// ✅ Stock helper (for SOLD OUT UI)
app.get("/api/stock/:id", (req, res) => {
  const drinks = readJson(DRINKS_FILE);
  const d = drinks.find(x => x.id === req.params.id);
  if (!d) return res.sendStatus(404);
  res.json({ id: d.id, stock: d.stock });
});

// ✅ Cash purchase (decrement stock for CASH path)
app.post("/api/purchase", (req, res) => {
  const { drinkId } = req.body || {};
  console.log("💰 Purchase request for drinkId:", drinkId, "type:", typeof drinkId);
  if (!drinkId) return res.status(400).json({ error: "drinkId is required" });

  const drinks = readJson(DRINKS_FILE);
  console.log("📋 Looking for drink with ID:", drinkId);
  const drink = drinks.find(d => d.id === String(drinkId));
  console.log("🔍 Found drink:", drink);
  if (!drink) return res.status(404).json({ error: "Drink not found" });

  if (drink.stock <= 0) return res.status(400).json({ error: "Sold out", stock: 0 });

  drink.stock -= 1;
  writeJson(DRINKS_FILE, drinks);

  res.json({ success: true, drinkId: drink.id, stock: drink.stock });
});

// ---- Create Payment (QR Simulation) ----
app.post("/api/payments", async (req, res) => {
  const { drinkId } = req.body || {};
  if (!drinkId) return res.status(400).json({ error: "drinkId is required" });

  const drinks = readJson(DRINKS_FILE);
  const drink = drinks.find(d => d.id === String(drinkId));
  if (!drink) return res.status(404).json({ error: "Drink not found" });
  if (drink.stock <= 0) return res.status(400).json({ error: "Sold out" });

  const payments = readJson(PAYMENTS_FILE);
  const paymentId = "p_" + randomUUID();

  payments.push({
    paymentId,
    drinkId: drink.id,
    status: "pending",
    createdAt: Date.now()
  });

  writeJson(PAYMENTS_FILE, payments);

  const baseUrl = getBaseUrl(req);
  const payUrl = `${baseUrl}/pay/${paymentId}`;
  const qr = await QRCode.toDataURL(payUrl);

  res.json({
    paymentId,
    payUrl,
    qr,
    drink: { id: drink.id, name: drink.name, price: drink.price, stock: drink.stock }
  });
});

// ---- Payment Status ----
app.get("/api/payments/:id", (req, res) => {
  const payments = readJson(PAYMENTS_FILE);
  const p = payments.find(x => x.paymentId === req.params.id);
  if (!p) return res.sendStatus(404);
  res.json(p);
});

// ---- Mobile Pay Page ----
app.get("/pay/:id", (req, res) => {
  res.sendFile(process.cwd() + "/public/pay.html");
});

// ---- Confirm Payment (Simulation) ----
app.post("/pay/:id/confirm", (req, res) => {
  const paymentId = req.params.id;

  const payments = readJson(PAYMENTS_FILE);
  const drinks = readJson(DRINKS_FILE);

  const p = payments.find(x => x.paymentId === paymentId);
  if (!p) return res.sendStatus(404);

  if (p.status === "paid") {
    return res.json({ success: true, alreadyPaid: true });
  }

  const drink = drinks.find(d => d.id === p.drinkId);
  if (!drink) return res.status(500).json({ error: "Drink missing" });
  if (drink.stock <= 0) return res.status(400).json({ error: "Sold out now", stock: 0 });

  // Mark paid + decrement stock
  p.status = "paid";
  p.paidAt = Date.now();
  drink.stock -= 1;

  writeJson(PAYMENTS_FILE, payments);
  writeJson(DRINKS_FILE, drinks);

  res.json({ success: true, drinkId: drink.id, stock: drink.stock });
});

// ---- Cancel Payment (Simulation) ----
app.post("/pay/:id/cancel", (req, res) => {
  const paymentId = req.params.id;

  const payments = readJson(PAYMENTS_FILE);
  const p = payments.find(x => x.paymentId === paymentId);
  
  if (!p) return res.sendStatus(404);
  
  if (p.status === "paid") {
    return res.status(400).json({ error: "Payment already completed" });
  }
  
  if (p.status === "canceled") {
    return res.json({ success: true, alreadyCanceled: true });
  }

  // Mark canceled
  p.status = "canceled";
  p.canceledAt = Date.now();

  writeJson(PAYMENTS_FILE, payments);

  res.json({ success: true, paymentId: p.paymentId });
});

app.listen(PORT, () => {
  console.log(`✅ Running on port ${PORT}`);

  // Cron job to ping /health every 14 minutes to keep the service warm
  const baseUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  const healthUrl = `${baseUrl}/health`;

  // Runs every 14 minutes: */14 * * * *
  cron.schedule('*/14 * * * *', async () => {
    try {
      const res = await fetch(healthUrl);
      console.log("🔁 [CRON] Health ping status:", res.status);
    } catch (err) {
      console.error("⚠️ [CRON] Health ping failed:", err.message || err);
    }
  });

  console.log("⏰ Cron job scheduled: health ping every 14 minutes");
});
