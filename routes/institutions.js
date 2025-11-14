import express from 'express';
import { db } from '../server.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get all institutions (public route)
router.get('/', async (req, res) => {
  try {
    console.log('📋 Fetching all institutions...');
    
    const institutionsSnapshot = await db.collection('institutions')
      .where('isActive', '==', true)
      .get();

    if (institutionsSnapshot.empty) {
      console.log('ℹ️ No institutions found');
      return res.json([]);
    }

    const institutions = institutionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`✅ Found ${institutions.length} institutions`);
    res.json(institutions);
  } catch (error) {
    console.error('❌ Error fetching institutions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch institutions',
      details: error.message 
    });
  }
});

// Get single institution by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📋 Fetching institution: ${id}`);
    
    const institutionDoc = await db.collection('institutions').doc(id).get();
    
    if (!institutionDoc.exists) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    const institution = {
      id: institutionDoc.id,
      ...institutionDoc.data()
    };

    res.json(institution);
  } catch (error) {
    console.error('❌ Error fetching institution:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get institution courses
router.get('/:id/courses', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📚 Fetching courses for institution: ${id}`);
    
    const coursesSnapshot = await db.collection('courses')
      .where('institutionId', '==', id)
      .where('isActive', '==', true)
      .get();

    const courses = await Promise.all(
      coursesSnapshot.docs.map(async (doc) => {
        const courseData = doc.data();
        const faculty = await db.collection('faculties').doc(courseData.facultyId).get();
        
        return {
          id: doc.id,
          ...courseData,
          facultyName: faculty.data()?.name || 'Unknown Faculty'
        };
      })
    );

    console.log(`✅ Found ${courses.length} courses`);
    res.json(courses);
  } catch (error) {
    console.error('❌ Error fetching courses:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get institution faculties
router.get('/:id/faculties', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🎓 Fetching faculties for institution: ${id}`);
    
    const facultiesSnapshot = await db.collection('faculties')
      .where('institutionId', '==', id)
      .get();

    const faculties = facultiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`✅ Found ${faculties.length} faculties`);
    res.json(faculties);
  } catch (error) {
    console.error('❌ Error fetching faculties:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create institution (admin only)
router.post('/', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { name, location, description, contact } = req.body;
    console.log('🏫 Creating new institution:', name);

    const institutionRef = await db.collection('institutions').add({
      name,
      location,
      description,
      contact,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Institution created:', institutionRef.id);
    
    res.status(201).json({
      message: 'Institution created successfully',
      institutionId: institutionRef.id
    });
  } catch (error) {
    console.error('❌ Error creating institution:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update institution
router.put('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`✏️ Updating institution: ${id}`);

    const institutionDoc = await db.collection('institutions').doc(id).get();
    
    if (!institutionDoc.exists) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    await db.collection('institutions').doc(id).update({
      ...req.body,
      updatedAt: new Date()
    });

    console.log('✅ Institution updated successfully');
    
    res.json({ message: 'Institution updated successfully' });
  } catch (error) {
    console.error('❌ Error updating institution:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;