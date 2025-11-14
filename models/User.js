import { db } from '../server.js';

export const User = {
  // Create user in Firestore
  async create(userData) {
    const userRef = db.collection('users').doc(userData.uid);
    await userRef.set({
      email: userData.email,
      role: userData.role,
      profile: userData.profile || {},
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return userRef;
  },

  // Find user by UID
  async findById(uid) {
    const userDoc = await db.collection('users').doc(uid).get();
    return userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : null;
  },

  // Update user profile
  async update(uid, updates) {
    updates.updatedAt = new Date();
    await db.collection('users').doc(uid).update(updates);
  }
};