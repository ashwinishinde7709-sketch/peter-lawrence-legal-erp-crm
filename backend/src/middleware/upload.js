import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'node:crypto';
const dir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
fs.mkdirSync(dir, { recursive: true });
const storage = multer.diskStorage({ destination: (_r,_f,cb)=>cb(null,dir), filename: (_r,f,cb)=>cb(null,`${randomUUID()}-${f.originalname.replace(/[^a-zA-Z0-9._-]/g,'_')}`) });
export const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
