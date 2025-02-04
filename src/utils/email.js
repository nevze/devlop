const nodemailer = require('nodemailer');
const path = require('path');
const ejs = require('ejs');
const logger = require('../config/logger');

// Create transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Verify transporter connection
transporter.verify()
    .then(() => logger.info('Email service ready'))
    .catch(err => logger.error('Email service error:', err));

// Send email function
const sendEmail = async ({ to, subject, template, context }) => {
    try {
        // Get template path
        const templatePath = path.join(__dirname, '../views/emails', `${template}.ejs`);

        // Render email template
        const html = await ejs.renderFile(templatePath, {
            ...context,
            frontendUrl: process.env.FRONTEND_URL,
            year: new Date().getFullYear()
        });

        // Send email
        const info = await transporter.sendMail({
            from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
            to,
            subject,
            html
        });

        logger.info('Email sent:', info.messageId);
        return info;
    } catch (error) {
        logger.error('Email sending error:', error);
        throw error;
    }
};

// Send bulk emails
const sendBulkEmails = async ({ to, subject, template, context, attachments = [] }) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
        const html = await ejs.renderFile(path.join(__dirname, '../views/emails', `${template}.ejs`), {
            ...context,
            frontendUrl: process.env.FRONTEND_URL,
            year: new Date().getFullYear()
        });

        const mailPromises = to.map(recipient => {
            const mailOptions = {
                from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
                to: recipient,
                subject,
                html,
                attachments
            };
            return transporter.sendMail(mailOptions);
        });

        const results = await Promise.allSettled(mailPromises);
        
        // Log results
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                logger.info(`Email sent to ${to[index]}: ${result.value.messageId}`);
            } else {
                logger.error(`Failed to send email to ${to[index]}: ${result.reason}`);
            }
        });

        return results;
    } catch (error) {
        logger.error(`Error sending bulk emails: ${error}`);
        throw error;
    }
};

// Email templates
const emailTemplates = {
    welcome: {
        subject: 'Welcome to our platform!',
        template: 'welcome'
    },
    passwordReset: {
        subject: 'Password Reset Request',
        template: 'passwordReset'
    },
    emailVerification: {
        subject: 'Please verify your email',
        template: 'emailVerification'
    },
    apiKeyCreated: {
        subject: 'New API Key Created',
        template: 'apiKeyCreated'
    },
    subscriptionChanged: {
        subject: 'Subscription Update',
        template: 'subscriptionChanged'
    },
    usageAlert: {
        subject: 'API Usage Alert',
        template: 'usageAlert'
    }
};

// Send template email helper
const sendTemplateEmail = async ({ to, templateName, context, attachments = [] }) => {
    if (!emailTemplates[templateName]) {
        throw new Error(`Email template '${templateName}' not found`);
    }

    const { subject, template } = emailTemplates[templateName];
    return sendEmail({
        to,
        subject,
        template,
        context,
        attachments
    });
};

module.exports = {
    sendEmail,
    sendBulkEmails,
    sendTemplateEmail,
    emailTemplates
}; 