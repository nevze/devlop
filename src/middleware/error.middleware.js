const logger = require('../config/logger');

// Custom error class
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

// Global error handling middleware
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log error
    logger.error('Error:', {
        message: err.message,
        stack: err.stack,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
        body: req.body,
        user: req.user ? req.user._id : null
    });

    // Development vs Production error response
    if (process.env.NODE_ENV === 'development') {
        res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    } else {
        // Don't leak error details in production
        res.status(err.statusCode).json({
            status: err.status,
            message: err.isOperational ? err.message : 'Something went wrong'
        });
    }
};

module.exports = {
    AppError,
    errorHandler
}; 