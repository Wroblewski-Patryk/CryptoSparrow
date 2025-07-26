import express from 'express';
import router from './router';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(express.json());

app.use(router);

app.use(errorHandler);

app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});

export { app }