const Employee = require('../../models/Employee');
const { createNotification } = require('../../utils/notification');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const employeeController = {
    // Create new employee
    async createEmployee(req, res) {
        try {
            const {
                employeeId,
                name,
                email,
                phone,
                designation,
                role,
                department,
                joiningDate,
                skills,
                reportingTo,
                allowedWifiNetworks
            } = req.body;

            // Handle resume file upload
            let resume = null;
            if (req.file) {
                resume = {
                    filename: req.file.originalname,
                    fileUrl: req.file.path,
                    uploadDate: new Date()
                };
            }

            const employee = new Employee({
                employeeId,
                name,
                email,
                phone,
                designation,
                role,
                department,
                joiningDate: new Date(joiningDate),
                skills: skills ? JSON.parse(skills) : [],
                resume,
                reportingTo,
                allowedWifiNetworks: allowedWifiNetworks ? JSON.parse(allowedWifiNetworks) : []
            });

            await employee.save();

            // Notify HR and reporting manager
            await createNotification({
                userId: req.user._id,
                type: 'employee_created',
                message: `New employee ${name} has been added`,
                reference: {
                    type: 'employee',
                    id: employee._id
                }
            });

            res.status(201).json({
                success: true,
                data: employee
            });
        } catch (error) {
            console.log('Error creating employee:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    },

    // Get all employees with filters
    async getEmployees(req, res) {
        try {
            const {
                designation,
                role,
                department,
                status,
                search,
                page = 1,
                limit = 10
            } = req.query;

            const query = {};

            if (designation) query.designation = designation;
            if (role) query.role = role;
            if (department) query.department = department;
            if (status) query.status = status;
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { employeeId: { $regex: search, $options: 'i' } }
                ];
            }

            const employees = await Employee.find(query)
                .populate('reportingTo', 'name email')
                .populate('projects', 'name status')
                .skip((page - 1) * limit)
                .limit(limit)
                .sort({ createdAt: -1 });

            const total = await Employee.countDocuments(query);

            res.status(200).json({
                success: true,
                data: employees,
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    page: parseInt(page),
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            console.log('Error getting employees:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Get single employee
    async getEmployee(req, res) {
        try {
            const employee = await Employee.findById(req.params.id)
                .populate('reportingTo', 'name email')
                .populate('projects', 'name status');

            if (!employee) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }

            res.status(200).json({
                success: true,
                data: employee
            });
        } catch (error) {
            console.log('Error getting employee:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Update employee
    async updateEmployee(req, res) {
        try {
            const updates = req.body;
            
            // Handle resume file update
            if (req.file) {
                updates.resume = {
                    filename: req.file.originalname,
                    fileUrl: req.file.path,
                    uploadDate: new Date()
                };

                // Delete old resume file if exists
                const employee = await Employee.findById(req.params.id);
                if (employee.resume?.fileUrl) {
                    await fs.unlink(employee.resume.fileUrl);
                }
            }

            const employee = await Employee.findByIdAndUpdate(
                req.params.id,
                updates,
                { new: true, runValidators: true }
            );

            if (!employee) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }

            res.status(200).json({
                success: true,
                data: employee
            });
        } catch (error) {
            console.log('Error updating employee:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    },

    // Delete employee
    async deleteEmployee(req, res) {
        try {
            const employee = await Employee.findById(req.params.id);

            if (!employee) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }

            // Delete resume file if exists
            if (employee.resume?.fileUrl) {
                await fs.unlink(employee.resume.fileUrl);
            }

            await employee.remove();

            res.status(200).json({
                success: true,
                message: 'Employee deleted successfully'
            });
        } catch (error) {
            console.log('Error deleting employee:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Record attendance with WiFi validation
    async recordAttendance(req, res) {
        try {
            const { wifiSSID, macAddress } = req.body;
            const employee = await Employee.findById(req.params.id);

            if (!employee) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }

            // Validate WiFi network
            const isValidWifi = employee.allowedWifiNetworks.some(network => 
                network.ssid === wifiSSID && network.macAddress === macAddress
            );

            if (!isValidWifi) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid WiFi network'
                });
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let attendance = employee.attendance.find(a => 
                a.date.toDateString() === today.toDateString()
            );

            if (!attendance) {
                attendance = {
                    date: today,
                    checkIn: new Date(),
                    wifiValidated: true,
                    wifiSSID,
                    status: 'present'
                };
                employee.attendance.push(attendance);
            } else {
                attendance.checkOut = new Date();
            }

            await employee.save();

            res.status(200).json({
                success: true,
                data: attendance
            });
        } catch (error) {
            console.log('Error recording attendance:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Submit daily report
    async submitDailyReport(req, res) {
        try {
            const { content } = req.body;
            const employee = await Employee.findById(req.params.id);

            if (!employee) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const report = {
                date: today,
                content,
                submissionTime: new Date(),
                status: new Date().getHours() >= 18 ? 'late' : 'submitted'
            };

            employee.dailyReports.push(report);
            await employee.save();

            res.status(200).json({
                success: true,
                data: report
            });
        } catch (error) {
            console.log('Error submitting daily report:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    },

    // Get employee performance
    async getPerformance(req, res) {
        try {
            const { startDate, endDate } = req.query;
            const employee = await Employee.findById(req.params.id);

            if (!employee) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }

            const performance = {
                totalPoints: employee.totalPoints,
                attendancePercentage: employee.calculateAttendancePercentage(
                    new Date(startDate),
                    new Date(endDate)
                ),
                performanceScore: employee.calculatePerformanceScore(
                    new Date(startDate),
                    new Date(endDate)
                ),
                details: employee.performance.filter(p =>
                    p.date >= new Date(startDate) && p.date <= new Date(endDate)
                )
            };

            res.status(200).json({
                success: true,
                data: performance
            });
        } catch (error) {
            console.log('Error getting performance:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
};

module.exports = employeeController; 