const prisma = require('../config/prismaClient');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// @desc    Register user
// @route   POST /api/auth/register
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        settings: {
          currency: 'INR',
          language: 'English',
          dateFormat: 'DD/MM/YYYY',
          theme: 'dark',
          accentColor: 'indigo',
          notifications: { alerts: true, aiReminders: true, billNotifications: true },
          security: { twoFactorEnabled: false, privacyControls: true },
          ai: { insightFrequency: 'Daily', anomalyDetection: true, tone: 'Professional' },
          connectedAccounts: { bankIntegrations: false, upiLinking: false },
        },
      },
    });

    res.status(201).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      token: generateToken(user.id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    res.json({
      _id: user.id,
      name: user.name,
      email: user.email,
      token: generateToken(user.id),
      settings: user.settings,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user data
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, settings: true, createdAt: true, updatedAt: true },
    });
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile or settings
// @route   PUT /api/auth/update
exports.updateMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const updateData = {};

    if (req.body.name) updateData.name = req.body.name;
    if (req.body.email) updateData.email = req.body.email;

    if (req.body.password) {
      if (!req.body.oldPassword) return res.status(400).json({ message: 'Old password is required' });
      const isMatch = await bcrypt.compare(req.body.oldPassword, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Incorrect old password' });
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(req.body.password, salt);
    }

    if (req.body.settings) {
      const existingSettings = user.settings || {};
      updateData.settings = { ...existingSettings, ...req.body.settings };
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: { id: true, name: true, email: true, settings: true, createdAt: true, updatedAt: true },
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Forgot Password — generate reset token & send email
// @route   POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Security: don't reveal if email exists
      return res.status(200).json({ message: 'If this email is registered, a reset link has been sent.' });
    }

    // Generate secure random raw token, store hashed version
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpiry: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${rawToken}`;
    console.log('\n--- PASSWORD RESET LINK ---');
    console.log(resetUrl);
    console.log('---------------------------\n');

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Smart Budget AI" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: '🔐 Reset Your Password',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#0B0F19;color:#e2e8f0;padding:32px;border-radius:16px;">
          <h2 style="color:#818cf8;margin-bottom:8px;">🔐 Password Reset Request</h2>
          <p style="color:#94a3b8;">Hi <strong style="color:#fff;">${user.name}</strong>,</p>
          <p style="color:#94a3b8;">You requested to reset your password. This link is valid for <strong style="color:#f59e0b;">15 minutes</strong>.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${resetUrl}" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);color:white;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:16px;">
              Reset My Password →
            </a>
          </div>
          <p style="color:#64748b;font-size:13px;">Or copy this link:<br/><a href="${resetUrl}" style="color:#818cf8;">${resetUrl}</a></p>
          <hr style="border-color:#1e293b;margin:24px 0;"/>
          <p style="color:#475569;font-size:12px;">If you didn't request this, ignore this email — your password won't change.</p>
        </div>
      `,
    });

    res.status(200).json({ message: 'Password reset link sent to your email.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Failed to send reset email. Please try again.' });
  }
};

// @desc    Reset Password using token
// @route   POST /api/auth/reset-password/:token
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ message: 'Reset link is invalid or has expired.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.status(200).json({ message: 'Password reset successfully! You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Generate JWT
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });