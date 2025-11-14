// server.js - COMPLETE UPDATED VERSION WITH PROPER CORS
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

// Enhanced CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  'https://career-guidance-application-fronten-inky.vercel.app',
  'https://career-guidance-application-frontend.vercel.app',
  'https://career-guidance-application-frontend-git-main.vercel.app',
  'https://career-guidance-application-frontend-*.vercel.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list or matches wildcard pattern
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin.includes('*')) {
        const regex = new RegExp(allowedOrigin.replace('*', '.*'));
        return regex.test(origin);
      }
      return allowedOrigin === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('🚫 CORS blocked origin:', origin);
      callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: [
    'Content-Range',
    'X-Content-Range'
  ],
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests globally
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

console.log('✅ CORS configured for origins:', allowedOrigins);

// Firebase Admin initialization - ES Module version
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
  
  // Add error handling for Firestore
  db.settings({ ignoreUndefinedProperties: true });
  console.log('✅ Firestore database initialized');
  
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error);
  process.exit(1);
}

// Import routes
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import institutionRoutes from './routes/institutions.js';
import companyRoutes from './routes/companies.js';
import adminRoutes from './routes/admin.js';

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/admin', adminRoutes);

// Enhanced health check route with CORS info
app.get('/api/health', (req, res) => {
  const requestOrigin = req.headers.origin || 'No origin header';
  
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    firebase: admin.apps.length > 0 ? 'connected' : 'disconnected',
    projectId: process.env.FIREBASE_PROJECT_ID,
    cors: {
      enabled: true,
      requestOrigin: requestOrigin,
      allowedOrigins: allowedOrigins
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

// Enhanced test Firestore connection
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
        server: 'career-guidance-backend'
      });
    }
    
    res.json({ 
      message: 'Firestore connection successful',
      timestamp: new Date().toISOString(),
      documentId: testDoc.id,
      exists: testDoc.exists
    });
  } catch (error) {
    console.error('❌ Firestore test error:', error);
    res.status(500).json({ 
      error: 'Firestore connection failed',
      details: error.message,
      code: error.code
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Server Error:', error);
  
  if (error.message.includes('CORS')) {
    return res.status(403).json({ 
      error: 'CORS Error', 
      message: error.message,
      allowedOrigins: allowedOrigins 
    });
  }
  
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : error.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method 
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎯 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Firestore test: http://localhost:${PORT}/api/test-firestore`);
  console.log(`🔑 Auth routes: http://localhost:${PORT}/api/auth/`);
  console.log(`🌐 CORS enabled for:`, allowedOrigins);
  console.log(`⚡ Environment: ${process.env.NODE_ENV || 'development'}`);
});

export { db, admin };
