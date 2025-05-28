const User = require('../../models/User');
const Project = require('../../models/Project');
const DailyReport = require('../../models/DailyReport');
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

            // Create daily report entries
            const dailyReports = reports.map(report => ({
                user: userId,
                date: today,
                content: report.content,
                project: report.projectId,
                submissionTime: new Date(),
                status: 'submitted'
            }));

            // Save all reports
            const savedReports = await DailyReport.insertMany(dailyReports);

            // If any reports are associated with projects, notify project heads
            const projectReports = savedReports.filter(report => report.project);
            if (projectReports.length > 0) {
                const projects = await Project.find({
                    _id: { $in: projectReports.map(r => r.project) }
                }).populate('projectHead', '_id name');

                const user = await User.findById(userId).select('name');

                // Send notifications to project heads
                for (const project of projects) {
                    if (project.projectHead && project.projectHead._id.toString() !== userId.toString()) {
                        await createNotification({
                            userId: project.projectHead._id,
                            type: 'daily_report',
                            message: `${user.name} submitted a daily report for project ${project.name}`,
                            reference: {
                                type: 'project',
                                id: project._id
                            }
                        });
                    }
                }
            }

            res.status(201).json({
                success: true,
                message: 'Daily reports submitted successfully',
                data: savedReports
            });
        } catch (error) {
            console.error('Error in submitDailyReports:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to submit daily reports',
                error: error.message
            });
        }
    },

    async getDailyReports(req, res) {
        try {
            const { projectId, startDate, endDate, userId } = req.query;
            const query = {};

            // If specific user's reports are requested and user has permission
            const targetUserId = userId || req.user._id;
            if (req.user.role !== 'admin' && req.user.role !== 'manager' && targetUserId !== req.user._id) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to view other users\' reports'
                });
            }

            // Build query
            query.user = targetUserId;
            if (projectId) query.project = projectId;
            if (startDate || endDate) {
                query.date = {};
                if (startDate) query.date.$gte = new Date(startDate);
                if (endDate) query.date.$lte = new Date(endDate);
            }

            const reports = await DailyReport.find(query)
                .populate('user', 'name')
                .populate('project', 'name description')
                .sort({ date: -1, submissionTime: -1 });

            res.json({
                success: true,
                data: {
                    reports,
                    user: reports[0]?.user || { _id: targetUserId }
                }
            });
        } catch (error) {
            console.error('Error in getDailyReports:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch daily reports',
                error: error.message
            });
        }
    },

    async updateDailyReport(req, res) {
        try {
            const { reportId } = req.params;
            const { content } = req.body;
            const userId = req.user._id;

            const report = await DailyReport.findOne({ _id: reportId, user: userId });
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

            report.content = content;
            await report.save();

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            console.error('Error updating daily report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update report',
                error: error.message
            });
        }
    },

    async deleteDailyReport(req, res) {
        try {
            const { reportId } = req.params;
            const userId = req.user._id;

            const report = await DailyReport.findOne({ _id: reportId, user: userId });
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

            await report.deleteOne();

            res.json({
                success: true,
                message: 'Report deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting daily report:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete report',
                error: error.message
            });
        }
    }
};

module.exports = dailyReportController; 