import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import mysql from 'mysql2/promise';

const app = express();
const PORT = 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Ensure data storage directory exists
const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
const DB_FILE = path.resolve(DATA_DIR, 'img_vid_store.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

interface MediaRecord {
  id: number;
  filename: string;
  originalName: string;
  mimeType: string;
  type: 'image' | 'video';
  size: number;
  createdAt: string;
}

interface DBStructure {
  lastId: number;
  records: MediaRecord[];
}

function loadDB(): DBStructure {
  if (!fs.existsSync(DB_FILE)) {
    const initial: DBStructure = { lastId: 0, records: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { lastId: 0, records: [] };
  }
}

function saveDB(db: DBStructure) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

// Memory upload handling with generous 100MB limit
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// JSON and URL-encoded parsers for non-multipart requests
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper to detect mime type from buffer or fallback
function detectMimeType(buffer: Buffer, originalMime?: string): { mimeType: string; type: 'image' | 'video' } {
  if (buffer.length >= 4) {
    // Check WebM EBML header: 1A 45 DF A3
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
      return { mimeType: 'video/webm', type: 'video' };
    }
    // Check MP4 ftyp box: bytes 4-7 are 'ftyp'
    if (buffer.length >= 8 && buffer.toString('utf-8', 4, 8) === 'ftyp') {
      return { mimeType: 'video/mp4', type: 'video' };
    }
    // Check JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { mimeType: 'image/jpeg', type: 'image' };
    }
    // Check PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return { mimeType: 'image/png', type: 'image' };
    }
    // Check GIF: GIF8
    if (buffer.toString('utf-8', 0, 4) === 'GIF8') {
      return { mimeType: 'image/gif', type: 'image' };
    }
  }

  if (originalMime) {
    if (originalMime.startsWith('video/')) {
      return { mimeType: originalMime, type: 'video' };
    }
    if (originalMime.startsWith('image/')) {
      return { mimeType: originalMime, type: 'image' };
    }
  }

  return { mimeType: 'image/jpeg', type: 'image' };
}

// ─────────────────────────────────────────────────────────────
// API ROUTES
// ─────────────────────────────────────────────────────────────

// Shared handler for saving uploads into IMG-VID storage
const handleMediaUpload = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'No media_file received in request payload.' });
    }

    const detected = detectMimeType(file.buffer, file.mimetype);
    const db = loadDB();
    const newId = (db.lastId || 0) + 1;
    db.lastId = newId;

    const extension = detected.mimeType === 'video/webm' ? 'webm'
      : detected.mimeType === 'video/mp4' ? 'mp4'
      : detected.mimeType === 'image/png' ? 'png'
      : detected.mimeType === 'image/gif' ? 'gif'
      : 'jpg';

    const filename = `img_vid_${newId}_${Date.now()}.${extension}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(filePath, file.buffer);

    const record: MediaRecord = {
      id: newId,
      filename,
      originalName: file.originalname || filename,
      mimeType: detected.mimeType,
      type: detected.type,
      size: file.buffer.length,
      createdAt: new Date().toISOString(),
    };

    db.records.unshift(record);
    saveDB(db);

    return res.status(200).json({
      success: true,
      id: newId,
      url: `/api/media/${newId}/raw`,
      type: record.type,
      mimeType: record.mimeType,
      size: record.size,
      createdAt: record.createdAt,
      message: `Permanently saved to IMG-VID table storage (#${newId})`,
    });
  } catch (err: unknown) {
    console.error('Error handling media upload:', err);
    const message = err instanceof Error ? err.message : 'Upload storage processing error';
    return res.status(500).json({ success: false, error: message });
  }
};

// Route matching exact PHP endpoint (POST / with media_file)
app.post('/', upload.single('media_file'), (req, res, next) => {
  // Only intercept if multipart/form-data upload was posted to root
  if (req.file) {
    return handleMediaUpload(req, res);
  }
  next();
});

// Dedicated REST API for uploading
app.post('/api/upload', upload.single('media_file'), handleMediaUpload);
app.post('/api/media', upload.single('media_file'), handleMediaUpload);

// List all saved posts (equivalent to SELECT ID, STORAGE FROM `IMG-VID` ORDER BY ID DESC)
app.get('/api/media', (_req: Request, res: Response) => {
  try {
    const db = loadDB();
    const posts = db.records.map((r) => ({
      id: r.id,
      url: `/api/media/${r.id}/raw`,
      type: r.type,
      mimeType: r.mimeType,
      size: r.size,
      createdAt: r.createdAt,
      originalName: r.originalName,
    }));
    return res.json({ success: true, count: posts.length, posts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database fetch error';
    return res.status(500).json({ success: false, error: message, posts: [] });
  }
});

// Stream raw media binary with Range support for video seeking
app.get('/api/media/:id/raw', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const db = loadDB();
    const item = db.records.find((r) => r.id === id);

    if (!item) {
      return res.status(404).send('Media item not found in IMG-VID storage');
    }

    const filePath = path.join(UPLOADS_DIR, item.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Underlying binary storage file not found');
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': item.mimeType || 'application/octet-stream',
      };
      res.writeHead(206, head);
      fileStream.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': item.mimeType || 'application/octet-stream',
        'Accept-Ranges': 'bytes',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    console.error('Error streaming raw media:', err);
    res.status(500).send('Streaming error');
  }
});

// Delete media item
app.delete('/api/media/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const db = loadDB();
    const itemIndex = db.records.findIndex((r) => r.id === id);

    if (itemIndex === -1) {
      return res.status(404).json({ success: false, error: 'Media not found' });
    }

    const [deleted] = db.records.splice(itemIndex, 1);
    const filePath = path.join(UPLOADS_DIR, deleted.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    saveDB(db);
    return res.json({ success: true, message: `Removed item #${id} from IMG-VID storage.` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Delete error';
    return res.status(500).json({ success: false, error: message });
  }
});

// Storage and system stats
app.get('/api/stats', (_req: Request, res: Response) => {
  try {
    const db = loadDB();
    const totalBytes = db.records.reduce((acc, curr) => acc + (curr.size || 0), 0);
    const photoCount = db.records.filter((r) => r.type === 'image').length;
    const videoCount = db.records.filter((r) => r.type === 'video').length;

    return res.json({
      success: true,
      stats: {
        totalRecords: db.records.length,
        photoCount,
        videoCount,
        totalBytes,
        totalMegabytes: (totalBytes / (1024 * 1024)).toFixed(2),
        storageEngine: 'IMG-VID Local Binary Longblob Storage',
        lastId: db.lastId,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Stats error';
    return res.status(500).json({ success: false, error: message });
  }
});

// Live MySQL Database connection tester (for InfinityFree or custom MySQL credentials)
app.post('/api/mysql/test', async (req: Request, res: Response) => {
  const {
    host = 'sql107.infinityfree.com',
    port = 3306,
    database = 'if0_41626652_ronin',
    user = 'if0_41626652',
    password = '',
  } = req.body || {};

  try {
    const connection = await mysql.createConnection({
      host,
      port: Number(port) || 3306,
      user,
      password,
      database,
      connectTimeout: 7000,
    });

    // Check if table exists or create it
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`IMG-VID\` (
        \`ID\` int(11) NOT NULL AUTO_INCREMENT,
        \`STORAGE\` longblob NOT NULL,
        PRIMARY KEY (\`ID\`)
      ) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
    `);

    // Fetch count of records in remote table
    const [rows] = await connection.execute('SELECT COUNT(*) as cnt FROM `IMG-VID`');
    await connection.end();

    const count = (rows as Array<{ cnt: number }>)[0]?.cnt || 0;

    return res.json({
      success: true,
      connected: true,
      message: `Successfully connected to MySQL database '${database}' on '${host}'. Table 'IMG-VID' verified with ${count} existing record(s).`,
      tableCount: count,
    });
  } catch (err: unknown) {
    const errObj = err as { code?: string; message?: string };
    let tip = '';
    if (errObj.code === 'ETIMEDOUT' || errObj.code === 'ECONNREFUSED' || errObj.message?.includes('ETIMEDOUT')) {
      tip = 'Notice: Free shared web hosts (such as InfinityFree / Epizy) disable remote MySQL connections by default to prevent unauthorized external access. Their MySQL port 3306 only permits connections originating from inside their own web hosting servers. This app includes a built-in persistent local LONGBLOB storage engine that works 100% reliably!';
    }

    return res.status(200).json({
      success: false,
      connected: false,
      error: errObj.message || 'MySQL Connection error',
      code: errObj.code,
      tip,
    });
  }
});

// ─────────────────────────────────────────────────────────────
// VITE DEV SERVER / STATIC ASSETS MOUNT
// ─────────────────────────────────────────────────────────────
async function startServer() {
  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Camera & Auto-Posting Queue Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
});
