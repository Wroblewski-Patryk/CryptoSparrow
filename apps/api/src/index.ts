import express from 'express';
import router from './router';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import cors from 'cors';
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import path from 'path';
import helmet from 'helmet';
import { clientUrl, corsOrigins, serverPort, serverUrl } from './config/runtime';

const app = express();
app.set('trust proxy', true);
app.use(cookieParser());
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  })
);
app.use("/avatars", express.static(path.join(process.cwd(), "public", "avatars")));
app.use(express.json());
app.use(requestLogger);
app.use(router);
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(serverPort, () => {
    console.log(`Server running on ${serverUrl} (CORS: ${clientUrl})`);
  });
}

export { app }
