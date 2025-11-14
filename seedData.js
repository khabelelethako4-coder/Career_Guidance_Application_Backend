import { db } from './server.js';

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
  // University of Technology Faculties
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
  // National University Faculties
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
  // Limkokwing Faculties
  {
    name: 'Faculty of Creative Technology',
    institutionId: 'uni_003',
    description: 'Design and creative technology programs',
    isActive: true,
    createdAt: new Date()
  }
];

const courses = [
  // University of Technology Courses
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
  // National University Courses
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
  // Limkokwing Courses
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
    
    return { success: true, message: 'Database seeded successfully' };
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Run the seed if this file is executed directly
seedDatabase()
  .then(() => {
    console.log('✨ Seed process finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seed process failed');
    process.exit(1);
  });