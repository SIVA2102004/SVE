import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadToSupabase } from '../utils/supabaseStorage.js';
import { Request, Response, NextFunction } from 'express';

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Keep a disk storage backup in case Supabase is offline
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `doc-${uniqueSuffix}${ext}`);
  },
});

const baseMulter = multer({
  storage: diskStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, WEBP and PDF documents are allowed.'));
    }
  },
});

/**
 * Middleware that wraps multer single upload and automatically pushes the file
 * to Supabase Storage, setting `req.fileUrl` to the online CDN URL.
 */
export const uploadMiddleware = {
  single: (fieldName: string) => {
    const multerSingle = baseMulter.single(fieldName);

    return (req: Request, res: Response, next: NextFunction) => {
      multerSingle(req, res, async (err: any) => {
        if (err) return next(err);

        if (req.file) {
          try {
            // Read the uploaded file and upload to Supabase Storage
            const fileBuffer = fs.readFileSync(req.file.path);
            const publicUrl = await uploadToSupabase(
              fileBuffer,
              req.file.originalname,
              req.file.mimetype
            );

            if (publicUrl) {
              (req as any).fileUrl = publicUrl;
              (req.file as any).cloudUrl = publicUrl;
            } else {
              // Fallback to local /uploads/
              (req as any).fileUrl = `/uploads/${req.file.filename}`;
            }
          } catch (cloudErr) {
            console.error('[Upload Middleware] Cloud sync error, using local fallback:', cloudErr);
            (req as any).fileUrl = `/uploads/${req.file.filename}`;
          }
        }
        next();
      });
    };
  },
};
