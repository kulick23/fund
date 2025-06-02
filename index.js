const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json());

const secret = 'your-secret-key';
function encrypt(text) {
  const cipher = crypto.createCipher('aes-256-ctr', secret);
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}

let donations = [];

app.post('/donations', async (req, res) => {
  const donation = {
    id: Date.now().toString(),
    amount: req.body.amount,
    donor: encrypt(req.body.donor)
  };
  donations.push(donation);

  // Пример: логгируем
  try {
    await axios.post('https://logging-service-url/logs', {
      type: 'donation',
      payload: donation
    });
  } catch (e) {
    console.error('Logging failed:', e.message);
  }

  res.status(201).json(donation);
});

app.get('/donations', (_, res) => res.json(donations));
app.get('/ping', (_, res) => res.send('pong'));
app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.get('/metrics', (_, res) => res.json({ donations: donations.length }));

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`Donation service running on ${PORT}`));
