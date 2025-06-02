const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const app = express();
app.use(express.json());

const secret = "your-secret-key";
function encrypt(text) {
  const cipher = crypto.createCipher("aes-256-ctr", secret);
  return cipher.update(text, "utf8", "hex") + cipher.final("hex");
}

let donations = [];

app.post("/donations", async (req, res) => {
  const { userId, amount } = req.body;
  try {
    const user = await axios.get(`${process.env.USER_SERVICE_URL}/users/${userId}`);
    if (!user.data) return res.status(404).json({ error: "User not found" });

    const donation = {
      id: Date.now().toString(),
      userId,
      amount,
      encrypted: encrypt(userId + amount.toString()),
    };
    donations.push(donation);

    // Optionally send to transaction-service
    await axios.post(`${process.env.TRANSACTIONS_SERVICE_URL}/transactions`, donation);

    res.status(201).json(donation);
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "Internal error" });
  }
});

app.get("/donations", (_, res) => res.json(donations));
app.get("/ping", (_, res) => res.send("pong"));
app.get("/health", (_, res) => res.json({ status: "ok" }));
app.get("/metrics", (_, res) => res.json({ donations: donations.length }));

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`Donation service running on ${PORT}`));
