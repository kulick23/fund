const request = require('supertest');
const app = require('../index');

describe('Donation API', () => {
  it('GET /donations returns 200', async () => {
    const res = await request(app).get('/donations');
    expect(res.statusCode).toBe(200);
  });
});