import express from 'express';
const app = express();

app.get('/', (_, res) => {
  res.send('Hello from server!');
});

app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});
