import express from 'express';
import router from './router';
import { errorHandler } from './middleware/errorHandler';
import cors from 'cors';
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import path from 'path';

const serverPort = process.env.SERVER_PORT || 3001;
const serverUrl = process.env.SERVER_URL + ":" + serverPort || "http://localhost:" + serverPort;
const clientUrl =  process.env.CLIENT_URL + ":" + process.env.CLIENT_PORT || "http://localhost:3002";

const app = express();
app.use(cookieParser());
app.use(cors({ origin: clientUrl, credentials: true}));
app.use("/avatars", express.static(path.join(process.cwd(), "public", "avatars")));
app.use(express.json());
app.use(router);
app.use(errorHandler);

app.listen(serverPort, () => {
  console.log("Server running on "+serverUrl);
});

export { app }