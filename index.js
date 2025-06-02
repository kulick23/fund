const express = require('express');
const amqp = require('amqplib');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const secret = 'your-secret-key'; // Заменить на секрет из ENV
function encrypt(text) {
  const cipher = crypto.createCipher('aes-256-ctr', secret);
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}

let donations = [];

async function sendToQueue(data) {
  const conn = await amqp.connect('amqp://rabbitmq');
  const ch = await conn.createChannel();
  await ch.assertQueue('donation-events');
  ch.sendToQueue('donation-events', Buffer.from(JSON.stringify(data)));
}

app.post('/donations', async (req, res) => {
  const donation = {
    id: Date.now().toString(),
    amount: req.body.amount,
    donor: encrypt(req.body.donor)
  };
  donations.push(donation);
  await sendToQueue(donation);
  res.status(201).json(donation);
});

app.get('/donations', (_, res) => res.json(donations));

app.get('/ping', (_, res) => res.send('pong'));
app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.get('/metrics', (_, res) => res.json({ donations: donations.length }));

app.listen(3003, () => console.log('Donation service running on 3003'));
