const User = require('../../models/User');
const Project = require('../../models/Project');
const DailyReport = require('../../models/DailyReport');
const { createNotification } = require('../../utils/notification');

const dailyReportController = {
    async submitDailyReports(req, res) {
        try {
            const { tasks, hours, projectId } = req.body;
            const userId = req.user._id;

            if (!tasks || !hours) {
                return res.status(400).json({
                    success: false,
                    message: 'Tasks and hours are required'
                });
            }

            // Get today's date at midnight for comparison
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Create the report
            const report = new DailyReport({
                user: userId,
                date: today,
                tasks,
                hours,
                project: projectId,
                submissionTime: new Date()
            });

            // Save the report
            await report.save();

            // If project exists, notify project head
            if (projectId) {
                const project = await Project.findById(projectId);
                if (project && project.projectHead.toString() !== userId.toString()) {
                    await createNotification({
                        userId: project.projectHead,
                        type: 'daily_report',
                        message: `New daily report submitted for project ${project.name}`,
                        reference: {
                            type: 'daily_report',
                            id: report._id
                        }
                    });
                }
            }

            res.status(201).json({
                success: true,
                message: 'Daily report submitted successfully',
                data: report
            });
        } catch (error) {
            console.error('Error in submitDailyReports:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to submit daily report',
                error: error.message
            });
        }
    },

    async getDailyReports(req, res) {
        try {
            const { startDate, endDate, projectId } = req.query;
            const userId = req.user._id;
            const query = { user: userId };

            // Add date range to query if provided
            if (startDate || endDate) {
                query.date = {};
                if (startDate) query.date.$gte = new Date(startDate);
                if (endDate) query.date.$lte = new Date(endDate);
            }

            // Add project filter if provided
            if (projectId) {
                query.project = projectId;
            }

            const reports = await DailyReport.find(query)
                .populate('project', 'name')
                .sort({ date: -1, submissionTime: -1 });

            res.json({
                success: true,
                data: reports
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
            const { tasks, hours } = req.body;
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

            report.tasks = tasks;
            report.hours = hours;
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