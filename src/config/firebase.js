const admin = require('firebase-admin');
const logger = require('./logger');

let firebaseApp;

const initializeFirebase = () => {
    try {
        // Check if Firebase credentials are provided
        if (!process.env.FIREBASE_PROJECT_ID || 
            !process.env.FIREBASE_PRIVATE_KEY || 
            !process.env.FIREBASE_CLIENT_EMAIL) {
            logger.warn('Firebase credentials not provided, skipping initialization');
            return;
        }

        // Initialize Firebase Admin
        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL
            })
        });

        logger.info('Firebase initialized successfully');
    } catch (error) {
        logger.error('Firebase initialization error:', error);
        process.exit(1);
    }
};

const verifyFirebaseToken = async (idToken) => {
    if (!firebaseApp) {
        throw new Error('Firebase not initialized');
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken;
    } catch (error) {
        logger.error('Firebase token verification error:', error);
        throw error;
    }
};

// Get user by email
const getUserByEmail = async (email) => {
    try {
        if (!firebaseApp) {
            throw new Error('Firebase not initialized');
        }
        const userRecord = await admin.auth().getUserByEmail(email);
        return userRecord;
    } catch (error) {
        logger.error(`Firebase get user error: ${error}`);
        throw error;
    }
};

// Create custom token
const createCustomToken = async (uid, additionalClaims) => {
    try {
        if (!firebaseApp) {
            throw new Error('Firebase not initialized');
        }
        const token = await admin.auth().createCustomToken(uid, additionalClaims);
        return token;
    } catch (error) {
        logger.error(`Firebase custom token creation error: ${error}`);
        throw error;
    }
};

module.exports = {
    initializeFirebase,
    verifyFirebaseToken,
    getUserByEmail,
    createCustomToken,
    getFirebaseApp: () => firebaseApp
}; 