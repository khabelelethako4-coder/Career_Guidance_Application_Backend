import express from 'express';
import { db } from '../server.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Apply for course
router.post('/applications', authenticate, authorize(['student']), async (req, res) => {
  try {
    console.log('📝 Student application submission:', {
      studentId: req.user.uid,
      courseId: req.body.courseId,
      institutionId: req.body.institutionId
    });

    const { courseId, institutionId, personalStatement, documents } = req.body;
    const studentId = req.user.uid;

    // Validate required fields
    if (!courseId || !institutionId) {
      return res.status(400).json({ 
        error: 'Course ID and Institution ID are required' 
      });
    }

    // Check if student already has 2 applications for this institution
    const existingApps = await db.collection('applications')
      .where('studentId', '==', studentId)
      .where('institutionId', '==', institutionId)
      .get();

    if (existingApps.size >= 2) {
      console.log('❌ Maximum applications reached for institution');
      return res.status(400).json({ 
        error: 'Maximum of 2 applications per institution allowed' 
      });
    }

    // Check if already admitted elsewhere
    const admittedApp = await db.collection('applications')
      .where('studentId', '==', studentId)
      .where('status', '==', 'admitted')
      .get();

    if (!admittedApp.empty) {
      console.log('❌ Student already admitted elsewhere');
      return res.status(400).json({ 
        error: 'You are already admitted to an institution' 
      });
    }

    // Verify course exists and belongs to institution
    const courseDoc = await db.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const courseData = courseDoc.data();
    if (courseData.institutionId !== institutionId) {
      return res.status(400).json({ error: 'Course does not belong to selected institution' });
    }

    // Create application
    const applicationRef = await db.collection('applications').add({
      studentId,
      courseId,
      institutionId,
      personalStatement: personalStatement || '',
      documents: documents || [],
      status: 'pending',
      appliedAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Application created successfully:', applicationRef.id);

    // Create notification
    await db.collection('notifications').add({
      userId: studentId,
      title: 'Application Submitted',
      message: `Your application for ${courseData.name} has been submitted successfully`,
      type: 'application',
      read: false,
      createdAt: new Date()
    });

    res.status(201).json({
      message: 'Application submitted successfully',
      applicationId: applicationRef.id
    });
  } catch (error) {
    console.error('❌ Application submission error:', error);
    res.status(500).json({ 
      error: 'Failed to submit application',
      details: error.message 
    });
  }
});

// Get student's applications
router.get('/applications', authenticate, authorize(['student']), async (req, res) => {
  try {
    const studentId = req.user.uid;
    console.log('📋 Fetching applications for student:', studentId);
    
    const applicationsSnapshot = await db.collection('applications')
      .where('studentId', '==', studentId)
      .orderBy('appliedAt', 'desc')
      .get();

    const applications = [];
    for (const doc of applicationsSnapshot.docs) {
      const appData = doc.data();
      
      // Get course details
      const courseDoc = await db.collection('courses').doc(appData.courseId).get();
      const courseData = courseDoc.data();
      
      // Get institution details
      const institutionDoc = await db.collection('institutions').doc(appData.institutionId).get();
      const institutionData = institutionDoc.data();
      
      // Get faculty details
      let facultyName = 'Unknown Faculty';
      if (courseData?.facultyId) {
        const facultyDoc = await db.collection('faculties').doc(courseData.facultyId).get();
        facultyName = facultyDoc.data()?.name || 'Unknown Faculty';
      }
      
      applications.push({
        id: doc.id,
        ...appData,
        course: {
          id: courseDoc.id,
          name: courseData?.name,
          description: courseData?.description,
          duration: courseData?.duration,
          fees: courseData?.fees,
          facultyName: facultyName
        },
        institution: {
          id: institutionDoc.id,
          name: institutionData?.name,
          location: institutionData?.location,
          description: institutionData?.description
        }
      });
    }

    console.log(`✅ Found ${applications.length} applications for student`);
    res.json(applications);
  } catch (error) {
    console.error('❌ Error fetching applications:', error);
    res.status(500).json({ 
      error: 'Failed to fetch applications',
      details: error.message 
    });
  }
});

// Get specific application
router.get('/applications/:applicationId', authenticate, authorize(['student']), async (req, res) => {
  try {
    const { applicationId } = req.params;
    const studentId = req.user.uid;
    
    console.log(`📄 Fetching application: ${applicationId} for student: ${studentId}`);

    const applicationDoc = await db.collection('applications').doc(applicationId).get();
    
    if (!applicationDoc.exists) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const appData = applicationDoc.data();
    
    // Verify the application belongs to the student
    if (appData.studentId !== studentId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get course details
    const courseDoc = await db.collection('courses').doc(appData.courseId).get();
    const courseData = courseDoc.data();
    
    // Get institution details
    const institutionDoc = await db.collection('institutions').doc(appData.institutionId).get();
    const institutionData = institutionDoc.data();

    const application = {
      id: applicationDoc.id,
      ...appData,
      course: {
        id: courseDoc.id,
        name: courseData?.name,
        description: courseData?.description,
        duration: courseData?.duration,
        fees: courseData?.fees
      },
      institution: {
        id: institutionDoc.id,
        name: institutionData?.name,
        location: institutionData?.location
      }
    };

    res.json(application);
  } catch (error) {
    console.error('❌ Error fetching application:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get student profile
router.get('/profile', authenticate, authorize(['student']), async (req, res) => {
  try {
    const studentId = req.user.uid;
    console.log('👤 Fetching student profile:', studentId);
    
    const userDoc = await db.collection('users').doc(studentId).get();
    
    if (!userDoc.exists) {
      console.log('❌ Student profile not found');
      return res.status(404).json({ error: 'User profile not found' });
    }

    const userData = userDoc.data();
    
    // Get applications count
    const applicationsSnapshot = await db.collection('applications')
      .where('studentId', '==', studentId)
      .get();

    const profile = {
      uid: studentId,
      email: req.user.email,
      ...userData,
      stats: {
        totalApplications: applicationsSnapshot.size,
        pendingApplications: applicationsSnapshot.docs.filter(doc => 
          doc.data().status === 'pending'
        ).length,
        admittedApplications: applicationsSnapshot.docs.filter(doc => 
          doc.data().status === 'admitted'
        ).length
      }
    };

    console.log('✅ Student profile fetched successfully');
    res.json(profile);
  } catch (error) {
    console.error('❌ Error fetching student profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update student profile
router.put('/profile', authenticate, authorize(['student']), async (req, res) => {
  try {
    const studentId = req.user.uid;
    const { profile: profileData } = req.body;
    
    console.log(`✏️ Updating student profile: ${studentId}`);

    if (!profileData) {
      return res.status(400).json({ error: 'Profile data is required' });
    }

    await db.collection('users').doc(studentId).update({
      profile: {
        ...profileData,
        updatedAt: new Date()
      },
      updatedAt: new Date()
    });

    console.log('✅ Student profile updated successfully');
    
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('❌ Error updating student profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload transcript (placeholder - you'll need to implement file upload)
router.post('/transcript', authenticate, authorize(['student']), async (req, res) => {
  try {
    const studentId = req.user.uid;
    console.log('📄 Transcript upload request for student:', studentId);

    // This is a placeholder - you'll need to implement actual file upload
    // For now, we'll just create a transcript record
    const transcriptRef = await db.collection('transcripts').add({
      studentId,
      status: 'uploaded',
      uploadedAt: new Date(),
      // In a real implementation, you'd store the file URL here
      fileUrl: '/placeholder/transcript.pdf'
    });

    console.log('✅ Transcript record created:', transcriptRef.id);

    res.status(201).json({
      message: 'Transcript uploaded successfully',
      transcriptId: transcriptRef.id,
      uploadedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error uploading transcript:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get student's transcript
router.get('/transcript', authenticate, authorize(['student']), async (req, res) => {
  try {
    const studentId = req.user.uid;
    console.log('📄 Fetching transcript for student:', studentId);

    const transcriptSnapshot = await db.collection('transcripts')
      .where('studentId', '==', studentId)
      .orderBy('uploadedAt', 'desc')
      .limit(1)
      .get();

    if (transcriptSnapshot.empty) {
      return res.status(404).json({ error: 'No transcript found' });
    }

    const transcriptDoc = transcriptSnapshot.docs[0];
    const transcript = {
      id: transcriptDoc.id,
      ...transcriptDoc.data()
    };

    res.json(transcript);
  } catch (error) {
    console.error('❌ Error fetching transcript:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;