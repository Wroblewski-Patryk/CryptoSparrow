import express from 'express';
import router from './router';
import { errorHandler } from './middleware/errorHandler';
import cors from 'cors';
import 'dotenv/config';
import cookieParser from 'cookie-parser';

const app = express();

app.use(cookieParser());

app.use(cors({
  origin: 'http://localhost:3002',
  credentials: true,
}));

app.use(express.json());
app.use(router);
app.use(errorHandler);

app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});

export { app }