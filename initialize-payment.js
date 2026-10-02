const https = require("https");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    const { email, amount, userId } = req.body || {};

    if (!email || !amount || !userId) {
      return res.status(400).json({
        error: "Email, amount and userId are required"
      });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      return res.status(500).json({
        error: "PAYSTACK_SECRET_KEY is not configured"
      });
    }

    const paymentAmount = Math.round(Number(amount) * 100);

    const payload = JSON.stringify({
      email,
      amount: paymentAmount,
      currency: "NGN",
      metadata: {
        userId
      },
      callback_url: `${req.headers.origin || ""}/`
    });

    const response = await new Promise((resolve, reject) => {
      const request = https.request(
        {
          hostname: "api.paystack.co",
          path: "/transaction/initialize",
          method: "POST",
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload)
          }
        },
        (paystackResponse) => {
          let data = "";

          paystackResponse.on("data", chunk => {
            data += chunk;
          });

          paystackResponse.on("end", () => {
            resolve({
              statusCode: paystackResponse.statusCode,
              data
            });
          });
        }
      );

      request.on("error", reject);
      request.write(payload);
      request.end();
    });

    return res
      .status(response.statusCode)
      .setHeader("Content-Type", "application/json")
      .send(response.data);

  } catch (error) {
    console.error("Payment initialization error:", error);

    return res.status(500).json({
      error: "Unable to initialize payment"
    });
  }
};
