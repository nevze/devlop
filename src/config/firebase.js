const admin = require('firebase-admin');
const logger = require('./logger');

let firebaseAdmin;

const initializeFirebase = () => {
    try {
        if (!process.env.FIREBASE_CREDENTIALS) {
            logger.warn('Firebase credentials not found. Google authentication will not be available.');
            return;
        }

        const credentials = JSON.parse(process.env.FIREBASE_CREDENTIALS);

        firebaseAdmin = admin.initializeApp({
            credential: admin.credential.cert(credentials),
            databaseURL: process.env.FIREBASE_DATABASE_URL
        });

        logger.info('Firebase Admin SDK initialized successfully');
    } catch (error) {
        logger.error(`Firebase initialization error: ${error}`);
        process.exit(1);
    }
};

// Verify Firebase ID token
const verifyFirebaseToken = async (idToken) => {
    try {
        if (!firebaseAdmin) {
            throw new Error('Firebase Admin SDK not initialized');
        }
        const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
        return decodedToken;
    } catch (error) {
        logger.error(`Firebase token verification error: ${error}`);
        throw error;
    }
};

// Get user by email
const getUserByEmail = async (email) => {
    try {
        if (!firebaseAdmin) {
            throw new Error('Firebase Admin SDK not initialized');
        }
        const userRecord = await firebaseAdmin.auth().getUserByEmail(email);
        return userRecord;
    } catch (error) {
        logger.error(`Firebase get user error: ${error}`);
        throw error;
    }
};

// Create custom token
const createCustomToken = async (uid, additionalClaims) => {
    try {
        if (!firebaseAdmin) {
            throw new Error('Firebase Admin SDK not initialized');
        }
        const token = await firebaseAdmin.auth().createCustomToken(uid, additionalClaims);
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
    getFirebaseAdmin: () => firebaseAdmin
}; 