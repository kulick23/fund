const express = require('express');
const crypto = require('crypto');
const fetch = require('node-fetch');
const amqplib = require('amqplib');
const NodeCache = require('node-cache');

// добавляем подключение dotenv и MongoDB
require('dotenv').config();
const { MongoClient } = require('mongodb');

const mongoUrl = process.env.MONGO_URL;
let db;

MongoClient.connect(mongoUrl, { useUnifiedTopology: true })
  .then(client => {
    db = client.db(); // или client.db('название_базы_данных')
    console.log("Connected to MongoDB");
  })
  .catch(err => {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });

const app = express();
app.use(express.json());

const secret = process.env.ENCRYPTION_SECRET || 'default-secret';
const loggingURL = process.env.LOGGING_SERVICE_URL || 'http://localhost:4000/logs';
const usersServiceURL = process.env.USERS_SERVICE_URL || 'http://localhost:3000';
const amqpURL = process.env.AMQP_URL || 'amqp://localhost';

const userCache = new NodeCache({ stdTTL: 60 });
let channel = null;

// RabbitMQ setup
async function connectQueue() {
  try {
    const conn = await amqplib.connect(amqpURL);
    channel = await conn.createChannel();
    await channel.assertQueue('donations');
    console.log('Connected to RabbitMQ');
  } catch (err) {
    console.error('RabbitMQ connection error:', err);
  }
}
connectQueue();

function encrypt(text) {
  const cipher = crypto.createCipher('aes-256-ctr', secret);
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}

app.post('/donations', async (req, res) => {
  try {
    const { amount, donor } = req.body;
    if (!amount || !donor) {
      return res.status(400).json({ error: 'Missing amount or donor' });
    }

    // 🧠 Caching user lookup
    let userData = userCache.get(donor);
    if (!userData) {
      try {
        const userRes = await fetch(`${usersServiceURL}/users/${donor}`);
        if (userRes.ok) {
          userData = await userRes.json();
          userCache.set(donor, userData);
        } else {
          console.warn(`User ${donor} not found`);
          userData = {};
        }
      } catch (err) {
        console.error('User fetch error:', err.message);
        userData = {};
      }
    }

    const donation = {
      id: Date.now().toString(),
      amount,
      donor: encrypt(donor),
      user: userData,
    };

    // сохраняем в MongoDB
    await db.collection('donations').insertOne(donation);

    // 📨 Send to queue
    if (channel) {
      channel.sendToQueue('donations', Buffer.from(JSON.stringify(donation)));
    }

    // лог
    fetch(loggingURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `New donation: ${donation.id}` }),
    }).catch(err => console.error('Logging failed:', err.message));

    res.status(201).json(donation);
  } catch (err) {
    console.error('Donation error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// заменяем получение всех пожертвований из in-memory на MongoDB
app.get('/donations', async (_, res) => {
  const donations = await db.collection('donations').find().toArray();
  res.json(donations);
});

app.get('/ping', (_, res) => res.send('pong'));
app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.get('/metrics', (_, res) => res.json({ donations: donations.length }));

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`Donation service running on ${PORT}`));
