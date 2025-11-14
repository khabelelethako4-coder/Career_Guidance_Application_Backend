import express from 'express';
import { db } from '../server.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get institution's courses
router.get('/courses', authenticate, authorize(['institution']), async (req, res) => {
  try {
    const institutionDoc = await db.collection('institutions')
      .where('adminId', '==', req.user.uid)
      .get();

    if (institutionDoc.empty) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    const coursesSnapshot = await db.collection('courses')
      .where('institutionId', '==', institutionDoc.docs[0].id)
      .get();

    const courses = await Promise.all(
      coursesSnapshot.docs.map(async (doc) => {
        const courseData = doc.data();
        const faculty = await db.collection('faculties').doc(courseData.facultyId).get();
        
        return {
          id: doc.id,
          ...courseData,
          facultyName: faculty.data()?.name
        };
      })
    );

    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get institution's faculties
router.get('/faculties', authenticate, authorize(['institution']), async (req, res) => {
  try {
    const institutionDoc = await db.collection('institutions')
      .where('adminId', '==', req.user.uid)
      .get();

    if (institutionDoc.empty) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    const facultiesSnapshot = await db.collection('faculties')
      .where('institutionId', '==', institutionDoc.docs[0].id)
      .get();

    const faculties = facultiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(faculties);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;