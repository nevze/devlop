const logger = require('../config/logger');

class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        return sendErrorDev(err, req, res);
    }

    let error = { ...err };
    error.message = err.message;

    // Mongoose duplicate key
    if (err.code === 11000) {
        const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
        const message = `Duplicate field value: ${value}. Please use another value!`;
        error = new AppError(message, 400);
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(el => el.message);
        const message = `Invalid input data. ${errors.join('. ')}`;
        error = new AppError(message, 400);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        error = new AppError('Invalid token. Please log in again!', 401);
    }
    if (err.name === 'TokenExpiredError') {
        error = new AppError('Your token has expired! Please log in again.', 401);
    }

    // Firebase errors
    if (err.code === 'auth/id-token-expired') {
        error = new AppError('Your session has expired. Please log in again.', 401);
    }
    if (err.code === 'auth/invalid-id-token') {
        error = new AppError('Invalid authentication. Please log in again.', 401);
    }

    return sendErrorProd(error, req, res);
};

const sendErrorDev = (err, req, res) => {
    logger.error('ERROR 💥', err);
    return res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack
    });
};

const sendErrorProd = (err, req, res) => {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
        logger.error('Operational ERROR 💥', err);
        return res.status(err.statusCode).json({
            status: err.status,
            message: err.message
        });
    }
    
    // Programming or other unknown error: don't leak error details
    logger.error('Programming ERROR 💥', err);
    return res.status(500).json({
        status: 'error',
        message: 'Something went wrong!'
    });
};

module.exports = {
    AppError,
    errorHandler
}; 