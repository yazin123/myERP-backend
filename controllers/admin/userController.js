
// controllers/admin/userController.js
const User = require('../../models/User');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Helper function to remove files
const removeFile = (filePath) => {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
};

const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
};

const comparePassword = async (password, hashedPassword) => {
    return bcrypt.compare(password, hashedPassword);
};

const userController = {
    // Login controller
    login: async (req, res) => {
        try {
            const { userId, password } = req.body;
            const user = await User.findOne({ userId });
    
            if (!user || !['admin', 'superadmin'].includes(user.role)) {
                return res.status(401).json({ message: 'Access denied' });
            }
    
            const isMatch = await comparePassword(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }
    
            user.loginDetails = {
                lastLogin: new Date(),
                loginCount: (user.loginDetails?.loginCount || 0) + 1
            };
            await user.save();
    
            const token = jwt.sign(
                { userId: user._id, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
    
            res.json({
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    role: user.role,
                    department: user.department
                }
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Get all users with search and filters
    getAllUsers: async (req, res) => {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                department,
                position,
                status,
                sortBy = 'name',
                order = 'asc'
            } = req.query;

            const query = {};

            // Search functionality
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { userId: { $regex: search, $options: 'i' } }
                ];
            }

            // Filters
            if (department) query.department = department;
            if (position) query.position = position;
            if (status) query.status = status;

            // Sorting
            const sortOption = {};
            sortOption[sortBy] = order === 'desc' ? -1 : 1;

            const users = await User.find(query)
                .sort(sortOption)
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .select('-password');

            const total = await User.countDocuments(query);

            res.json({
                users,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                total
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Get user by ID
    getUserById: async (req, res) => {
        try {
            const user = await User.findById(req.params.id)
                .select('-password')
                .populate('tasks');
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            res.json(user);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Add new user
    addUser: async (req, res) => {
        console.log("creating user")
        try {
            const {
                userId,
                password,
                name,
                email,
                phoneNumber,
                department,
                position,
                role,
                salary,
                bankDetails
            } = req.body;
    
            // Prevent admin from creating superadmin users
            if (req.user.role === 'admin' && req.body.role === 'superadmin') {
                if (req.files) {
                    // Clean up files if provided (but should not create the user)
                    if (req.files.photo) removeFile(req.files.photo[0].path);
                    if (req.files.resume) removeFile(req.files.resume[0].path);
                }
                return res.status(403).json({
                    message: 'Admin cannot create superadmin users'
                });
            }
    
            // Check for existing user
            const existingUser = await User.findOne({ $or: [{ userId }, { email }] });
            if (existingUser) {
                if (req.files) {
                    // Remove uploaded files if user creation fails
                    if (req.files.photo) removeFile(req.files.photo[0].path);
                    if (req.files.resume) removeFile(req.files.resume[0].path);
                }
                console.log("User ID or email already exists")
                return res.status(400).json({ message: 'User ID or email already exists' });
            }
    
            const hashedPassword = await hashPassword(password);
    
            const newUser = new User({
                idNumber: `EMP${Date.now()}`,
                userId,
                password: hashedPassword,
                name,
                email,
                phoneNumber,
                department,
                position,
                dateOfJoining: new Date(),
                role,
                salary,
                bankDetails,
                // Only set photo and resume if files are uploaded
                photo: req.files?.photo ? req.files.photo[0].path : undefined,
                resume: req.files?.resume ? req.files.resume[0].path : undefined
            });
    
            await newUser.save();
            res.status(201).json({
                message: 'User created successfully',
                user: {
                    ...newUser._doc,
                    password: undefined
                }
            });
        } catch (error) {
            if (req.files) {
                // Clean up uploaded files if creation fails
                if (req.files.photo) removeFile(req.files.photo[0].path);
                if (req.files.resume) removeFile(req.files.resume[0].path);
            }
            console.log("error creating user :", error)
            res.status(500).json({ message: error.message });
        }
    },
    
    updateUserById: async (req, res) => {
        try {
            console.log("updating the details of", req.params.id)
            const user = await User.findById(req.params.id);
    
            if (!user) {
                // Clean up uploaded files if user not found
                if (req.files) {
                    if (req.files.photo) removeFile(req.files.photo[0].path);
                    if (req.files.resume) removeFile(req.files.resume[0].path);
                }
                return res.status(404).json({ message: 'User not found' });
            }
    
            // Prevent admin from updating superadmin users
            if (req.user.role === 'admin' && (user.role === 'superadmin' || req.body.role === 'superadmin')) {
                if (req.files) {
                    // Remove files if provided
                    if (req.files.photo) removeFile(req.files.photo[0].path);
                    if (req.files.resume) removeFile(req.files.resume[0].path);
                }
                return res.status(403).json({
                    message: 'Admin cannot modify superadmin users'
                });
            }
    
            // Handle file updates if files are provided
            if (req.files) {
                if (req.files.photo) {
                    if (user.photo) removeFile(user.photo); // Remove old photo if it exists
                    user.photo = req.files.photo[0].path;  // Update with new photo
                }
                if (req.files.resume) {
                    if (user.resume) removeFile(user.resume); // Remove old resume if it exists
                    user.resume = req.files.resume[0].path;  // Update with new resume
                }
            }
    
            // Handle password update if provided
            if (req.body.password) {
                req.body.password = await hashPassword(req.body.password);
            }
    
            // Update other fields
            Object.keys(req.body).forEach(key => {
                user[key] = req.body[key];
            });
    
            await user.save();
            res.json({ message: 'User updated successfully', user: { ...user._doc, password: undefined } });
        } catch (error) {
            if (req.files) {
                // Clean up uploaded files if update fails
                if (req.files.photo) removeFile(req.files.photo[0].path);
                if (req.files.resume) removeFile(req.files.resume[0].path);
            }
            res.status(500).json({ message: error.message });
        }
    }
,    
    // Delete user
    deleteUserById: async (req, res) => {
        try {
            const user = await User.findById(req.params.id);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Remove associated files
            if (user.photo) removeFile(user.photo);
            if (user.resume) removeFile(user.resume);

            await User.findByIdAndDelete(req.params.id);
            res.json({ message: 'User deleted successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Update user status
    updateStatusUserById: async (req, res) => {
        try {
            const { status } = req.body;
            if (!['active', 'inactive', 'archived'].includes(status)) {
                return res.status(400).json({ message: 'Invalid status' });
            }

            const user = await User.findByIdAndUpdate(
                req.params.id,
                { status },
                { new: true }
            );

            if (req.user.role === 'admin' && user.role === 'superadmin') {
                return res.status(403).json({ 
                    message: 'Admin cannot modify superadmin status' 
                });
            }

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.json({ message: 'Status updated successfully', user });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
};

module.exports = userController;




