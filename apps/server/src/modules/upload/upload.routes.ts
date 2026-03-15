import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { sendError } from '../../utils/apiError';

const uploadRouter = Router();

const tmpDir = path.join(process.cwd(), 'tmp');
const avatarDir = path.join(process.cwd(), 'public', 'avatars');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const upload = multer({ dest: tmpDir });

uploadRouter.post('/avatar', upload.single('avatar'), async (req, res) => {
  if (!req.file) return sendError(res, 400, 'Missing file');

  const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
  const outFilename = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
  const outPath = path.join(avatarDir, outFilename);

  try {
    await sharp(req.file.path).resize(150, 150).jpeg({ quality: 80 }).toFile(outPath);

    fs.unlinkSync(req.file.path);
    const serverUrl =
      process.env.SERVER_URL + ':' + process.env.SERVER_PORT || 'http://localhost:3001';
    const url = serverUrl + '/avatars/' + outFilename;
    return res.json({ url });
  } catch {
    fs.unlinkSync(req.file.path);
    return sendError(res, 500, 'Image processing failed');
  }
});

export default uploadRouter;
