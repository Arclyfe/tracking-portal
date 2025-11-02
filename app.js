
import express from "express";
import fetch from "node-fetch";

const app = express();

// Health check / root
app.get("/", (req, res) => {
  res.send("Tracking Portal API is live ✅");
});

// Main tracking endpoint
app.get("/track", async (req, res) => {
  const { order, email } = req.query;
  if (!order || !email) {
    return res.json({ success: false, message: "Missing order or email" });
  }

  try {
    const shop = process.env.SHOPIFY_STORE;
    const token = process.env.SHOPIFY_ADMIN_TOKEN;

    const r = await fetch(
      `https://${shop}/admin/api/2024-10/orders.json?name=${encodeURIComponent(order)}`,
      { headers: { "X-Shopify-Access-Token": token } }
    );

    const data = await r.json();
    const orderData = data.orders?.[0];

    if (!orderData) {
      return res.json({ success: false, message: "Order not found" });
    }

    if ((orderData.email || "").toLowerCase() != (email || "").toLowerCase()) {
      return res.json({ success: false, message: "Email mismatch" });
    }

    const f = (orderData.fulfillments && orderData.fulfillments[0]) || null;

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
        price: i.price
      })),
      tracking: f
        ? {
            number: f.tracking_number || null,
            carrier: f.tracking_company || null,
            status: f.shipment_status || null
          }
        : null
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Server error" });
  }
});

app.listen(3000, () => console.log("✅ Tracking Portal API running on port 3000"));
