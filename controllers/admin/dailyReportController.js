const User = require('../../models/User');
const Project = require('../../models/Project');
const { createNotification } = require('../../utils/notification');

const dailyReportController = {
    async submitDailyReports(req, res) {
        try {
            const { reports } = req.body;
            const userId = req.user._id;

            if (!Array.isArray(reports) || reports.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Reports array is required'
                });
            }

            // Get today's date at midnight for comparison
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Get the user
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Process each report
            for (const report of reports) {
                const { projectId, content } = report;

                // Validate project if projectId is provided
                if (projectId) {
                    const project = await Project.findById(projectId);
                    if (!project) {
                        return res.status(404).json({
                            success: false,
                            message: `Project with ID ${projectId} not found`
                        });
                    }

                    // Check if user is part of the project
                    if (!project.members.includes(userId) && 
                        project.projectHead.toString() !== userId.toString()) {
                        return res.status(403).json({
                            success: false,
                            message: `You are not authorized to submit reports for project ${project.name}`
                        });
                    }
                }

                // Create the report
                const newReport = {
                    date: today,
                    content: content,
                    submissionTime: new Date(),
                    status: 'submitted',
                    projectId: projectId || null
                };

                // Add to user's dailyReports array
                user.dailyReports.push(newReport);

                // If project exists, notify project head
                if (projectId) {
                    const project = await Project.findById(projectId);
                    await createNotification({
                        userId: project.projectHead,
                        type: 'daily_report',
                        message: `New daily report submitted by ${user.name}`,
                        reference: {
                            type: 'daily_report',
                            id: user._id
                        }
                    });
                }
            }

            // Save the user with new reports
            await user.save();

            res.status(201).json({
                success: true,
                message: 'Daily reports submitted successfully'
            });
        } catch (error) {
            console.error('Error submitting daily reports:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    },

    async getDailyReports(req, res) {
        try {
            const { startDate, endDate, projectId } = req.query;
            const query = {};

            // Add date range to query if provided
            if (startDate || endDate) {
                query.date = {};
                if (startDate) query.date.$gte = new Date(startDate);
                if (endDate) query.date.$lte = new Date(endDate);
            }

            // Add project filter if provided
            if (projectId) {
                query.projectId = projectId;
            }

            // Get users with matching reports
            const users = await User.find({
                'dailyReports': { 
                    $elemMatch: query 
                }
            }).select('name email photo dailyReports');

            // Filter and format reports
            const reports = users.flatMap(user => 
                user.dailyReports
                    .filter(report => {
                        let matches = true;
                        if (startDate) matches = matches && report.date >= new Date(startDate);
                        if (endDate) matches = matches && report.date <= new Date(endDate);
                        if (projectId) matches = matches && report.projectId?.toString() === projectId;
                        return matches;
                    })
                    .map(report => ({
                        ...report.toObject(),
                        userId: {
                            _id: user._id,
                            name: user.name,
                            email: user.email,
                            photo: user.photo
                        }
                    }))
            );

            res.json({
                success: true,
                data: reports
            });
        } catch (error) {
            console.error('Error fetching daily reports:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    },

    async updateDailyReport(req, res) {
        try {
            const { reportId } = req.params;
            const { content } = req.body;
            const userId = req.user._id;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Find the report in user's dailyReports array
            const report = user.dailyReports.id(reportId);
            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: 'Report not found'
                });
            }

            // Only allow updates within 24 hours of creation
            const hoursElapsed = (new Date() - report.submissionTime) / (1000 * 60 * 60);
            if (hoursElapsed > 24) {
                return res.status(400).json({
                    success: false,
                    message: 'Reports can only be updated within 24 hours of submission'
                });
            }

            // Update the report
            report.content = content;
            await user.save();

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            console.error('Error updating daily report:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    },

    async deleteDailyReport(req, res) {
        try {
            const { reportId } = req.params;
            const userId = req.user._id;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Find and remove the report
            const report = user.dailyReports.id(reportId);
            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: 'Report not found'
                });
            }

            // Only allow deletion within 24 hours of creation
            const hoursElapsed = (new Date() - report.submissionTime) / (1000 * 60 * 60);
            if (hoursElapsed > 24) {
                return res.status(400).json({
                    success: false,
                    message: 'Reports can only be deleted within 24 hours of submission'
                });
            }

            report.remove();
            await user.save();

            res.json({
                success: true,
                message: 'Report deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting daily report:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }
};

module.exports = dailyReportController; 