import express from 'express';
import { db } from '../server.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get system statistics
router.get('/stats', authenticate, authorize(['admin']), async (req, res) => {
  try {
    // Get counts for all collections
    const [
      usersCount,
      institutionsCount,
      companiesCount,
      applicationsCount,
      jobsCount
    ] = await Promise.all([
      db.collection('users').count().get(),
      db.collection('institutions').count().get(),
      db.collection('companies').count().get(),
      db.collection('applications').count().get(),
      db.collection('jobs').count().get()
    ]);

    // Get recent activities
    const recentUsers = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    const recentApplications = await db.collection('applications')
      .orderBy('appliedAt', 'desc')
      .limit(5)
      .get();

    const stats = {
      users: usersCount.data().count,
      institutions: institutionsCount.data().count,
      companies: companiesCount.data().count,
      applications: applicationsCount.data().count,
      jobs: jobsCount.data().count,
      recentUsers: recentUsers.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      recentApplications: recentApplications.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manage institutions
router.get('/institutions', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const institutionsSnapshot = await db.collection('institutions').get();
    const institutions = institutionsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(institutions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manage companies
router.get('/companies', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const companiesSnapshot = await db.collection('companies').get();
    const companies = companiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(companies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve/Suspend company
router.put('/companies/:companyId', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status } = req.body;

    await db.collection('companies').doc(companyId).update({
      status,
      updatedAt: new Date()
    });

    res.json({ message: `Company ${status} successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add institution
router.post('/institutions', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { name, type, location, contact, description } = req.body;

    const institutionRef = await db.collection('institutions').add({
      name,
      type,
      location,
      contact,
      description,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.status(201).json({
      message: 'Institution added successfully',
      institutionId: institutionRef.id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get system reports
router.get('/reports/applications', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    const applicationsSnapshot = await db.collection('applications')
      .where('appliedAt', '>=', startDate)
      .get();

    const reports = {
      total: applicationsSnapshot.size,
      byStatus: {},
      byInstitution: {},
      byCourse: {}
    };

    applicationsSnapshot.docs.forEach(doc => {
      const app = doc.data();
      
      // Count by status
      reports.byStatus[app.status] = (reports.byStatus[app.status] || 0) + 1;
      
      // Count by institution
      reports.byInstitution[app.institutionId] = (reports.byInstitution[app.institutionId] || 0) + 1;
      
      // Count by course
      reports.byCourse[app.courseId] = (reports.byCourse[app.courseId] || 0) + 1;
    });

    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;