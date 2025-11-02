import express from "express";
import fetch from "node-fetch";

const app = express();

// Root endpoint
app.get("/", (req, res) => {
  res.send("Tracking Portal API is live ✅");
});

// ============================
// MAIN TRACKING ENDPOINT
// ============================
app.get("/track", async (req, res) => {
  const { order, email } = req.query;

  if (!order || !email) {
    return res.json({ success: false, message: "Missing order or email" });
  }

  try {
    const shop = process.env.SHOPIFY_STORE;
    const token = process.env.SHOPIFY_ADMIN_TOKEN;

    // ✅ Fetch orders by customer email (Shopify supports this)
    const response = await fetch(
      `https://${shop}/admin/api/2024-10/orders.json?email=${encodeURIComponent(email)}`,
      {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!data.orders || data.orders.length === 0) {
      return res.json({ success: false, message: "No orders found for that email." });
    }

    // ✅ Find the order that matches the provided order number (e.g., #1297)
    const orderData = data.orders.find(
      (o) => o.name === `#${order}` || o.name === order
    );

    if (!orderData) {
      return res.json({
        success: false,
        message: "Order not found for this email.",
      });
    }

    // Optional secondary email check
    if ((orderData.email || "").toLowerCase() !== (email || "").toLowerCase()) {
      return res.json({ success: false, message: "Email mismatch." });
    }

    const fulfillment = orderData.fulfillments?.[0] || null;

    // ✅ Return cleaned and formatted order info
    res.json({
      success: true,
      order_number: orderData.name,
      customer: {
        name: `${orderData.customer?.first_name || ""} ${orderData.customer?.last_name || ""}`.trim(),
        email: orderData.email || null,
      },
      shipping_address: orderData.shipping_address || null,
      line_items: (orderData.line_items || []).map((i) => ({
        name: i.title,
        variant: i.variant_title,
        quantity: i.quantity,
        price: i.price,
      })),
      tracking: fulfillment
        ? {
            number: fulfillment.tracking_number || null,
            carrier: fulfillment.tracking_company || null,
            status: fulfillment.shipment_status || null,
          }
        : null,
    });
  } catch (err) {
    console.error("💥 Server error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.listen(3000, () => console.log("✅ Tracking Portal API running on port 3000"));

