// Email service
// Handles sending emails using Nodemailer

import nodemailer from 'nodemailer';
import { log } from '../utils/logger';

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM;

    // Check if SMTP is configured
    if (!host || !port || !user || !pass || !from) {
      log.warn('SMTP not configured - email sending disabled');
      this.isConfigured = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(port),
        secure: parseInt(port) === 465, // true for 465, false for other ports
        auth: {
          user,
          pass,
        },
      });

      this.isConfigured = true;
      log.info('✅ Email service initialized');

      // Verify configuration
      this.transporter.verify((error) => {
        if (error) {
          log.error('SMTP verification failed', error);
          this.isConfigured = false;
        } else {
          log.info('✅ SMTP server ready to send emails');
        }
      });
    } catch (error) {
      log.error('Failed to initialize email service', error);
      this.isConfigured = false;
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      log.warn('Email service not configured - skipping email send');
      return false;
    }

    try {
      const from = process.env.SMTP_FROM!;
      const fromName = process.env.SMTP_FROM_NAME || 'CodeSync';

      await this.transporter.sendMail({
        from: `${fromName} <${from}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      log.info('Email sent successfully', { to: options.to, subject: options.subject });
      return true;
    } catch (error) {
      log.error('Failed to send email', { error, to: options.to });
      return false;
    }
  }

  async sendInvitation(
    email: string,
    inviterName: string,
    sessionName: string,
    token: string,
  ): Promise<boolean> {
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/${token}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Session Invitation</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .content p {
      margin: 0 0 20px 0;
      color: #555;
    }
    .session-info {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 15px 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .session-info strong {
      color: #333;
      display: block;
      margin-bottom: 5px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }
    .button:hover {
      background: linear-gradient(135deg, #5568d3 0%, #6941a0 100%);
    }
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .alt-link {
      font-size: 12px;
      color: #888;
      word-break: break-all;
      margin-top: 15px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 CodeSync Invitation</h1>
    </div>

    <div class="content">
      <p>Hi there!</p>

      <p><strong>${inviterName}</strong> has invited you to collaborate on a coding session.</p>

      <div class="session-info">
        <strong>Session Name:</strong>
        ${sessionName}
      </div>

      <p>CodeSync is a real-time collaborative code editor where you can code together, chat, and share ideas instantly.</p>

      <center>
        <a href="${inviteUrl}" class="button">Accept Invitation →</a>
      </center>

      <p class="alt-link">
        Or copy and paste this link into your browser:<br>
        <a href="${inviteUrl}">${inviteUrl}</a>
      </p>

      <p style="margin-top: 30px; font-size: 14px; color: #777;">
        This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>

    <div class="footer">
      <p>Sent by CodeSync - Real-time Collaborative Coding</p>
      <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}">Visit CodeSync</a></p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const text = `
${inviterName} has invited you to collaborate on a coding session!

Session Name: ${sessionName}

Click the link below to accept the invitation:
${inviteUrl}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

---
CodeSync - Real-time Collaborative Coding
${process.env.FRONTEND_URL || 'http://localhost:3000'}
    `.trim();

    return this.sendEmail({
      to: email,
      subject: `You're invited to collaborate on "${sessionName}"`,
      html,
      text,
    });
  }

  async sendPasswordReset(email: string, name: string, token: string): Promise<boolean> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${token}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Password Reset Request</h2>
    <p>Hi ${name},</p>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    <p><a href="${resetUrl}" class="button">Reset Password</a></p>
    <p>This link will expire in 1 hour.</p>
    <p>If you didn't request this, please ignore this email.</p>
    <p>Link: ${resetUrl}</p>
  </div>
</body>
</html>
    `.trim();

    const text = `Password Reset Request\n\nHi ${name},\n\nClick the link below to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.`;

    return this.sendEmail({
      to: email,
      subject: 'Reset your CodeSync password',
      html,
      text,
    });
  }

  async sendWelcome(email: string, name: string): Promise<boolean> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Welcome to CodeSync! 🎉</h2>
    <p>Hi ${name},</p>
    <p>Thanks for joining CodeSync! We're excited to have you on board.</p>
    <p>CodeSync is a real-time collaborative code editor that lets you code together with your team in real-time.</p>
    <h3>Getting Started:</h3>
    <ul>
      <li>Create a new coding session</li>
      <li>Invite collaborators</li>
      <li>Start coding together in real-time</li>
      <li>Use the chat to communicate</li>
    </ul>
    <p>Happy coding!</p>
    <p>The CodeSync Team</p>
  </div>
</body>
</html>
    `.trim();

    const text = `Welcome to CodeSync!\n\nHi ${name},\n\nThanks for joining! Start coding together in real-time.\n\nThe CodeSync Team`;

    return this.sendEmail({
      to: email,
      subject: 'Welcome to CodeSync!',
      html,
      text,
    });
  }
}

export default new EmailService();
