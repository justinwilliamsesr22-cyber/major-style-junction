const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

export const config = {
  api: { bodyParser: false }
};

async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end("Method Not Allowed");
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    "https://uccejmxmqbclhjgoewob.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  let event;
  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const meta = session.metadata || {};
    const items = JSON.parse(meta.cart_json || "[]");
    const shipping = session.shipping_details || session.customer_details || {};
    const addr = shipping.address || {};
    const formattedAddress = [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code, addr.country]
      .filter(Boolean)
      .join(", ");

    await supabase.from("orders").insert([{
      order_number: meta.order_number || `MSJ-${Date.now()}`,
      customer_name: shipping.name || session.customer_details?.name || "Customer",
      customer_email: session.customer_details?.email || "",
      customer_phone: session.customer_details?.phone || "",
      shipping_address: formattedAddress || "Address collected in Stripe",
      items,
      subtotal: Number(meta.subtotal || 0),
      discount_amount: Number(meta.discount_amount || 0),
      promo_code: meta.promo_code || "",
      shipping_cost: Number(meta.shipping_cost || 0),
      total: (session.amount_total || 0) / 100,
      payment_status: "Paid (Stripe)",
      fulfillment_status: "Unfulfilled",
      stripe_session_id: session.id
    }]);

    for (const item of items) {
      if (item.id && !item.id.startsWith("msj-")) {
        await supabase.rpc("decrement_product_stock", {
          p_product_id: item.id,
          p_size: item.size,
          p_qty: item.qty
        });
      }
    }

    if (meta.promo_code) {
      await supabase.rpc("increment_promo_use", { p_code: meta.promo_code });
    }
  }

  return res.status(200).json({ received: true });
};