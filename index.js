const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const USERS_URL = process.env.USERS_URL;
const LOGGING_URL = process.env.LOGGING_URL;

let donations = [];

app.post('/donations', async (req, res) => {
  const { donor, amount } = req.body;
  try {
    const users = await axios.get(`${USERS_URL}/users`);
    const found = users.data.find(u => u.name === donor);
    if (!found) return res.status(404).json({ error: 'Donor not found' });

    const donation = { id: Date.now().toString(), donor, amount };
    donations.push(donation);

    // Логирование
    await axios.post(`${LOGGING_URL}/log`, {
      service: 'donation-service',
      message: `New donation from ${donor} amount ${amount}`
    });

    res.status(201).json(donation);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error processing donation' });
  }
});

app.get('/donations', (_, res) => res.json(donations));
app.get('/metrics', (_, res) => res.json({ donations: donations.length }));
app.get('/health', (_, res) => res.send('ok'));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Donation service running on ${PORT}`));
