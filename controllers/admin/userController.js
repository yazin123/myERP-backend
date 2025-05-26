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
            let user = await User.findOne({ userId });
    
            if (!user) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }
    
            const isMatch = await user.comparePassword(password);
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
                { expiresIn: '24h' }
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
                    position: user.position
                }
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Get all users with search and filters
    getAllUsers: async (req, res) => {
        try {
            console.log("getAllUsers", req.query);
            const {
                page = 1,
                limit = 10,
                search,
                department,
                designation,
                role,
                position,
                status,
                sortBy = 'name',
                order = 'asc',
                includeSuperAdmin = false // New parameter to control superadmin visibility
            } = req.query;

            const query = {};

            // By default, exclude superadmin from regular listings
            if (!includeSuperAdmin) {
                query.role = { $ne: 'superadmin' };
            }

            // Search functionality
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { userId: { $regex: search, $options: 'i' } },
                    { employeeId: { $regex: search, $options: 'i' } }
                ];
            }

            // Filters
            if (department) query.department = department;
            if (designation) query.designation = designation;
            if (role && role !== 'all') query.role = role;
            if (position) query.position = position;
            if (status) query.status = status;

            // Sorting
            const sortOption = {};
            sortOption[sortBy] = order === 'desc' ? -1 : 1;

            const users = await User.find(query)
                .sort(sortOption)
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .select('-password')
                .populate('reportingTo', 'name email employeeId')
                .populate('projects', 'name status')
                .populate('tasks', 'title status dueDate');

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

    // Get available managers
    getManagers: async (req, res) => {
        try {
            const managers = await User.find({
                $or: [
                    { role: { $in: ['manager', 'admin', 'superadmin'] } },
                    { position: 'senior' }
                ],
                status: 'active'
            })
            .select('_id name email employeeId designation department')
            .sort('name');

            res.json({
                success: true,
                data: managers
            });
        } catch (error) {
            res.status(500).json({ 
                success: false,
                message: 'Failed to fetch managers'
            });
        }
    },

    // Get user by ID
    getUserById: async (req, res) => {
        try {
          
            const user = await User.findById(req.params.id)
                .select('-password')
                .populate('reportingTo', 'name email employeeId')
                .populate('projects', 'name status')
                .populate('tasks', 'title status dueDate');

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
           
            res.json(user);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Add getCurrentUser method
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
            res.status(500).json({ message: error.message });
        }
    },

    // Update addUser to handle FormData and role restrictions
    addUser: async (req, res) => {
        try {
            const {
                userId,
                password,
                name,
                email,
                phone,
                department,
                position,
                role,
                designation,
                salary,
                bankDetails,
                skills,
                reportingTo,
                allowedWifiNetworks
            } = req.body;
    
            // Role restriction checks
            if (req.user.role === 'admin' && role === 'superadmin') {
                if (req.files) {
                    if (req.files.photo) removeFile(req.files.photo[0].path);
                    if (req.files.resume) removeFile(req.files.resume[0].path);
                }
                return res.status(403).json({
                    message: 'Admin cannot create superadmin users'
                });
            }
    
            // Check for existing user
            const existingUser = await User.findOne({ 
                $or: [
                    { userId }, 
                    { email }
                ] 
            });

            if (existingUser) {
                if (req.files) {
                    if (req.files.photo) removeFile(req.files.photo[0].path);
                    if (req.files.resume) removeFile(req.files.resume[0].path);
                }
                return res.status(400).json({ 
                    message: 'User ID or email already exists' 
                });
            }

            // Handle file uploads
            let photo = null;
            let resume = null;

            if (req.files) {
                if (req.files.photo) {
                    photo = req.files.photo[0].path;
                }
                if (req.files.resume) {
                    resume = {
                        filename: req.files.resume[0].originalname,
                        fileUrl: req.files.resume[0].path,
                        uploadDate: new Date()
                    };
            }
            }

            // Parse JSON strings from FormData
            const parsedSkills = skills ? JSON.parse(skills) : [];
            const parsedWifiNetworks = allowedWifiNetworks ? JSON.parse(allowedWifiNetworks) : [];
            const parsedSalary = salary ? Number(salary) : 0;

            const user = new User({
                userId,
                password,
                name,
                email,
                phone,
                department,
                position,
                role: role || 'employee',
                designation,
                salary: parsedSalary,
                bankDetails,
                dateOfJoining: new Date(),
                skills: parsedSkills,
                photo,
                resume,
                reportingTo,
                allowedWifiNetworks: parsedWifiNetworks,
                createdBy: req.user._id
            });
    
            await user.save();

            res.status(201).json({
                success: true,
                data: user
            });
        } catch (error) {
            // Clean up uploaded files if user creation fails
            if (req.files) {
                if (req.files.photo) removeFile(req.files.photo[0].path);
                if (req.files.resume) removeFile(req.files.resume[0].path);
            }
            res.status(500).json({ message: error.message });
        }
    },
    
    // Update updateUser to handle role restrictions
    updateUser: async (req, res) => {
        try {
            console.log("updateUser - Request Body:", req.body);
            console.log("updateUser - Files:", req.files);
            const userId = req.params.id;
            const updates = { ...req.body };
            
            // Get the target user
            const targetUser = await User.findById(userId);
            if (!targetUser) {
                return res.status(404).json({ message: 'User not found' });
            }
    
            console.log("updateUser - Target User:", {
                id: targetUser._id,
                role: targetUser.role,
                currentUserRole: req.user.role
            });

            // Role update restrictions
            if (updates.role) {
                // Only superadmin can change roles to/from superadmin
                if ((updates.role === 'superadmin' || targetUser.role === 'superadmin') && 
                    req.user.role !== 'superadmin') {
                    return res.status(403).json({ 
                        message: 'Only superadmin can modify superadmin role' 
                    });
                }

                // Admin cannot change other admin roles
                if (req.user.role === 'admin' && targetUser.role === 'admin') {
                    return res.status(403).json({
                        message: 'Admin cannot modify other admin roles' 
                    });
                }
            }

            // Sensitive field restrictions
            if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
                // Remove sensitive fields if not admin/superadmin
                delete updates.salary;
                delete updates.bankDetails;
                delete updates.role;
            }

            // Handle reportingTo field
            if (updates.reportingTo) {
                if (typeof updates.reportingTo === 'string') {
                    try {
                        const reportingToObj = JSON.parse(updates.reportingTo);
                        updates.reportingTo = reportingToObj._id;
                    } catch (e) {
                        // If it's already an ID string, keep it as is
                        if (!/^[0-9a-fA-F]{24}$/.test(updates.reportingTo)) {
                            delete updates.reportingTo;
                        }
                    }
                } else if (typeof updates.reportingTo === 'object' && updates.reportingTo._id) {
                    updates.reportingTo = updates.reportingTo._id;
                } else {
                    delete updates.reportingTo;
                }
            }
    
            // Handle arrays and embedded documents
            const arrayFields = ['skills', 'allowedWifiNetworks', 'attendance', 'performance', 'dailyReports', 'projects', 'tasks'];
            arrayFields.forEach(field => {
                if (field in updates) {
                    // If it's a string representation of an array, parse it
                    if (typeof updates[field] === 'string') {
                        try {
                            updates[field] = JSON.parse(updates[field]);
                        } catch (e) {
                            // If parsing fails and it's skills, treat as comma-separated
                            if (field === 'skills') {
                                updates[field] = updates[field].split(',').map(s => s.trim()).filter(Boolean);
                            } else {
                                // For other arrays, if parsing fails, remove the field
                                delete updates[field];
                            }
                        }
                    }
                    // If the field is an empty array string or null, remove it
                    if (updates[field] === '[]' || updates[field] === null) {
                        delete updates[field];
                    }
                }
            });

            // Handle nested objects
            const objectFields = ['bankDetails', 'emergencyContact', 'loginDetails'];
            objectFields.forEach(field => {
                if (field in updates && typeof updates[field] === 'string') {
                    try {
                        updates[field] = JSON.parse(updates[field]);
                    } catch (e) {
                        delete updates[field];
                    }
                }
            });

            // Convert date strings to Date objects
            const dateFields = ['dateOfBirth', 'dateOfJoining'];
            dateFields.forEach(field => {
                if (updates[field]) {
                    try {
                        updates[field] = new Date(updates[field]);
                    } catch (e) {
                        delete updates[field];
                    }
                }
            });

            // Handle salary as number
            if ('salary' in updates) {
                updates.salary = Number(updates.salary) || delete updates.salary;
            }

            // Remove empty or null values but keep falsy values that might be intentional
            Object.keys(updates).forEach(key => {
                if (updates[key] === null || updates[key] === undefined) {
                    delete updates[key];
                }
            });

            // Debug: Log the final updates object
            console.log('Final updates object:', updates);

            // Handle file uploads
            if (req.files) {
                if (req.files.photo) {
                    // Remove old photo if exists
                    if (targetUser.photo) {
                        removeFile(path.join(__dirname, '../../uploads/photos', targetUser.photo));
                    }
                    updates.photo = req.files.photo[0].filename;
                }
                if (req.files.resume) {
                    // Remove old resume if exists
                    if (targetUser.resume) {
                        removeFile(path.join(__dirname, '../../uploads/resumes', targetUser.resume));
                    }
                    updates.resume = {
                        filename: req.files.resume[0].originalname,
                        fileUrl: req.files.resume[0].filename,
                        uploadDate: new Date()
                    };
                }
            }

            // Update user with proper MongoDB operator
            const updatedUser = await User.findByIdAndUpdate(
                userId,
                { $set: updates },
                { 
                    new: true, 
                    runValidators: true,
                    strict: true
                }
            )
            .select('-password')
            .populate('reportingTo', 'name email employeeId')
            .populate('projects', 'name status')
            .populate('tasks', 'title status dueDate');

            if (!updatedUser) {
                return res.status(404).json({ message: 'User not found after update' });
            }

            // Debug: Log the updated user
            console.log('Updated user:', updatedUser);

            res.json(updatedUser);
        } catch (error) {
            console.error('Update error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
                validationErrors: error.errors
            });
            // Send back more detailed error information
            res.status(400).json({ 
                message: error.message,
                validationErrors: error.errors
            });
        }
    },

    // Change password
    changePassword: async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;
            const user = await User.findById(req.params.id);

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) {
                return res.status(401).json({ message: 'Current password is incorrect' });
            }

            user.password = newPassword;
            await user.save();

            res.json({ message: 'Password updated successfully' });
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },

    // Delete user
    deleteUser: async (req, res) => {
        try {
            const user = await User.findById(req.params.id);

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Delete associated files
            if (user.photo) {
                removeFile(user.photo);
            }
            if (user.resume?.fileUrl) {
                removeFile(user.resume.fileUrl);
            }

            await user.remove();

            res.json({
                success: true,
                message: 'User deleted successfully'
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Get user performance
    getUserPerformance: async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            const user = await User.findById(req.params.id);

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const performance = {
                totalPoints: user.totalPoints,
                attendancePercentage: user.calculateAttendancePercentage(
                    new Date(startDate),
                    new Date(endDate)
                ),
                performanceScore: user.calculatePerformanceScore(
                    new Date(startDate),
                    new Date(endDate)
                ),
                details: user.performance.filter(p =>
                    p.date >= new Date(startDate) && p.date <= new Date(endDate)
                )
            };

            res.json({
                success: true,
                data: performance
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
};

module.exports = userController;





