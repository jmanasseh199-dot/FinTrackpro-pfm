const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

module.exports = async (req, res) => {
  try {
    const uid = req.query.uid;

    if (!uid) {
      return res.status(400).json({
        error: "Missing user ID",
      });
    }

    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(200).json({
        pro: false,
      });
    }

    const data = userDoc.data();

    return res.status(200).json({
      pro: data.pro === true,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Pro status check failed",
    });
  }
};
