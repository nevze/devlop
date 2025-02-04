require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const { rateLimit } = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const adminRoutes = require('./routes/admin.routes');
const apiRoutes = require('./routes/api.routes');
const membershipRoutes = require('./routes/membership.routes');
const scrapingRoutes = require('./routes/scraping.routes');

// Import middleware
const { errorHandler } = require('./middleware/error.middleware');
const { authMiddleware } = require('./middleware/auth.middleware');

// Import configs
const { connectDB } = require('./config/database');
const { initializeFirebase } = require('./config/firebase');
const { initializeRedis } = require('./config/redis');
const logger = require('./config/logger');

const app = express();

// Connect to MongoDB
connectDB();

// Initialize Firebase Admin
initializeFirebase();

// Initialize Redis
initializeRedis();

// Security Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// General Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);
app.use('/api', apiRoutes);
app.use('/api/membership', authMiddleware, membershipRoutes);
app.use('/api/scraping', authMiddleware, scrapingRoutes);

// Serve frontend routes
app.get('/', (req, res) => {
    res.render('pages/landing');
});

app.get('/dashboard', authMiddleware, (req, res) => {
    res.render('pages/dashboard');
});

app.get('/admin', authMiddleware, (req, res) => {
    res.render('pages/admin');
});

// Error handling
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
}); 