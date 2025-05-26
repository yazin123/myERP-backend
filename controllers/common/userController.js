const User = require('../../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

const userController = {
    // Login controller
    login: async (req, res) => {
        try {
            const { userId, password } = req.body;
            let user = await User.findOne({ userId });
    
            if (!user) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }
    
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            if (user.status !== 'active') {
                return res.status(401).json({ message: 'Account is not active' });
            }
    
            // Ensure bankDetails is properly handled
            if (!user.bankDetails || user.bankDetails === 'N/A') {
                user.bankDetails = null;
            }

            // Update login details
            user.loginDetails = {
                lastLogin: new Date(),
                loginCount: (user.loginDetails?.loginCount || 0) + 1
            };

            // Use save with validation
            await user.save({ validateBeforeSave: true });
    
            const token = jwt.sign(
                { 
                    userId: user._id, 
                    role: user.role,
                    employeeId: user.employeeId 
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRY || '24h' }
            );
    
            res.json({
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    role: user.role,
                    department: user.department,
                    employeeId: user.employeeId,
                    designation: user.designation,
                    position: user.position,
                    photo: user.photo
                }
            });
        } catch (error) {
            logger.error('Login error:', error);
            res.status(500).json({ message: 'Login failed' });
        }
    },

    // Logout controller
    logout: async (req, res) => {
        try {
            // In the future, we might want to invalidate the token here
            res.json({ message: 'Logged out successfully' });
        } catch (error) {
            logger.error('Logout error:', error);
            res.status(500).json({ message: 'Logout failed' });
        }
    },

    // Get current user
    getCurrentUser: async (req, res) => {
        try {
            const user = await User.findById(req.user._id)
                .select('-password')
                .populate('reportingTo', 'name email employeeId')
                .populate('projects', 'name status')
                .populate('tasks', 'title status dueDate');

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.json(user);
        } catch (error) {
            logger.error('Get current user error:', error);
            res.status(500).json({ message: 'Failed to fetch user details' });
        }
    },

    // Update profile
    updateProfile: async (req, res) => {
        try {
            const user = await User.findById(req.user._id);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Fields that users can update
            const allowedUpdates = ['name', 'email', 'phone', 'address'];
            allowedUpdates.forEach(field => {
                if (req.body[field]) {
                    user[field] = req.body[field];
                }
            });

            // Handle profile photo upload
            if (req.file) {
                // Delete old photo if exists
                if (user.photo) {
                    const oldPhotoPath = path.join(__dirname, '../../uploads/photos', user.photo);
                    if (fs.existsSync(oldPhotoPath)) {
                        fs.unlinkSync(oldPhotoPath);
                    }
                }
                user.photo = req.file.filename;
            }

            await user.save();
            res.json({ message: 'Profile updated successfully', user });
        } catch (error) {
            logger.error('Update profile error:', error);
            res.status(500).json({ message: 'Failed to update profile' });
        }
    },

    // Change password
    changePassword: async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;
            const user = await User.findById(req.user._id);

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Verify current password
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Current password is incorrect' });
            }

            // Hash new password
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(newPassword, salt);
            await user.save();

            res.json({ message: 'Password changed successfully' });
        } catch (error) {
            logger.error('Change password error:', error);
            res.status(500).json({ message: 'Failed to change password' });
        }
    },

    // Get profile photo
    getProfilePhoto: async (req, res) => {
        try {
            const filename = req.params.filename;
            const photoPath = path.join(__dirname, '../../uploads/photos', filename);
            
            if (!fs.existsSync(photoPath)) {
                return res.status(404).json({ message: 'Photo not found' });
            }

            res.sendFile(photoPath);
        } catch (error) {
            logger.error('Get profile photo error:', error);
            res.status(500).json({ message: 'Failed to fetch photo' });
        }
    }
};

module.exports = userController; 