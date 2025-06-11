const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

// Create reusable transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
};

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.template - Template name
 * @param {Object} options.context - Template variables
 * @returns {Promise<void>}
 */
const sendEmail = async ({ to, subject, template, context }) => {
    try {
        // Read template file
        const templatePath = path.join(__dirname, '../templates/email', `${template}.hbs`);
        const templateContent = await fs.readFile(templatePath, 'utf-8');
        
        // Compile template
        const compiledTemplate = handlebars.compile(templateContent);
        const html = compiledTemplate(context);

        // Create transporter
        const transporter = createTransporter();

        // Send email
        await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to,
            subject,
            html
        });

        logger.info(`Email sent successfully to ${to}`);
    } catch (error) {
        logger.error('Error sending email:', error);
        throw error;
    }
};

module.exports = {
    sendEmail
}; 