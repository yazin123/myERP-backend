const Project = require('../../models/Project');
const Task = require('../../models/Task');
const User = require('../../models/User');
const Performance = require('../../models/Performance');
const logger = require('../../utils/logger');

const dashboardController = {
    // Get dashboard statistics
    getDashboardStats: async (req, res) => {
        try {
            // Project Statistics
            const projectStats = await Project.aggregate([
                {
                    $facet: {
                        'totalProjects': [{ $count: 'count' }],
                        'projectsByStatus': [
                            { $group: { _id: '$status', count: { $sum: 1 } } }
                        ],
                        'projectsByPriority': [
                            { $group: { _id: '$priority', count: { $sum: 1 } } }
                        ],
                        'avgProgress': [
                            { $group: { _id: null, avg: { $avg: '$progress' } } }
                        ]
                    }
                }
            ]);

            // Task Statistics
            const taskStats = await Task.aggregate([
                {
                    $facet: {
                        'totalTasks': [{ $count: 'count' }],
                        'tasksByStatus': [
                            { $group: { _id: '$status', count: { $sum: 1 } } }
                        ],
                        'tasksByPriority': [
                            { $group: { _id: '$priority', count: { $sum: 1 } } }
                        ],
                        'upcomingDeadlines': [
                            {
                                $match: {
                                    status: { $nin: ['Completed', 'Cancelled'] },
                                    deadline: {
                                        $gte: new Date(),
                                        $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                                    }
                                }
                            },
                            { $count: 'count' }
                        ]
                    }
                }
            ]);

            // User Statistics
            const userStats = await User.aggregate([
                {
                    $facet: {
                        'totalUsers': [{ $count: 'count' }],
                        'usersByRole': [
                            { $group: { _id: '$role', count: { $sum: 1 } } }
                        ],
                        'activeUsers': [
                            { $match: { status: 'active' } },
                            { $count: 'count' }
                        ]
                    }
                }
            ]);

            // Recent Projects with Details
            const recentProjects = await Project.find()
                .sort({ createdAt: -1 })
                .limit(5)
                .populate('projectHead', 'name email')
                .populate('members', 'name email')
                .select('name description status priority progress startDate endDate');

            // Upcoming Deadlines
            const upcomingDeadlines = await Task.find({
                status: { $nin: ['Completed', 'Cancelled'] },
                deadline: {
                    $gte: new Date(),
                    $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }
            })
            .sort({ deadline: 1 })
            .limit(5)
            .populate('assignedTo', 'name email')
            .populate('project', 'name')
            .select('description deadline status priority');

            // Performance Overview
            const performanceStats = await Performance.aggregate([
                {
                    $facet: {
                        'overallPerformance': [
                            {
                                $group: {
                                    _id: null,
                                    avgPoints: { $avg: '$points' },
                                    totalPoints: { $sum: '$points' }
                                }
                            }
                        ],
                        'performanceByCategory': [
                            {
                                $group: {
                                    _id: '$category',
                                    avgPoints: { $avg: '$points' },
                                    count: { $sum: 1 }
                                }
                            }
                        ]
                    }
                }
            ]);

            // Format response
            const response = {
                projects: {
                    total: projectStats[0].totalProjects[0]?.count || 0,
                    byStatus: projectStats[0].projectsByStatus,
                    byPriority: projectStats[0].projectsByPriority,
                    avgProgress: projectStats[0].avgProgress[0]?.avg || 0,
                    recent: recentProjects
                },
                tasks: {
                    total: taskStats[0].totalTasks[0]?.count || 0,
                    byStatus: taskStats[0].tasksByStatus,
                    byPriority: taskStats[0].tasksByPriority,
                    upcomingCount: taskStats[0].upcomingDeadlines[0]?.count || 0,
                    upcoming: upcomingDeadlines
                },
                users: {
                    total: userStats[0].totalUsers[0]?.count || 0,
                    byRole: userStats[0].usersByRole,
                    active: userStats[0].activeUsers[0]?.count || 0
                },
                performance: {
                    overall: performanceStats[0].overallPerformance[0] || { avgPoints: 0, totalPoints: 0 },
                    byCategory: performanceStats[0].performanceByCategory || []
                }
            };

            res.json({
                success: true,
                data: response
            });
        } catch (error) {
            logger.error('Error fetching dashboard stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch dashboard statistics',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
};

module.exports = dashboardController; 