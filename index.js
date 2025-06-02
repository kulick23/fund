const express = require('express');
const crypto = require('crypto');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

const secret = process.env.ENCRYPTION_SECRET || 'default-secret';
const loggingURL = process.env.LOGGING_SERVICE_URL || 'http://localhost:4000/logs';
const usersServiceURL = process.env.USERS_SERVICE_URL || 'http://localhost:3000'; // <-- Укажи реальный URL

function encrypt(text) {
  const cipher = crypto.createCipher('aes-256-ctr', secret);
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}

let donations = [];

app.post('/donations', async (req, res) => {
  try {
    const { amount, donor } = req.body;
    if (!amount || !donor) {
      return res.status(400).json({ error: 'Missing amount or donor' });
    }

    // 🔁 Получаем данные пользователя из users-service
    let userData = {};
    try {
      const userRes = await fetch(`${usersServiceURL}/users/${donor}`);
      if (userRes.ok) {
        userData = await userRes.json();
      } else {
        console.warn(`Could not fetch user ${donor}, status: ${userRes.status}`);
      }
    } catch (err) {
      console.error('Error fetching user:', err.message);
    }

    const donation = {
      id: Date.now().toString(),
      amount,
      donor: encrypt(donor),
      user: userData || null
    };

    donations.push(donation);

    // лог
    fetch(loggingURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `New donation: ${donation.id}` })
    }).catch((err) => console.error('Logging failed:', err.message));

    res.status(201).json(donation);
  } catch (err) {
    console.error('Error in /donations:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/donations', (_, res) => res.json(donations));
app.get('/ping', (_, res) => res.send('pong'));
app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.get('/metrics', (_, res) => res.json({ donations: donations.length }));

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`Donation service running on ${PORT}`));
