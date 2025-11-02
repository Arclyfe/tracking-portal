import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

// ✅ Allow your Shopify storefront and main domain
app.use(cors({
  origin: ["https://jrgbun-ps.myshopify.com", "https://arclyfe.com"],
  methods: ["GET"],
  allowedHeaders: ["Content-Type", "X-Shopify-Access-Token"]
}));

// Config
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2025-10";

app.get("/", (_req, res) => {
  res.send("Tracking Portal API is live ✅");
});

app.get("/track", async (req, res) => {
  try {
    let { order, email } = req.query;
    order = (order || "").trim();
    email = (email || "").trim();

    if (!order || !email) {
      console.log("❌ Missing order or email");
      return res.json({ success: false, message: "Missing order or email" });
    }

    const shop = process.env.SHOPIFY_STORE;
    const token = process.env.SHOPIFY_ADMIN_TOKEN;

    // Normalize: accept "1297" or "#1297" in form input
    const cleanName = order.startsWith("#") ? order : `#${order}`;

    // 1) Try by order "name"
    const nameUrl = `https://${shop}/admin/api/${API_VERSION}/orders.json?name=${encodeURIComponent(cleanName)}`;
    console.log("🔍 Fetch by name:", nameUrl);

    let r = await fetch(nameUrl, {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
        "User-Agent": "Arclyfe-Tracking-App (tracking@arclyfe.com)"
      }
    });
    console.log("🧾 Name lookup status:", r.status);
    let raw = await r.text();
    console.log("📦 Name lookup raw:", raw);

    if (!r.ok) {
      return res.status(r.status).json({ success: false, message: `Shopify API Error (${r.status})`, body: raw });
    }

    let data = JSON.parse(raw);
    let orderData = data.orders?.[0];

    // 2) Fallback: if no match and input is a pure number, try treating it as the numeric order ID
    if (!orderData && /^\d+$/.test(order)) {
      const idUrl = `https://${shop}/admin/api/${API_VERSION}/orders/${order}.json`;
      console.log("🔁 Fallback by ID:", idUrl);

      const r2 = await fetch(idUrl, {
        headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" }
      });
      console.log("🧾 ID lookup status:", r2.status);
      const raw2 = await r2.text();
      console.log("📦 ID lookup raw:", raw2);

      if (r2.ok) {
        const d2 = JSON.parse(raw2);
        if (d2.order) orderData = d2.order;
      }
    }

    if (!orderData) {
      console.log("⚠️ No order found after name+ID attempts for:", order);
      return res.json({ success: false, message: "Order not found" });
    }

    // Basic email check (Shopify stores email on order)
    if ((orderData.email || "").toLowerCase() !== email.toLowerCase()) {
      console.log("⚠️ Email mismatch for", orderData.name);
      return res.json({ success: false, message: "Email mismatch" });
    }

    const f = orderData.fulfillments?.[0] || null;

    return res.json({
      success: true,
      order_number: orderData.name,
      customer: {
        name: `${orderData.customer?.first_name || ""} ${orderData.customer?.last_name || ""}`.trim(),
        email: orderData.email || null
      },
      shipping_address: orderData.shipping_address || null,
      line_items: (orderData.line_items || []).map(i => ({
        name: i.title,
        variant: i.variant_title,
        quantity: i.quantity,
        price: i.price
      })),
      tracking: f ? {
        number: f.tracking_number || null,
        carrier: f.tracking_company || null,
        status: f.shipment_status || null
      } : null
    });
  } catch (err) {
    console.error("💥 SERVER ERROR:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
});

app.listen(3000, () => console.log("✅ Tracking Portal API running on port 3000"));

