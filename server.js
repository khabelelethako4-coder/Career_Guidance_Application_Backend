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

// Seed Data Configuration
const institutions = [
  {
    name: 'University of Technology',
    location: 'Maseru, Lesotho',
    type: 'public',
    description: 'Leading technology university in Lesotho',
    established: 1980,
    website: 'https://www.ut.ac.ls',
    email: 'info@ut.ac.ls',
    phone: '+266 2231 1234',
    address: 'PO Box 123, Maseru 100',
    accreditation: 'Higher Education Council',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'National University of Lesotho',
    location: 'Roma, Lesotho',
    type: 'public',
    description: 'Premier higher education institution in Lesotho',
    established: 1945,
    website: 'https://www.nul.ls',
    email: 'admissions@nul.ls',
    phone: '+266 5221 0000',
    address: 'PO Box 180, Roma 180',
    accreditation: 'Higher Education Council',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Limkokwing University of Creative Technology',
    location: 'Maseru, Lesotho',
    type: 'private',
    description: 'International university focusing on creative technology',
    established: 2008,
    website: 'https://www.limkokwing.net/ls',
    email: 'lesotho@limkokwing.net',
    phone: '+266 2832 3232',
    address: 'Kingsway Road, Maseru',
    accreditation: 'Higher Education Council',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Lerotholi Polytechnic',
    location: 'Maseru, Lesotho',
    type: 'public',
    description: 'Technical and vocational education institution',
    established: 1960,
    website: 'https://www.lpoly.org.ls',
    email: 'registrar@lpoly.org.ls',
    phone: '+266 2231 2032',
    address: 'PO Box 16, Maseru 100',
    accreditation: 'Higher Education Council',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Lesotho College of Education',
    location: 'Maseru, Lesotho',
    type: 'public',
    description: 'Teacher training and education college',
    established: 1975,
    website: 'https://www.lce.ac.ls',
    email: 'info@lce.ac.ls',
    phone: '+266 2232 5601',
    address: 'PO Box 1276, Maseru 100',
    accreditation: 'Higher Education Council',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const faculties = [
  {
    name: 'Faculty of Information Technology',
    institutionId: 'uni_001',
    description: 'Computer science and IT programs',
    isActive: true,
    createdAt: new Date()
  },
  {
    name: 'Faculty of Business',
    institutionId: 'uni_001',
    description: 'Business and management programs',
    isActive: true,
    createdAt: new Date()
  },
  {
    name: 'Faculty of Health Sciences',
    institutionId: 'uni_002',
    description: 'Medical and health science programs',
    isActive: true,
    createdAt: new Date()
  },
  {
    name: 'Faculty of Law',
    institutionId: 'uni_002',
    description: 'Law and legal studies programs',
    isActive: true,
    createdAt: new Date()
  },
  {
    name: 'Faculty of Creative Technology',
    institutionId: 'uni_003',
    description: 'Design and creative technology programs',
    isActive: true,
    createdAt: new Date()
  }
];

const courses = [
  {
    name: 'Bachelor of Computer Science',
    institutionId: 'uni_001',
    facultyId: 'fac_001',
    duration: '4 years',
    fees: 25000,
    requirements: ['Mathematics C+', 'English C+', 'Physics C'],
    description: 'Comprehensive computer science and programming degree',
    level: 'undergraduate',
    intake: 'January, September',
    applicationDeadline: '2024-11-30',
    availableSeats: 100,
    isActive: true,
    createdAt: new Date()
  },
  {
    name: 'Bachelor of Business Administration',
    institutionId: 'uni_001',
    facultyId: 'fac_002',
    duration: '3 years',
    fees: 22000,
    requirements: ['Mathematics D+', 'English C+'],
    description: 'Business management and administration degree',
    level: 'undergraduate',
    intake: 'January, September',
    applicationDeadline: '2024-11-30',
    availableSeats: 150,
    isActive: true,
    createdAt: new Date()
  },
  {
    name: 'Bachelor of Medicine',
    institutionId: 'uni_002',
    facultyId: 'fac_003',
    duration: '6 years',
    fees: 45000,
    requirements: ['Mathematics B+', 'English B+', 'Biology A-', 'Chemistry A-'],
    description: 'Medical doctor training program',
    level: 'undergraduate',
    intake: 'August',
    applicationDeadline: '2024-06-30',
    availableSeats: 50,
    isActive: true,
    createdAt: new Date()
  },
  {
    name: 'Bachelor of Laws',
    institutionId: 'uni_002',
    facultyId: 'fac_004',
    duration: '4 years',
    fees: 30000,
    requirements: ['English B+', 'History C+'],
    description: 'Law degree program',
    level: 'undergraduate',
    intake: 'August',
    applicationDeadline: '2024-06-30',
    availableSeats: 80,
    isActive: true,
    createdAt: new Date()
  },
  {
    name: 'Bachelor of Design in Graphic Design',
    institutionId: 'uni_003',
    facultyId: 'fac_005',
    duration: '3 years',
    fees: 35000,
    requirements: ['English C+', 'Portfolio Review'],
    description: 'Graphic design and visual communication degree',
    level: 'undergraduate',
    intake: 'January, May, September',
    applicationDeadline: '2024-12-15',
    availableSeats: 60,
    isActive: true,
    createdAt: new Date()
  }
];

// Seed Database Function
async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Seed institutions
    console.log('\n📚 Adding institutions...');
    for (let i = 0; i < institutions.length; i++) {
      const institution = institutions[i];
      const institutionId = `uni_00${i + 1}`;
      
      await db.collection('institutions').doc(institutionId).set(institution);
      console.log(`✅ Added institution: ${institution.name} (ID: ${institutionId})`);
    }

    // Seed faculties
    console.log('\n🎓 Adding faculties...');
    for (let i = 0; i < faculties.length; i++) {
      const faculty = faculties[i];
      const facultyId = `fac_00${i + 1}`;
      
      await db.collection('faculties').doc(facultyId).set(faculty);
      console.log(`✅ Added faculty: ${faculty.name} (ID: ${facultyId})`);
    }

    // Seed courses
    console.log('\n📖 Adding courses...');
    for (let i = 0; i < courses.length; i++) {
      const course = courses[i];
      const courseRef = await db.collection('courses').add(course);
      console.log(`✅ Added course: ${course.name} (Ref: ${courseRef.id})`);
    }

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('📊 Summary:');
    console.log(`   • ${institutions.length} institutions added`);
    console.log(`   • ${faculties.length} faculties added`);
    console.log(`   • ${courses.length} courses added`);
    
    return { 
      success: true, 
      message: 'Database seeded successfully',
      summary: {
        institutions: institutions.length,
        faculties: faculties.length,
        courses: courses.length
      }
    };
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Seed Database Route (for development) - POST
app.post('/api/seed', async (req, res) => {
  try {
    // Optional: Add protection for production
    if (process.env.NODE_ENV === 'production' && !req.headers['x-admin-secret']) {
      return res.status(403).json({ 
        error: 'Seeding not allowed in production without admin secret' 
      });
    }

    console.log('🌱 Manual seed request received...');
    const result = await seedDatabase();
    res.json(result);
  } catch (error) {
    console.error('❌ Seed request failed:', error);
    res.status(500).json({ 
      error: 'Seeding failed', 
      details: error.message 
    });
  }
});

// Add this GET route for easier testing
app.get('/api/seed', async (req, res) => {
  try {
    // Optional: Add protection for production
    if (process.env.NODE_ENV === 'production' && !req.headers['x-admin-secret']) {
      return res.status(403).json({ 
        error: 'Seeding not allowed in production without admin secret' 
      });
    }

    console.log('🌱 Manual seed request received via GET...');
    const result = await seedDatabase();
    res.json(result);
  } catch (error) {
    console.error('❌ Seed request failed:', error);
    res.status(500).json({ 
      error: 'Seeding failed', 
      details: error.message 
    });
  }
});

// Check if database has seed data
app.get('/api/seed/status', async (req, res) => {
  try {
    const institutionsSnapshot = await db.collection('institutions').get();
    const facultiesSnapshot = await db.collection('faculties').get();
    const coursesSnapshot = await db.collection('courses').get();
    
    const status = {
      institutions: institutionsSnapshot.size,
      faculties: facultiesSnapshot.size,
      courses: coursesSnapshot.size,
      hasData: institutionsSnapshot.size > 0 || facultiesSnapshot.size > 0 || coursesSnapshot.size > 0
    };
    
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
  console.log(`🌱 Seed status: http://localhost:${PORT}/api/seed/status`);
  console.log(`🌱 Seed database: GET/POST http://localhost:${PORT}/api/seed`);
  console.log(`🔧 Firestore test: http://localhost:${PORT}/api/test-firestore`);
  console.log(`📧 Email verification: Enabled via Firebase Auth`);
});

export { db, admin, seedDatabase };