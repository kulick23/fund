const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json());

const secret = process.env.SECRET_KEY || 'your-secret-key';
const USERS_SERVICE_URL = process.env.USERS_SERVICE_URL || 'https://users-service-danila-d3fed8hzfpcwbshf.westeurope-01.azurewebsites.net';

function encrypt(text) {
  const cipher = crypto.createCipher('aes-256-ctr', secret);
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}

let donations = [];

app.post('/donations', async (req, res) => {
  const { amount, donor } = req.body;

  try {
    // Проверка существования пользователя
    const usersResponse = await axios.get(`${USERS_SERVICE_URL}/users`);
    const users = usersResponse.data;
    const userExists = users.some(user => user.name === encrypt(donor));

    if (!userExists) {
      return res.status(400).json({ error: 'User not found' });
    }

    const donation = {
      id: Date.now().toString(),
      amount,
      donor: encrypt(donor)
    };
    donations.push(donation);

    res.status(201).json(donation);
  } catch (error) {
    console.error('Error processing donation:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/donations', (_, res) => res.json(donations));

app.get('/ping', (_, res) => res.send('pong'));
app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.get('/metrics', (_, res) => res.json({ donations: donations.length }));

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`Donation service running on ${PORT}`));
