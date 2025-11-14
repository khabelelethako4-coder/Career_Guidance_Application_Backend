// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();

// ======================
// ENHANCED MIDDLEWARE FOR FRONTEND COMPATIBILITY
// ======================

// CORS configuration for frontend compatibility
app.use(cors({
  origin: [
    'http://localhost:3000', // React dev server
    'http://localhost:5173', // Vite dev server
    'http://localhost:8080', // Vue dev server
    'https://*.vercel.app',  // All Vercel deployments
    process.env.FRONTEND_URL // Your custom frontend URL
  ].filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-Auth-Token',
    'X-API-Key'
  ],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // 24 hours
}));

// Handle preflight requests
app.options('*', cors());

// Security headers that work with frontend
app.use((req, res, next) => {
  // Remove restrictive CSP that blocks frontend scripts
  res.removeHeader('Content-Security-Policy');
  
  // Set permissive CSP for development (adjust for production)
  res.setHeader('Content-Security-Policy', 
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:; " +
    "connect-src 'self' https: wss: http://localhost:*; " +
    "style-src 'self' 'unsafe-inline' https:; " +
    "font-src 'self' https: data:; " +
    "img-src 'self' https: data: blob:;"
  );
  
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(express.json());

// ======================
// FIREBASE ADMIN INITIALIZATION
// ======================

let db;
try {
  console.log('🚀 Initializing Firebase Admin...');
  
  // Method 1: Try to load service account from file
  try {
    const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
    const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
    });
    
    console.log('✅ Firebase Admin initialized with service account');
  } catch (fileError) {
    console.log('📝 Service account file not found, trying alternative methods...');
    
    // Method 2: Try environment variables
    if (process.env.FIREBASE_PRIVATE_KEY) {
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
      };
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
      });
      
      console.log('✅ Firebase Admin initialized with environment variables');
    } else {
      // Method 3: Initialize without credentials (limited functionality)
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
      
      console.log('⚠️ Firebase Admin initialized in limited mode (no service account)');
    }
  }
  
  db = admin.firestore();
  console.log('✅ Firestore database initialized');
  
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error);
  process.exit(1);
}

// ======================
// ROUTE IMPORTS
// ======================

// Import routes
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import institutionRoutes from './routes/institutions.js';
import companyRoutes from './routes/companies.js';
import adminRoutes from './routes/admin.js';

// ======================
// ROUTES
// ======================

// Root route - Fix "Cannot GET /" error
app.get('/', (req, res) => {
  res.json({
    message: 'Career Guidance Backend API',
    status: 'Running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    endpoints: {
      root: 'GET /',
      health: 'GET /api/health',
      firestoreTest: 'GET /api/test-firestore',
      auth: 'POST /api/auth/login, POST /api/auth/register',
      students: 'GET /api/students',
      institutions: 'GET /api/institutions',
      companies: 'GET /api/companies',
      admin: 'GET /api/admin'
    },
    documentation: 'API documentation coming soon...'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/admin', adminRoutes);

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    firebase: admin.apps.length > 0 ? 'connected' : 'disconnected',
    projectId: process.env.FIREBASE_PROJECT_ID,
    environment: process.env.NODE_ENV,
    port: process.env.PORT
  });
});

// Test Firestore connection
app.get('/api/test-firestore', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Firestore not initialized' });
    }
    
    const testDoc = await db.collection('test').doc('connection').get();
    
    if (!testDoc.exists) {
      await db.collection('test').doc('connection').set({
        timestamp: new Date(),
        status: 'connected',
        message: 'Firestore connection test successful',
        environment: process.env.NODE_ENV
      });
    }
    
    res.json({ 
      message: 'Firestore connection successful',
      timestamp: new Date().toISOString(),
      documentId: 'connection'
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Firestore connection failed',
      details: error.message,
      help: 'Check Firebase service account configuration'
    });
  }
});

// ======================
// ERROR HANDLING MIDDLEWARE
// ======================

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    availableRoutes: [
      'GET /',
      'GET /api/health',
      'GET /api/test-firestore',
      'POST /api/auth/*',
      'GET /api/students/*',
      'GET /api/institutions/*',
      'GET /api/companies/*',
      'GET /api/admin/*'
    ],
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('🚨 Global error handler:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
    timestamp: new Date().toISOString()
  });
});

// ======================
// SERVER STARTUP
// ======================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🎯 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 Root URL: http://localhost:${PORT}/`);
  console.log(`🔧 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔥 Firestore test: http://localhost:${PORT}/api/test-firestore`);
  console.log(`🔑 Auth routes: http://localhost:${PORT}/api/auth/`);
  console.log(`👥 Student routes: http://localhost:${PORT}/api/students/`);
  console.log(`🏫 Institution routes: http://localhost:${PORT}/api/institutions/`);
  console.log(`💼 Company routes: http://localhost:${PORT}/api/companies/`);
  console.log(`⚡ Admin routes: http://localhost:${PORT}/api/admin/`);
  console.log(`🔒 CORS enabled for frontend compatibility`);
});

export { db, admin };
