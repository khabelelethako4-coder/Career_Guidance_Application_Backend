import express from 'express';
import { db } from '../server.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get company profile
router.get('/profile', authenticate, authorize(['company']), async (req, res) => {
  try {
    const companyDoc = await db.collection('companies')
      .where('adminId', '==', req.user.uid)
      .get();
    
    if (companyDoc.empty) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = {
      id: companyDoc.docs[0].id,
      ...companyDoc.docs[0].data()
    };

    res.json(company);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update company profile
router.put('/profile', authenticate, authorize(['company']), async (req, res) => {
  try {
    const companyDoc = await db.collection('companies')
      .where('adminId', '==', req.user.uid)
      .get();
    
    if (companyDoc.empty) {
      return res.status(404).json({ error: 'Company not found' });
    }

    await db.collection('companies').doc(companyDoc.docs[0].id).update({
      ...req.body,
      updatedAt: new Date()
    });

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Post job opportunity
router.post('/jobs', authenticate, authorize(['company']), async (req, res) => {
  try {
    const {
      title,
      description,
      requirements,
      qualifications,
      location,
      salaryRange,
      jobType,
      deadline
    } = req.body;

    const companyDoc = await db.collection('companies')
      .where('adminId', '==', req.user.uid)
      .get();

    if (companyDoc.empty) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = companyDoc.docs[0].data();

    const jobRef = await db.collection('jobs').add({
      title,
      description,
      requirements,
      qualifications,
      location,
      salaryRange,
      jobType,
      deadline: new Date(deadline),
      companyId: companyDoc.docs[0].id,
      companyName: company.name,
      isActive: true,
      postedAt: new Date(),
      createdAt: new Date()
    });

    // Notify qualified students
    await notifyQualifiedStudents(jobRef.id, req.body);

    res.status(201).json({
      message: 'Job posted successfully',
      jobId: jobRef.id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get company's jobs
router.get('/jobs', authenticate, authorize(['company']), async (req, res) => {
  try {
    const companyDoc = await db.collection('companies')
      .where('adminId', '==', req.user.uid)
      .get();

    if (companyDoc.empty) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const jobsSnapshot = await db.collection('jobs')
      .where('companyId', '==', companyDoc.docs[0].id)
      .get();

    const jobs = jobsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get qualified applicants for a job
router.get('/jobs/:jobId/applicants', authenticate, authorize(['company']), async (req, res) => {
  try {
    const { jobId } = req.params;

    const jobDoc = await db.collection('jobs').doc(jobId).get();
    if (!jobDoc.exists) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Get job applications for this job
    const applicationsSnapshot = await db.collection('jobApplications')
      .where('jobId', '==', jobId)
      .where('status', 'in', ['applied', 'shortlisted', 'rejected'])
      .get();

    const applicants = [];
    for (const doc of applicationsSnapshot.docs) {
      const appData = doc.data();
      const student = await db.collection('users').doc(appData.studentId).get();
      const transcript = await db.collection('transcripts')
        .where('studentId', '==', appData.studentId)
        .orderBy('uploadedAt', 'desc')
        .limit(1)
        .get();

      applicants.push({
        id: doc.id,
        ...appData,
        student: student.data()?.profile,
        transcript: transcript.empty ? null : transcript.docs[0].data(),
        matchScore: calculateMatchScore(appData, jobDoc.data())
      });
    }

    // Sort by match score
    applicants.sort((a, b) => b.matchScore - a.matchScore);

    res.json(applicants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to notify qualified students
async function notifyQualifiedStudents(jobId, jobData) {
  try {
    // Get all students with transcripts
    const studentsSnapshot = await db.collection('users')
      .where('role', '==', 'student')
      .get();

    for (const studentDoc of studentsSnapshot.docs) {
      const student = studentDoc.data();
      const transcript = await db.collection('transcripts')
        .where('studentId', '==', studentDoc.id)
        .orderBy('uploadedAt', 'desc')
        .limit(1)
        .get();

      if (!transcript.empty) {
        const transcriptData = transcript.docs[0].data();
        
        // Check if student qualifies (simplified logic)
        if (checkJobQualifications(transcriptData, jobData)) {
          await db.collection('notifications').add({
            userId: studentDoc.id,
            title: 'New Job Opportunity',
            message: `A new job matching your profile: ${jobData.title} at ${jobData.companyName}`,
            type: 'job',
            jobId: jobId,
            read: false,
            createdAt: new Date()
          });
        }
      }
    }
  } catch (error) {
    console.error('Error notifying students:', error);
  }
}

// Helper function to check job qualifications
function checkJobQualifications(transcript, jobData) {
  // Implement qualification matching logic
  // This should consider GPA, courses, certificates, etc.
  return true; // Simplified for example
}

// Helper function to calculate match score
function calculateMatchScore(application, jobData) {
  let score = 0;
  
  // Calculate based on academic performance
  if (application.transcript?.gpa) {
    score += application.transcript.gpa * 10;
  }
  
  // Add points for relevant certificates
  if (application.student?.certificates) {
    score += application.student.certificates.length * 5;
  }
  
  // Add points for work experience
  if (application.student?.workExperience) {
    score += application.student.workExperience.length * 8;
  }
  
  return score;
}

export default router;