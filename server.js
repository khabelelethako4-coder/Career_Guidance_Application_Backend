import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin with environment variables
let firebaseInitialized = false;

try {
  console.log('🚀 Initializing Firebase Admin...');
  
  // Check if we have the required environment variables
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
    console.error('❌ Missing required Firebase environment variables');
    console.log('📋 Required variables: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
    
    // Try alternative approach with service account JSON string
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('🔧 Trying FIREBASE_SERVICE_ACCOUNT environment variable...');
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      firebaseInitialized = true;
      console.log('✅ Firebase Admin initialized with FIREBASE_SERVICE_ACCOUNT');
    } else {
      throw new Error('Missing Firebase configuration. Please set Firebase environment variables.');
    }
  } else {
    // Initialize with individual environment variables
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "key-id",
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID || "client-id",
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
      storageBucket: `${process.env.FIREBASE_PROJECT_ID}.appspot.com`
    });
    
    firebaseInitialized = true;
    console.log('✅ Firebase Admin initialized with environment variables');
  }
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error);
  console.log('⚠️ Firebase features will be disabled');
}

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration
const allowedOrigins = [
  'https://career-guidance-application-fronten-inky.vercel.app',
  'https://career-guidance-appl-git-a985c3-khabelelethako4-coders-projects.vercel.app',
  'https://career-guidance-application-frontend-stcg-9tiekzm6v.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or server-to-server requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if the origin is in the allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // Also allow any Vercel preview deployments that match your project pattern
      const isVercelPreview = origin && (
        origin.includes('career-guidance-application') ||
        origin.includes('career-guidance-appl') ||
        origin.endsWith('.vercel.app')
      );
      
      if (isVercelPreview) {
        console.log('✅ Allowing Vercel preview deployment:', origin);
        callback(null, true);
      } else {
        console.log('🚫 CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
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
    'x-auth-token'
  ],
  optionsSuccessStatus: 200
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests for all routes
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Career Guidance Backend is running',
    timestamp: new Date().toISOString(),
    firebase: firebaseInitialized ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development',
    allowedOrigins: allowedOrigins
  });
});

// Auth middleware to verify Firebase tokens
const authenticateFirebaseToken = async (req, res, next) => {
  // Skip auth if Firebase is not initialized
  if (!firebaseInitialized) {
    return res.status(503).json({ 
      error: 'Authentication service temporarily unavailable',
      details: 'Firebase Admin SDK not properly initialized. Please check environment variables.'
    });
  }

  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      req.user = decodedToken;
      next();
    } catch (firebaseError) {
      console.error('Firebase token verification failed:', firebaseError);
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// ============================================================================
// ADDED AUTH ROUTES - These were missing and causing 404 errors
// ============================================================================

// POST /api/auth/login - For Firebase Auth login with ID token
app.post('/api/auth/login', async (req, res) => {
  console.log('🔐 Processing login request...');
  
  try {
    const { idToken } = req.body;

    if (!idToken) {
      console.log('❌ No ID token provided');
      return res.status(400).json({ error: 'ID token is required' });
    }

    console.log('🔑 Verifying ID token...');

    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    console.log('✅ ID token verified for user:', decodedToken.email);

    // Get user from Firestore
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      console.log('❌ User not found in Firestore:', decodedToken.uid);
      return res.status(404).json({ 
        error: 'User profile not found. Please complete registration.' 
      });
    }

    const userData = userDoc.data();

    // Check if email is verified using Firebase Auth data
    if (!decodedToken.email_verified) {
      console.log('❌ Email not verified for user:', decodedToken.email);
      return res.status(401).json({ 
        error: 'Please verify your email before logging in.',
        needsVerification: true,
        email: decodedToken.email
      });
    }

    console.log('✅ Login successful for user:', decodedToken.email);
    
    res.json({
      message: 'Login successful',
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: userData.role,
        profile: userData.profile,
        isVerified: true
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(401).json({ 
      error: 'Invalid credentials',
      details: error.message 
    });
  }
});

// POST /api/auth/create-profile - For creating user profile after Firebase Auth registration
app.post('/api/auth/create-profile', async (req, res) => {
  console.log('🚀 Starting profile creation...');
  
  try {
    const { uid, email, role, profile } = req.body;

    // Validate required fields
    if (!uid || !email || !role || !profile) {
      console.log('❌ Missing required fields for profile creation');
      return res.status(400).json({ 
        error: 'Missing required fields: uid, email, role, and profile are required'
      });
    }

    // Validate profile fields
    if (!profile.firstName || !profile.lastName) {
      console.log('❌ Missing profile fields');
      return res.status(400).json({ 
        error: 'Missing profile fields: firstName and lastName are required'
      });
    }

    // Check if user already exists in Firestore
    const existingUser = await admin.firestore().collection('users').doc(uid).get();
    if (existingUser.exists) {
      console.log('❌ User profile already exists in Firestore');
      return res.status(400).json({ 
        error: 'User profile already exists. Please login instead.' 
      });
    }

    // Verify the UID exists in Firebase Auth
    try {
      const authUser = await admin.auth().getUser(uid);
      console.log('✅ Verified Firebase Auth user exists:', authUser.email);
    } catch (authError) {
      console.error('❌ Firebase Auth user not found for UID:', uid);
      return res.status(400).json({ 
        error: 'Invalid user ID. Please register again.' 
      });
    }

    // Create user profile in Firestore
    const userData = {
      uid: uid,
      email: email.trim().toLowerCase(),
      role,
      profile: {
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        phone: profile.phone?.trim() || '',
        ...(role === 'student' && {
          studentId: profile.studentId || '',
          major: profile.major || ''
        }),
        ...(role === 'company' && {
          companyName: profile.companyName || '',
          position: profile.position || ''
        }),
        ...(role === 'institution' && {
          institutionId: profile.institutionId,
          institutionName: profile.institutionName
        })
      },
      isVerified: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await admin.firestore().collection('users').doc(uid).set(userData);
    console.log('✅ User profile created in Firestore:', {
      uid,
      email: userData.email,
      role: userData.role
    });

    res.status(201).json({
      message: 'Profile created successfully! Please verify your email before logging in.',
      uid,
      email: userData.email,
      role,
      profile: userData.profile,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Profile creation error:', error);
    res.status(400).json({ 
      error: 'Profile creation failed',
      details: error.message 
    });
  }
});

// POST /api/auth/resend-verification - For resending email verification
app.post('/api/auth/resend-verification', async (req, res) => {
  console.log('📧 Processing resend verification request...');
  
  try {
    const { email } = req.body;

    if (!email) {
      console.log('❌ No email provided for resend verification');
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log('🔍 Looking up user by email:', email);

    // Get user by email
    const userRecord = await admin.auth().getUserByEmail(email);
    console.log('✅ User found for verification resend:', userRecord.uid);

    // Generate email verification link
    const verificationLink = await admin.auth().generateEmailVerificationLink(email);
    
    console.log('✅ Verification link generated for:', email);

    const response = {
      message: 'Verification email sent successfully!',
      emailSent: true,
      email: email
    };

    // Only return verification link in development for testing
    if (process.env.NODE_ENV === 'development') {
      response.verificationLink = verificationLink;
      console.log('🔗 Development verification link:', verificationLink);
    }

    res.json(response);
  } catch (error) {
    console.error('❌ Resend verification error:', error);
    
    let errorMessage = 'Failed to resend verification email';
    
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'No user found with this email address.';
    }
    
    res.status(400).json({ 
      error: errorMessage,
      details: error.message 
    });
  }
});

// ============================================================================
// EXISTING ROUTES (Keep your original routes)
// ============================================================================

// User registration endpoint
app.post('/api/register', authenticateFirebaseToken, async (req, res) => {
  if (!firebaseInitialized) {
    return res.status(503).json({ 
      error: 'Service temporarily unavailable',
      details: 'Database service not initialized'
    });
  }

  try {
    const { firstName, lastName, phone, companyName, position, role } = req.body;
    const userId = req.user.uid;
    const email = req.user.email;

    // Validate required fields
    if (!firstName || !lastName || !phone || !role) {
      return res.status(400).json({ 
        error: 'Missing required fields: firstName, lastName, phone, role' 
      });
    }

    // Additional validation for company role
    if (role === 'company' && (!companyName || !position)) {
      return res.status(400).json({ 
        error: 'Company registration requires companyName and position' 
      });
    }

    // Create user profile in Firestore
    const userProfile = {
      uid: userId,
      email: email,
      firstName,
      lastName,
      phone,
      role,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Add role-specific fields
    if (role === 'company') {
      userProfile.companyName = companyName;
      userProfile.position = position;
      userProfile.companyProfile = {
        name: companyName,
        position: position,
        verified: false
      };
    }

    // Save to Firestore
    await admin.firestore().collection('users').doc(userId).set(userProfile);

    console.log(`✅ User profile created for: ${email} (${role})`);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        uid: userId,
        email: email,
        role: role,
        profile: userProfile
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Internal server error during registration',
      details: error.message 
    });
  }
});

// Get user profile endpoint
app.get('/api/user/profile', authenticateFirebaseToken, async (req, res) => {
  if (!firebaseInitialized) {
    return res.status(503).json({ 
      error: 'Service temporarily unavailable',
      details: 'Database service not initialized'
    });
  }

  try {
    const userId = req.user.uid;
    
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userData = userDoc.data();
    
    // Remove sensitive data if needed
    delete userData.updatedAt;
    
    res.status(200).json({
      success: true,
      user: userData
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user profile',
      details: error.message 
    });
  }
});

// Test endpoint to verify CORS is working
app.get('/api/test-cors', (req, res) => {
  res.status(200).json({
    message: 'CORS is working!',
    allowedOrigins: allowedOrigins,
    yourOrigin: req.headers.origin || 'No origin header',
    timestamp: new Date().toISOString(),
    firebase: firebaseInitialized ? 'connected' : 'disconnected'
  });
});

// Test Firebase connection endpoint
app.get('/api/test-firebase', async (req, res) => {
  if (!firebaseInitialized) {
    return res.status(503).json({ 
      error: 'Firebase not initialized',
      details: 'Please check your Firebase environment variables'
    });
  }

  try {
    // Test Firestore connection
    const testDoc = await admin.firestore().collection('test').doc('connection').get();
    
    if (!testDoc.exists) {
      await admin.firestore().collection('test').doc('connection').set({
        timestamp: new Date(),
        status: 'connected',
        message: 'Firestore connection test successful'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Firebase connection successful',
      firestore: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Firebase test error:', error);
    res.status(500).json({
      error: 'Firebase connection failed',
      details: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Origin not allowed',
      yourOrigin: req.headers.origin,
      allowedOrigins: allowedOrigins
    });
  }
  
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Career Guidance Backend running on port ${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔥 Firebase: ${firebaseInitialized ? '✅ Initialized' : '❌ Disabled'}`);
  console.log('✅ Available Auth Endpoints:');
  console.log('   - POST /api/auth/login');
  console.log('   - POST /api/auth/create-profile');
  console.log('   - POST /api/auth/resend-verification');
  console.log('   - POST /api/register');
  console.log('   - GET /api/user/profile');
  console.log('✅ Allowed CORS origins:');
  allowedOrigins.forEach(origin => console.log(`   - ${origin}`));
  
  if (!firebaseInitialized) {
    console.log('❌ Firebase is not initialized. Please check your environment variables:');
    console.log('   - FIREBASE_PROJECT_ID');
    console.log('   - FIREBASE_PRIVATE_KEY'); 
    console.log('   - FIREBASE_CLIENT_EMAIL');
    console.log('   - Or FIREBASE_SERVICE_ACCOUNT (full JSON string)');
  }
});

export default app;
