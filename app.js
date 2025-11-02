import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

// ✅ Enable CORS (so Shopify storefront can call this API)
app.use(cors({
  origin: ["https://jrgbun-ps.myshopify.com", "https://arclyfe.com"],
  methods: ["GET"],
  allowedHeaders: ["Content-Type", "X-Shopify-Access-Token"],
}));

// Health check / root
app.get("/", (req, res) => {
  res.send("Tracking Portal API is live ✅");
});

// Main tracking endpoint
app.get("/track", async (req, res) => {
  const { order, email } = req.query;

  if (!order || !email) {
    console.log("❌ Missing order or email");
    return res.json({ success: false, message: "Missing order or email" });
  }

  try {
    const shop = process.env.SHOPIFY_STORE;
    const token = process.env.SHOPIFY_ADMIN_TOKEN;

    const url = `https://${shop}/admin/api/2024-10/orders.json?name=${encodeURIComponent('#' + order)}`;
    console.log("🔍 Fetching Shopify URL:", url);

    const response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": token,
        "User-Agent": "Arclyfe-Tracking-App (tracking@arclyfe.com)",
        "Content-Type": "application/json",
      },
    });

    console.log("🧾 Shopify Response Status:", response.status);

    const text = await response.text();
    console.log("📦 Shopify Raw Response:", text);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `Shopify API Error (${response.status})`,
        body: text,
      });
    }

    const data = JSON.parse(text);
    const orderData = data.orders?.[0];

    if (!orderData) {
      console.log("⚠️ No orders found for:", order);
      return res.json({ success: false, message: "Order not found" });
    }

    if ((orderData.email || "").toLowerCase() !== (email || "").toLowerCase()) {
      console.log("⚠️ Email mismatch");
      return res.json({ success: false, message: "Email mismatch" });
    }

    const f = orderData.fulfillments?.[0] || null;

    res.json({
      success: true,
      order_number: orderData.name,
      customer: {
        name: `${orderData.customer?.first_name || ""} ${orderData.customer?.last_name || ""}`.trim(),
        email: orderData.email || null,
      },
      shipping_address: orderData.shipping_address || null,
      line_items: (orderData.line_items || []).map(i => ({
        name: i.title,
        variant: i.variant_title,
        quantity: i.quantity,
        price: i.price,
      })),
      tracking: f
        ? {
            number: f.tracking_number || null,
            carrier: f.tracking_company || null,
            status: f.shipment_status || null,
          }
        : null,
    });
  } catch (err) {
    console.error("💥 SERVER ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
});

app.listen(3000, () => console.log("✅ Tracking Portal API running on port 3000"));

