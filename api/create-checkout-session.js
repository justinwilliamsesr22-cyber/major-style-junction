const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({
      error: "Card checkout is awaiting Stripe API keys. Use 'Complete Order Request' below to reserve your items immediately."
    });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const supabase = createClient(
      "https://uccejmxmqbclhjgoewob.supabase.co",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_publishable_-OiYIS2sNXTDkyhHDx3dzA_piBhRItk"
    );

    const { items = [], promoCode = "", customerEmail = "" } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Your shopping bag is empty." });
    }

    const ids = items.map((i) => i.id).filter((id) => !id.startsWith("msj-"));
    const { data: dbProducts } = await supabase.from("products").select("*").in("id", ids);
    const productMap = new Map((dbProducts || []).map((p) => [p.id, p]));

    let subtotal = 0;
    const lineItems = [];

    for (const cartItem of items) {
      const dbProd = productMap.get(cartItem.id);
      const unitPrice = dbProd ? Number(dbProd.price) : Number(cartItem.price);
      const name = dbProd ? dbProd.name : cartItem.name;

      if (dbProd && dbProd.size_stock) {
        const available = Number(dbProd.size_stock[cartItem.size] || 0);
        if (available < cartItem.qty) {
          return res.status(400).json({
            error: `Sorry, only ${available} unit(s) left for ${name} (Size ${cartItem.size}).`
          });
        }
      }

      subtotal += unitPrice * cartItem.qty;
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: `${name} — Size ${cartItem.size}`
          },
          unit_amount: Math.round(unitPrice * 100)
        },
        quantity: cartItem.qty
      });
    }

    let discountAmount = 0;
    let validCode = "";
    if (promoCode) {
      const { data: promo } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("code", promoCode.toUpperCase())
        .eq("active", true)
        .maybeSingle();

      if (promo) {
        validCode = promo.code;
        discountAmount =
          promo.discount_type === "percent"
            ? subtotal * (Number(promo.discount_value) / 100)
            : Math.min(subtotal, Number(promo.discount_value));
      }
    }

    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const shippingCost = afterDiscount >= 100 ? 0 : 8.95;

    if (shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: "Standard Tracked Shipping (Free over $100)" },
          unit_amount: Math.round(shippingCost * 100)
        },
        quantity: 1
      });
    }

    const orderNumber = `MSJ-${Math.floor(100000 + Math.random() * 900000)}`;
    const origin = req.headers.origin || "https://majorstylejunction.com";

    const sessionPayload = {
      mode: "payment",
      line_items: lineItems,
      shipping_address_collection: { allowed_countries: ["US", "CA"] },
      phone_number_collection: { enabled: true },
      success_url: `${origin}/index.html?checkout=success&order=${orderNumber}`,
      cancel_url: `${origin}/shop.html`,
      metadata: {
        order_number: orderNumber,
        promo_code: validCode,
        discount_amount: discountAmount.toFixed(2),
        shipping_cost: shippingCost.toFixed(2),
        subtotal: subtotal.toFixed(2),
        cart_json: JSON.stringify(
          items.map((i) => ({ id: i.id, name: i.name, size: i.size, qty: i.qty, price: i.price }))
        )
      }
    };

    if (customerEmail) {
      sessionPayload.customer_email = customerEmail;
    }

    if (discountAmount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(discountAmount * 100),
        currency: "usd",
        duration: "once",
        name: `Promo ${validCode}`
      });
      sessionPayload.discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create(sessionPayload);
    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};