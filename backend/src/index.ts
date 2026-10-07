import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';
import apiRoutes from './routes/apiRoutes.js';
import { initWebSocket } from './websocket/socket.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// 1. Security Headers via Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// 2. CORS configuration (allow Vercel, Render, and local development)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (
        origin.includes('vercel.app') ||
        origin.includes('localhost') ||
        origin.includes('onrender.com') ||
        FRONTEND_URL === '*' ||
        origin === FRONTEND_URL
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for production deployment
    },
    credentials: true,
  })
);

// 3. Body Parsing & Cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 4. Rate limiting for brute-force protection
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
});
app.use('/api', limiter);

// 5. Static file serving for uploaded receipts
const uploadDir = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadDir));

// 6. Health check endpoint
app.get('/health', (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'healthy',
    application: 'SVE API Server',
    systemTime: new Date().toISOString(),
    currency: 'INR (₹)',
  });
});

// 7. Mount Core API Routes
app.use('/api', apiRoutes);

// 8. Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Payment could not be completed. Please try again.',
  });
});

// 9. Initialize Real-Time WebSocket Hub
initWebSocket(server, FRONTEND_URL);

server.listen(PORT, () => {
  console.log(`🚀 SVE Production Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket real-time engine ready for ${FRONTEND_URL}`);
});
