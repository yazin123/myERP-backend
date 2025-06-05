const User = require('../../models/User');
const Project = require('../../models/Project');
const Task = require('../../models/Task');
const Role = require('../../models/Role');
const Performance = require('../../models/Performance');
const logger = require('../../utils/logger');



const dashboardController = {
    // Get user dashboard statistics
    getUserDashboardStats: async (req, res) => {
        try {
            const userId = req.user.userId;
            const user = await User.findById(userId).populate('role');

            // Base stats for user
            const stats = {
                tasks: {
                    total: 0,
                    completed: 0,
                    pending: 0,
                    overdue: 0,
                    upcoming: [], // Next 5 upcoming tasks
                    byStatus: [], // For frontend compatibility
                    byPriority: [] // For frontend compatibility
                },
                projects: {
                    total: 0,
                    active: 0,
                    completed: 0,
                    onHold: 0,
                    recent: [], // Last 5 projects
                    byStatus: [], // For frontend compatibility
                    byPriority: [] // For frontend compatibility
                },
                performance: {
                    points: user.totalPoints || 0,
                    rank: 0,
                    attendance: 0,
                    tasks: 0
                },
                timeline: [] // Recent activities
            };

            // Get task statistics
            const tasks = await Task.find({ assignedTo: userId })
                .populate('project', 'name status')
                .sort({ dueDate: 1 });

            // Calculate task stats
            const taskStatusCount = {};
            const taskPriorityCount = {};
            tasks.forEach(task => {
                // Count by status
                taskStatusCount[task.status] = (taskStatusCount[task.status] || 0) + 1;
                // Count by priority
                taskPriorityCount[task.priority] = (taskPriorityCount[task.priority] || 0) + 1;
            });

            // Format task stats for frontend
            stats.tasks.byStatus = Object.entries(taskStatusCount).map(([_id, count]) => ({ _id, count }));
            stats.tasks.byPriority = Object.entries(taskPriorityCount).map(([_id, count]) => ({ _id, count }));

            stats.tasks.total = tasks.length;
            stats.tasks.completed = tasks.filter(t => t.status === 'completed').length;
            stats.tasks.pending = tasks.filter(t => t.status === 'pending').length;
            stats.tasks.overdue = tasks.filter(t => t.status === 'overdue').length;

            // Get upcoming tasks (next 5 due)
            stats.tasks.upcoming = tasks
                .filter(t => t.status !== 'completed' && t.dueDate > new Date())
                .slice(0, 5)
                .map(t => ({
                    id: t._id,
                    title: t.title,
                    dueDate: t.dueDate,
                    status: t.status,
                    priority: t.priority,
                    project: t.project ? {
                        id: t.project._id,
                        name: t.project.name,
                        status: t.project.status
                    } : null
                }));

            // Get project statistics
            const projects = await Project.find({ members: userId })
                .sort({ updatedAt: -1 });

            // Calculate project stats
            const projectStatusCount = {};
            const projectPriorityCount = {};
            projects.forEach(project => {
                // Count by status
                projectStatusCount[project.status] = (projectStatusCount[project.status] || 0) + 1;
                // Count by priority
                projectPriorityCount[project.priority] = (projectPriorityCount[project.priority] || 0) + 1;
            });

            // Format project stats for frontend
            stats.projects.byStatus = Object.entries(projectStatusCount).map(([_id, count]) => ({ _id, count }));
            stats.projects.byPriority = Object.entries(projectPriorityCount).map(([_id, count]) => ({ _id, count }));

            stats.projects.total = projects.length;
            stats.projects.active = projects.filter(p => p.status === 'active').length;
            stats.projects.completed = projects.filter(p => p.status === 'completed').length;
            stats.projects.onHold = projects.filter(p => p.status === 'on-hold').length;

            // Get recent projects
            stats.projects.recent = projects
                .slice(0, 5)
                .map(p => ({
                    id: p._id,
                    name: p.name,
                    status: p.status,
                    priority: p.priority,
                    progress: p.progress,
                    startDate: p.startDate,
                    endDate: p.endDate
                }));

            // Calculate performance statistics
            const allUsers = await User.find({}, 'totalPoints');
            const sortedUsers = allUsers.sort((a, b) => b.totalPoints - a.totalPoints);
            stats.performance.rank = sortedUsers.findIndex(u => u._id.toString() === userId) + 1;

            // Calculate attendance percentage
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const attendance = user.attendance?.filter(a => 
                new Date(a.date) >= startOfMonth && 
                new Date(a.date) <= today
            ) || [];
            const workingDays = Math.floor((today - startOfMonth) / (1000 * 60 * 60 * 24));
            stats.performance.attendance = workingDays > 0 
                ? (attendance.length / workingDays) * 100 
                : 0;

            // Calculate task completion rate
            stats.performance.tasks = tasks.length > 0
                ? (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100
                : 0;

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting user dashboard stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch dashboard statistics'
            });
        }
    },

    // Get admin dashboard statistics
    getAdminDashboardStats: async (req, res) => {
        try {
            const userId = req.user.userId;
            const user = await User.findById(userId).populate('role');

            // Base stats that everyone gets
            const stats = {
                tasks: {
                    total: 0,
                    completed: 0,
                    pending: 0,
                    overdue: 0,
                    byStatus: [], // For frontend compatibility
                    byPriority: [] // For frontend compatibility
                },
                projects: {
                    total: 0,
                    active: 0,
                    completed: 0,
                    onHold: 0,
                    byStatus: [], // For frontend compatibility
                    byPriority: [] // For frontend compatibility
                },
                performance: {
                    points: user.totalPoints || 0,
                    rank: 0,
                    attendance: 0,
                    tasks: 0
                }
            };

            // Get task statistics
            const tasks = await Task.find();
            
            // Calculate task stats
            const taskStatusCount = {};
            const taskPriorityCount = {};
            tasks.forEach(task => {
                // Count by status
                taskStatusCount[task.status] = (taskStatusCount[task.status] || 0) + 1;
                // Count by priority
                taskPriorityCount[task.priority] = (taskPriorityCount[task.priority] || 0) + 1;
            });

            // Format task stats for frontend
            stats.tasks.byStatus = Object.entries(taskStatusCount).map(([_id, count]) => ({ _id, count }));
            stats.tasks.byPriority = Object.entries(taskPriorityCount).map(([_id, count]) => ({ _id, count }));

            stats.tasks.total = tasks.length;
            stats.tasks.completed = tasks.filter(t => t.status === 'completed').length;
            stats.tasks.pending = tasks.filter(t => t.status === 'pending').length;
            stats.tasks.overdue = tasks.filter(t => t.status === 'overdue').length;

            // Get project statistics
            const projects = await Project.find();

            // Calculate project stats
            const projectStatusCount = {};
            const projectPriorityCount = {};
            projects.forEach(project => {
                // Count by status
                projectStatusCount[project.status] = (projectStatusCount[project.status] || 0) + 1;
                // Count by priority
                projectPriorityCount[project.priority] = (projectPriorityCount[project.priority] || 0) + 1;
            });

            // Format project stats for frontend
            stats.projects.byStatus = Object.entries(projectStatusCount).map(([_id, count]) => ({ _id, count }));
            stats.projects.byPriority = Object.entries(projectPriorityCount).map(([_id, count]) => ({ _id, count }));

            stats.projects.total = projects.length;
            stats.projects.active = projects.filter(p => p.status === 'active').length;
            stats.projects.completed = projects.filter(p => p.status === 'completed').length;
            stats.projects.onHold = projects.filter(p => p.status === 'on-hold').length;

            // Get performance statistics
            const allUsers = await User.find({}, 'totalPoints');
            const sortedUsers = allUsers.sort((a, b) => b.totalPoints - a.totalPoints);
            stats.performance.rank = sortedUsers.findIndex(u => u._id.toString() === userId) + 1;

            // Add admin-specific statistics
            stats.users = {
                total: await User.countDocuments(),
                active: await User.countDocuments({ status: 'active' }),
                onLeave: await User.countDocuments({ status: 'on-leave' }),
                byRole: [], // For frontend compatibility
                byDepartment: [] // For frontend compatibility
            };

            // Get user role distribution
            const userRoles = await User.aggregate([
                { $group: { _id: '$role', count: { $sum: 1 } } }
            ]);
            stats.users.byRole = await Promise.all(userRoles.map(async (role) => ({
                _id: role._id,
                count: role.count,
                name: (await Role.findById(role._id).select('name')).name
            })));

            // Get department distribution
            const departments = await User.aggregate([
                { $group: { _id: '$department', count: { $sum: 1 } } }
            ]);
            stats.users.byDepartment = departments;
            
            stats.departments = {
                total: departments.length,
                performance: {} // Add department performance if needed
            };

            stats.system = {
                status: 'healthy',
                lastBackup: new Date(),
                notifications: await getSystemNotifications()
            };

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            logger.error('Error getting admin dashboard stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch dashboard statistics'
            });
        }
    }
};

async function getSystemNotifications() {
    // Implement system notifications logic here
    return [];
}

module.exports = dashboardController; 