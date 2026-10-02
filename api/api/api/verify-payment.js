const https = require("https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  });
}

const db = admin.firestore();

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    const reference = req.query.reference;

    if (!reference) {
      return res.status(400).json({
        error: "Payment reference is required"
      });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      return res.status(500).json({
        error: "PAYSTACK_SECRET_KEY is not configured"
      });
    }

    const response = await new Promise((resolve, reject) => {
      const request = https.request(
        {
          hostname: "api.paystack.co",
          path: `/transaction/verify/${encodeURIComponent(reference)}`,
          method: "GET",
          headers: {
            Authorization: `Bearer ${secretKey}`
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
      request.end();
    });

    const paystackData = JSON.parse(response.data);

    if (
      response.statusCode !== 200 ||
      !paystackData.status ||
      !paystackData.data
    ) {
      return res.status(400).json({
        error: "Payment verification failed"
      });
    }

    const payment = paystackData.data;

    if (payment.status !== "success") {
      return res.status(400).json({
        error: "Payment was not successful",
        status: payment.status
      });
    }

    const userId = payment.metadata?.userId;

    if (!userId) {
      return res.status(400).json({
        error: "User ID was not found in payment"
      });
    }

    const expectedAmount = 5000 * 100;

    if (Number(payment.amount) !== expectedAmount) {
      return res.status(400).json({
        error: "Payment amount is incorrect"
      });
    }

    const proUntil = new Date();

    proUntil.setDate(
      proUntil.getDate() + 30
    );

    await db.collection("users").doc(userId).set(
      {
        isPro: true,
        proUntil: proUntil.toISOString(),
        lastPaymentReference: reference,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      {
        merge: true
      }
    );

    return res.status(200).json({
      success: true,
      isPro: true,
      proUntil: proUntil.toISOString()
    });

  } catch (error) {
    console.error(
      "Payment verification error:",
      error
    );

    return res.status(500).json({
      error: "Unable to verify payment"
    });
  }
};
