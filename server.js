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

// Middleware
app.use(cors());
app.use(express.json());

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

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    firebase: admin.apps.length > 0 ? 'connected' : 'disconnected',
    projectId: process.env.FIREBASE_PROJECT_ID
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
        message: 'Firestore connection test successful'
      });
    }
    
    res.json({ 
      message: 'Firestore connection successful',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Firestore connection failed',
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🎯 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Firestore test: http://localhost:${PORT}/api/test-firestore`);
  console.log(`🔑 Auth routes: http://localhost:${PORT}/api/auth/`);
  console.log(`📧 Email verification: Enabled via Firebase Auth`);
});

export { db, admin };