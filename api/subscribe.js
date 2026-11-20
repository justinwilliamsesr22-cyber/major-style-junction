const crypto = require("crypto");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.msj_mailchimp_key;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing msj_mailchimp_key in Vercel environment variables." });
  }

  const { email, firstName = "", tag = "VIP Drop List" } = req.body || {};
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const cleanEmail = email.trim().toLowerCase();
  const subscriberHash = crypto.createHash("md5").update(cleanEmail).digest("hex");
  const listId = "17ac9734ab";
  const authHeader = "Basic " + Buffer.from(`anystring:${apiKey}`).toString("base64");

  try {
    // 1. Add or update subscriber in your Mailchimp audience
    const memberRes = await fetch(
      `https://us3.api.mailchimp.com/3.0/lists/${listId}/members/${subscriberHash}`,
      {
        method: "PUT",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email_address: cleanEmail,
          status_if_new: "subscribed",
          status: "subscribed",
          merge_fields: {
            FNAME: firstName.trim()
          }
        })
      }
    );

    const memberData = await memberRes.json();
    if (!memberRes.ok) {
      return res.status(memberRes.status).json({
        error: memberData.detail || "Could not subscribe to Mailchimp."
      });
    }

    // 2. Apply tag in Mailchimp for segmentation
    if (tag) {
      await fetch(
        `https://us3.api.mailchimp.com/3.0/lists/${listId}/members/${subscriberHash}/tags`,
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            tags: [{ name: tag, status: "active" }]
          })
        }
      ).catch(() => {});
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};