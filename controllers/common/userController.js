const User = require('../../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const { createNotification } = require('../../utils/notification');
const RolePermission = require('../../models/RolePermission');
const mongoose = require('mongoose');

const userController = {
    // Login controller
    login: async (req, res) => {
        try {
            console.log("================trying to login");
            const { userId, password } = req.body;
            let user = await User.findOne({ userId })
                .populate('role', 'name level isSystem canManageRoles'); // Populate role information
    
            if (!user) {
                console.log("================user not found");
                return res.status(401).json({ message: 'Invalid credentials' });
            }
    
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                console.log("================password not match");
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            if (user.status !== 'active') {
                console.log("================account not active");
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
            console.log("================user.loginDetails", user.loginDetails);
            // Use save with validation
            await user.save({ validateBeforeSave: true });

            // Get role permissions if not superadmin
            let permissions = [];
            if (user.role.name !== 'superadmin') {
                const rolePermissions = await RolePermission.find({ role: user.role._id, granted: true })
                    .populate('permission', 'name')
                    .lean();
                permissions = rolePermissions.map(rp => rp.permission.name);
            }
    
            const token = jwt.sign(
                { 
                    userId: user._id, 
                    role: user.role._id,
                    roleName: user.role.name,
                    email: user.email 
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRY || '24h' }
            );
    
            res.json({
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    role: user.role.name,
                    roleId: user.role._id,
                    roleLevel: user.role.level || 0,
                    department: user.department,
                    employeeId: user.employeeId,
                    designation: user.designation,
                    position: user.position,
                    photo: user.photo,
                    permissions: user.role.name === 'superadmin' ? ['*'] : permissions
                }
            });
        } catch (error) {
            console.log("Login error:", error);
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
            const { name, email, phone } = req.body;
            const userId = req.user._id;

            // Check if email is already taken by another user
            if (email) {
                const existingUser = await User.findOne({ email, _id: { $ne: userId } });
                if (existingUser) {
                    return res.status(400).json({
                        success: false,
                        message: 'Email is already taken'
                    });
                }
            }

            const updatedUser = await User.findByIdAndUpdate(
                userId,
                {
                    $set: {
                        name,
                        email,
                        phone,
                        updatedAt: new Date()
                    }
                },
                { new: true, select: '-password' }
            );

            if (!updatedUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            res.json({
                success: true,
                data: updatedUser
            });
        } catch (error) {
            console.error('Error updating profile:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    },

    // Change password
    changePassword: async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user._id;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Verify current password
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({
                    success: false,
                    message: 'Current password is incorrect'
                });
            }

            // Hash new password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // Update password
            user.password = hashedPassword;
            user.updatedAt = new Date();
            await user.save();

            // Create notification
            await createNotification({
                userId: user._id,
                type: 'security',
                message: 'Your password has been changed successfully',
                reference: {
                    type: 'user',
                    id: user._id
                }
            });

            res.json({
                success: true,
                message: 'Password updated successfully'
            });
        } catch (error) {
            console.error('Error changing password:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
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
    },

    async updatePhoto(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No photo uploaded'
                });
            }

            const userId = req.user._id;
            const photoUrl = req.file.path;

            const updatedUser = await User.findByIdAndUpdate(
                userId,
                {
                    $set: {
                        photo: photoUrl,
                        updatedAt: new Date()
                    }
                },
                { new: true, select: '-password' }
            );

            if (!updatedUser) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            res.json({
                success: true,
                data: updatedUser
            });
        } catch (error) {
            console.error('Error updating photo:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    },

    // Get user with complete role information
    getUserWithRole: async (req, res) => {
        try {
            let user;
            const id = req.user.userId;

            // Check if the ID is a valid ObjectId
            if (mongoose.Types.ObjectId.isValid(id)) {
                user = await User.findById(id)
                    .populate('role', 'name level permissions isSystem canManageRoles')
                    .select('-password');
            }

            // If not found by _id, try to find by userId field
            if (!user) {
                user = await User.findOne({ userId: id })
                    .populate('role', 'name level permissions isSystem canManageRoles')
                    .select('-password');
            }

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Get role permissions if not superadmin
            let permissions = [];
            if (user.role.name !== 'superadmin') {
                const rolePermissions = await RolePermission.find({ role: user.role._id, granted: true })
                    .populate('permission', 'name')
                    .lean();
                permissions = rolePermissions.map(rp => rp.permission.name);
            }

            const userData = {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role.name,
                roleId: user.role._id,
                roleLevel: user.role.level || 0,
                department: user.department,
                employeeId: user.employeeId,
                designation: user.designation,
                position: user.position,
                photo: user.photo,
                permissions: user.role.name === 'superadmin' ? ['*'] : permissions,
                // Include other necessary fields
                status: user.status,
                phone: user.phone,
                dateOfJoining: user.dateOfJoining,
                type: user.type,
                projects: user.projects,
                tasks: user.tasks,
                performance: user.performance,
                totalPoints: user.totalPoints,
                attendance: user.attendance,
                loginDetails: user.loginDetails
            };

            res.json(userData);
        } catch (error) {
            logger.error('Get user with role error:', error);
            res.status(500).json({ message: 'Failed to fetch user details' });
        }
    }
};

module.exports = userController; 