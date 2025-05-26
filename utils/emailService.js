const nodemailer = require('nodemailer');
const path = require('path');
const ejs = require('ejs');
const logger = require('./logger');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        // Verify connection configuration
        this.transporter.verify((error, success) => {
            if (error) {
                logger.error('SMTP connection error:', error);
            } else {
                logger.info('SMTP server is ready to send emails');
            }
        });
    }

    // Load and compile email template
    async loadTemplate(templateName, data) {
        const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.ejs`);
        try {
            return await ejs.renderFile(templatePath, data);
        } catch (error) {
            logger.error(`Error loading email template ${templateName}:`, error);
            throw error;
        }
    }

    // Send email
    async sendEmail(options) {
        try {
            const mailOptions = {
                from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
                to: options.to,
                subject: options.subject,
                html: options.html
            };

            if (options.attachments) {
                mailOptions.attachments = options.attachments;
            }

            const info = await this.transporter.sendMail(mailOptions);
            logger.info('Email sent successfully:', info.messageId);
            return info;
        } catch (error) {
            logger.error('Error sending email:', error);
            throw error;
        }
    }

    // Send welcome email
    async sendWelcomeEmail(user) {
        const html = await this.loadTemplate('welcome', {
            name: user.name,
            loginUrl: `${process.env.FRONTEND_URL}/login`
        });

        return this.sendEmail({
            to: user.email,
            subject: 'Welcome to MyERP',
            html
        });
    }

    // Send password reset email
    async sendPasswordResetEmail(user, resetToken) {
        const html = await this.loadTemplate('password-reset', {
            name: user.name,
            resetUrl: `${process.env.FRONTEND_URL}/reset-password/${resetToken}`
        });

        return this.sendEmail({
            to: user.email,
            subject: 'Password Reset Request',
            html
        });
    }

    // Send task assignment notification
    async sendTaskAssignmentEmail(user, task) {
        const html = await this.loadTemplate('task-assigned', {
            name: user.name,
            taskTitle: task.title,
            taskDescription: task.description,
            dueDate: task.dueDate,
            taskUrl: `${process.env.FRONTEND_URL}/tasks/${task._id}`
        });

        return this.sendEmail({
            to: user.email,
            subject: 'New Task Assignment',
            html
        });
    }

    // Send project update notification
    async sendProjectUpdateEmail(user, project, update) {
        const html = await this.loadTemplate('project-update', {
            name: user.name,
            projectName: project.name,
            updateType: update.type,
            updateContent: update.content,
            projectUrl: `${process.env.FRONTEND_URL}/projects/${project._id}`
        });

        return this.sendEmail({
            to: user.email,
            subject: `Project Update: ${project.name}`,
            html
        });
    }

    // Send daily digest
    async sendDailyDigest(user, digest) {
        const html = await this.loadTemplate('daily-digest', {
            name: user.name,
            date: new Date().toLocaleDateString(),
            tasks: digest.tasks,
            updates: digest.updates,
            notifications: digest.notifications
        });

        return this.sendEmail({
            to: user.email,
            subject: 'Your Daily ERP Digest',
            html
        });
    }
}

// Create and export singleton instance
const emailService = new EmailService();
module.exports = emailService; 