const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
const logger = require('../config/logger');

// Create reusable transporter
const createTransporter = () => {
    if (process.env.NODE_ENV === 'production') {
        // Production transporter (e.g., SendGrid, AWS SES)
        return nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE,
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    } else {
        // Development transporter (ethereal.email)
        return nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: process.env.DEV_EMAIL_USERNAME,
                pass: process.env.DEV_EMAIL_PASSWORD
            }
        });
    }
};

// Load email template
const loadTemplate = async (templateName, context) => {
    const templatePath = path.join(__dirname, '../views/emails', `${templateName}.ejs`);
    try {
        const template = await ejs.renderFile(templatePath, context);
        return template;
    } catch (error) {
        logger.error(`Error loading email template: ${error}`);
        throw error;
    }
};

// Send email
const sendEmail = async ({ to, subject, template, context, attachments = [] }) => {
    try {
        const transporter = createTransporter();
        const html = await loadTemplate(template, context);

        const mailOptions = {
            from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
            to,
            subject,
            html,
            attachments
        };

        const info = await transporter.sendMail(mailOptions);
        logger.info(`Email sent: ${info.messageId}`);

        if (process.env.NODE_ENV !== 'production') {
            logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
        }

        return info;
    } catch (error) {
        logger.error(`Error sending email: ${error}`);
        throw error;
    }
};

// Send bulk emails
const sendBulkEmails = async ({ to, subject, template, context, attachments = [] }) => {
    try {
        const transporter = createTransporter();
        const html = await loadTemplate(template, context);

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