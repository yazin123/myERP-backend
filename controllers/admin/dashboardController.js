const User = require('../../models/User');
const Project = require('../../models/Project');
const Department = require('../../models/Department');

const dashboardController = {
    // Get overall dashboard overview
    async getOverview(req, res) {
        try {
            const [
                totalUsers,
                totalProjects,
                totalDepartments,
                activeProjects,
                completedProjects
            ] = await Promise.all([
                User.countDocuments({ isActive: true }),
                Project.countDocuments(),
                Department.countDocuments(),
                Project.countDocuments({ status: 'in_progress' }),
                Project.countDocuments({ status: 'completed' })
            ]);

            res.json({
                success: true,
                data: {
                    totalUsers,
                    totalProjects,
                    totalDepartments,
                    activeProjects,
                    completedProjects
                }
            });
        } catch (error) {
            console.error('Error in getOverview:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch dashboard overview',
                error: error.message
            });
        }
    },

    // Get user-related metrics
    async getUserMetrics(req, res) {
        try {
            const [
                totalUsers,
                activeUsers,
                usersByDepartment,
                recentlyJoinedUsers
            ] = await Promise.all([
                User.countDocuments(),
                User.countDocuments({ isActive: true }),
                User.aggregate([
                    { $group: { _id: '$department', count: { $sum: 1 } } },
                    { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
                    { $unwind: '$department' },
                    { $project: { department: '$department.name', count: 1 } }
                ]),
                User.find()
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .select('name email department createdAt')
                    .populate('department', 'name')
            ]);

            res.json({
                success: true,
                data: {
                    totalUsers,
                    activeUsers,
                    usersByDepartment,
                    recentlyJoinedUsers
                }
            });
        } catch (error) {
            console.error('Error in getUserMetrics:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch user metrics',
                error: error.message
            });
        }
    },

    // Get project-related metrics
    async getProjectMetrics(req, res) {
        try {
            const [
                projectsByStatus,
                projectsByDepartment,
                recentProjects
            ] = await Promise.all([
                Project.aggregate([
                    { $group: { _id: '$status', count: { $sum: 1 } } }
                ]),
                Project.aggregate([
                    { $group: { _id: '$department', count: { $sum: 1 } } },
                    { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
                    { $unwind: '$department' },
                    { $project: { department: '$department.name', count: 1 } }
                ]),
                Project.find()
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .select('name status startDate endDate')
                    .populate('department', 'name')
            ]);

            res.json({
                success: true,
                data: {
                    projectsByStatus,
                    projectsByDepartment,
                    recentProjects
                }
            });
        } catch (error) {
            console.error('Error in getProjectMetrics:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch project metrics',
                error: error.message
            });
        }
    },

    // Get department-related metrics
    async getDepartmentMetrics(req, res) {
        try {
            const [
                departmentStats,
                departmentHeadCounts,
                departmentBudgets
            ] = await Promise.all([
                Department.countDocuments(),
                Department.aggregate([
                    { $lookup: { from: 'users', localField: '_id', foreignField: 'department', as: 'employees' } },
                    { $project: { name: 1, employeeCount: { $size: '$employees' } } }
                ]),
                Department.aggregate([
                    { $project: { name: 1, budget: 1 } }
                ])
            ]);

            res.json({
                success: true,
                data: {
                    totalDepartments: departmentStats,
                    departmentHeadCounts,
                    departmentBudgets
                }
            });
        } catch (error) {
            console.error('Error in getDepartmentMetrics:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch department metrics',
                error: error.message
            });
        }
    },

    // Get financial metrics
    async getFinancialMetrics(req, res) {
        try {
            const [
                projectBudgets,
                departmentBudgets
            ] = await Promise.all([
                Project.aggregate([
                    { $group: {
                        _id: null,
                        totalAllocated: { $sum: '$budget.allocated' },
                        totalSpent: { $sum: '$budget.spent' }
                    }}
                ]),
                Department.aggregate([
                    { $group: {
                        _id: null,
                        totalAllocated: { $sum: '$budget.allocated' },
                        totalSpent: { $sum: '$budget.spent' }
                    }}
                ])
            ]);

            res.json({
                success: true,
                data: {
                    projectFinancials: projectBudgets[0] || { totalAllocated: 0, totalSpent: 0 },
                    departmentFinancials: departmentBudgets[0] || { totalAllocated: 0, totalSpent: 0 }
                }
            });
        } catch (error) {
            console.error('Error in getFinancialMetrics:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch financial metrics',
                error: error.message
            });
        }
    },

    // Get performance metrics
    async getPerformanceMetrics(req, res) {
        try {
            const [
                projectCompletionRates,
                departmentPerformance
            ] = await Promise.all([
                Project.aggregate([
                    { $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        avgProgress: { $avg: '$progress' }
                    }}
                ]),
                Department.aggregate([
                    { $lookup: {
                        from: 'projects',
                        localField: '_id',
                        foreignField: 'department',
                        as: 'projects'
                    }},
                    { $project: {
                        name: 1,
                        projectCount: { $size: '$projects' },
                        completedProjects: {
                            $size: {
                                $filter: {
                                    input: '$projects',
                                    as: 'project',
                                    cond: { $eq: ['$$project.status', 'completed'] }
                                }
                            }
                        }
                    }}
                ])
            ]);

            res.json({
                success: true,
                data: {
                    projectCompletionRates,
                    departmentPerformance
                }
            });
        } catch (error) {
            console.error('Error in getPerformanceMetrics:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch performance metrics',
                error: error.message
            });
        }
    },

    // Get dashboard stats (for admin.js route)
    async getDashboardStats(req, res) {
        try {
            const [
                userStats,
                projectStats,
                departmentStats,
                financialStats
            ] = await Promise.all([
                User.aggregate([
                    { $group: {
                        _id: null,
                        total: { $sum: 1 },
                        active: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } }
                    }}
                ]),
                Project.aggregate([
                    { $group: {
                        _id: null,
                        total: { $sum: 1 },
                        active: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
                        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
                    }}
                ]),
                Department.countDocuments(),
                Project.aggregate([
                    { $group: {
                        _id: null,
                        totalBudget: { $sum: '$budget.allocated' },
                        totalSpent: { $sum: '$budget.spent' }
                    }}
                ])
            ]);

            res.json({
                success: true,
                data: {
                    users: userStats[0] || { total: 0, active: 0 },
                    projects: projectStats[0] || { total: 0, active: 0, completed: 0 },
                    departments: departmentStats,
                    financials: financialStats[0] || { totalBudget: 0, totalSpent: 0 }
                }
            });
        } catch (error) {
            console.error('Error in getDashboardStats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch dashboard stats',
                error: error.message
            });
        }
    }
};

module.exports = dashboardController; 