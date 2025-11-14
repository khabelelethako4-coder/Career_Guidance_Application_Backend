// routes/auth.js
import express from 'express';
import admin from 'firebase-admin';

const router = express.Router();

// Enhanced debug middleware
router.use((req, res, next) => {
  console.log('📨 Incoming request:', {
    method: req.method,
    path: req.path,
    body: req.body ? { ...req.body, password: req.body.password ? '[HIDDEN]' : undefined } : 'No body',
    query: req.query,
    timestamp: new Date().toISOString()
  });
  next();
});

// Root endpoint
router.get('/', (req, res) => {
  console.log('✅ Auth root endpoint hit');
  res.json({ 
    message: 'Auth API is working!',
    endpoints: [
      'POST /login',
      'POST /create-profile', 
      'POST /resend-verification',
      'GET /test',
      'GET /health',
      'GET /profile',
      'GET /verification-status/:uid',
      'GET /debug-user/:uid'
    ],
    timestamp: new Date().toISOString()
  });
});

// Test route to verify the auth route is working
router.get('/test', (req, res) => {
  console.log('✅ Auth route test endpoint hit');
  res.json({ 
    message: 'Auth route is working!',
    timestamp: new Date().toISOString(),
    firebase: admin.apps.length > 0 ? 'connected' : 'disconnected'
  });
});

// Create user profile (after Firebase Auth registration)
router.post('/create-profile', async (req, res) => {
  console.log('🚀 Starting profile creation...');
  
  try {
    console.log('🔍 Create profile request body:', {
      ...req.body,
      profile: req.body.profile
    });

    const { uid, email, role, profile } = req.body;

    // Validate required fields
    if (!uid || !email || !role || !profile) {
      console.log('❌ Missing required fields for profile creation:', {
        uid: !!uid,
        email: !!email,
        role: !!role,
        profile: !!profile
      });
      return res.status(400).json({ 
        error: 'Missing required fields: uid, email, role, and profile are required',
        received: { uid: !!uid, email: !!email, role: !!role, profile: !!profile }
      });
    }

    // Validate profile fields
    if (!profile.firstName || !profile.lastName) {
      console.log('❌ Missing profile fields:', profile);
      return res.status(400).json({ 
        error: 'Missing profile fields: firstName and lastName are required',
        received: profile
      });
    }

    // Admin access code validation - ENHANCED
    if (role === 'admin') {
      const adminCode = profile.adminCode;
      const expectedAdminCode = process.env.ADMIN_ACCESS_CODE;
      
      console.log('🔐 Admin registration attempt:', {
        providedCode: adminCode,
        expectedCode: expectedAdminCode ? '***' : 'NOT_SET'
      });
      
      if (!adminCode) {
        console.log('❌ No admin code provided');
        return res.status(403).json({ error: 'Admin access code is required for admin registration' });
      }
      
      if (!expectedAdminCode) {
        console.log('❌ ADMIN_ACCESS_CODE not set in environment');
        return res.status(500).json({ error: 'Server configuration error: ADMIN_ACCESS_CODE not set' });
      }
      
      if (adminCode !== expectedAdminCode) {
        console.log('❌ Invalid admin access code');
        return res.status(403).json({ error: 'Invalid admin access code' });
      }
      
      console.log('✅ Admin access code validated successfully');
    }

    console.log('✅ All validations passed, creating Firestore document...');

    // Check if user already exists in Firestore
    const existingUser = await admin.firestore().collection('users').doc(uid).get();
    if (existingUser.exists) {
      console.log('❌ User profile already exists in Firestore for UID:', uid);
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
    const userRef = admin.firestore().collection('users').doc(uid);
    
    const userData = {
      uid: uid,
      email: email.trim().toLowerCase(),
      role,
      profile: {
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        phone: profile.phone?.trim() || '',
      },
      isVerified: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await userRef.set(userData);
    console.log('✅ User profile created in Firestore:', {
      uid,
      email: userData.email,
      role: userData.role,
      firestoreId: uid
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
    console.error('❌ Profile creation error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    let errorMessage = 'Profile creation failed';
    
    if (error.code === 5) { // PERMISSION_DENIED from Firestore
      errorMessage = 'Database permission denied. Please contact support.';
    } else if (error.code === 13) { // INTERNAL from Firestore
      errorMessage = 'Database error. Please try again.';
    } else if (error.code === 7) { // PERMISSION_DENIED from Firebase Auth
      errorMessage = 'Authentication error. Please check your Firebase configuration.';
    }
    
    res.status(400).json({ 
      error: errorMessage,
      details: error.message 
    });
  }
});

// Login with email verification check
router.post('/login', async (req, res) => {
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
    console.log('📋 User data retrieved from Firestore:', {
      email: userData.email,
      role: userData.role,
      isVerified: userData.isVerified
    });

    // Check if email is verified using Firebase Auth data
    if (!decodedToken.email_verified) {
      console.log('❌ Email not verified for user:', decodedToken.email);
      return res.status(401).json({ 
        error: 'Please verify your email before logging in.',
        needsVerification: true,
        email: decodedToken.email
      });
    }

    // Update verification status in Firestore if needed
    if (!userData.isVerified) {
      await userDoc.ref.update({ 
        isVerified: true,
        emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Updated verification status in Firestore');
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
    console.error('❌ Login error:', {
      message: error.message,
      code: error.code
    });
    
    let errorMessage = 'Invalid credentials';
    
    if (error.code === 'auth/id-token-expired') {
      errorMessage = 'Session expired. Please login again.';
    } else if (error.code === 'auth/id-token-revoked') {
      errorMessage = 'Session revoked. Please login again.';
    } else if (error.code === 'auth/invalid-id-token') {
      errorMessage = 'Invalid session. Please login again.';
    } else if (error.code === 'auth/user-not-found') {
      errorMessage = 'User not found. Please register first.';
    }
    
    res.status(401).json({ 
      error: errorMessage,
      details: error.message 
    });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
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
    console.error('❌ Resend verification error:', {
      message: error.message,
      code: error.code
    });
    
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

// Check verification status
router.get('/verification-status/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    console.log('🔍 Checking verification status for UID:', uid);
    
    const userRecord = await admin.auth().getUser(uid);
    
    console.log('✅ Verification status retrieved:', {
      email: userRecord.email,
      emailVerified: userRecord.emailVerified
    });
    
    res.json({
      emailVerified: userRecord.emailVerified,
      email: userRecord.email,
      uid: uid
    });
  } catch (error) {
    console.error('❌ Verification status error:', error);
    res.status(400).json({ 
      error: 'Failed to check verification status',
      details: error.message 
    });
  }
});

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userData = userDoc.data();
    
    res.json({
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        ...userData
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Debug route to check Firestore data
router.get('/debug-user/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    console.log('🔍 Debugging user in Firestore for UID:', uid);
    
    // Check Firestore
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      console.log('❌ User NOT found in Firestore');
      return res.json({
        firestore: 'NOT_FOUND',
        message: 'User profile does not exist in Firestore'
      });
    }
    
    const userData = userDoc.data();
    console.log('✅ User found in Firestore:', userData);
    
    res.json({
      firestore: 'FOUND',
      data: userData
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check for auth routes
router.get('/health', async (req, res) => {
  try {
    // Test Firebase Admin connection
    await admin.auth().listUsers(1, 1);
    
    res.json({
      status: 'OK',
      service: 'auth',
      firebase: 'connected',
      timestamp: new Date().toISOString(),
      adminCodeConfigured: !!process.env.ADMIN_ACCESS_CODE
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      service: 'auth',
      firebase: 'disconnected',
      error: error.message
    });
  }
});

export default router;