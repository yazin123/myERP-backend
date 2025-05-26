const Project = require('../../models/Project');
const Task = require('../../models/Task');
const User = require('../../models/User');

const dashboardController = {
    // Get dashboard statistics
    getDashboardStats: async (req, res) => {
        try {
            // Get total projects
            const totalProjects = await Project.countDocuments();
            
            // Get active tasks
            const activeTasks = await Task.countDocuments({ 
                status: { $nin: ['Completed', 'Cancelled'] } 
            });
            
            // Get team members (active users)
            const teamMembers = await User.countDocuments({ 
                status: 'active' 
            });
            
            // Get completed tasks
            const completedTasks = await Task.countDocuments({ 
                status: 'Completed' 
            });

            // Get recent projects
            const recentProjects = await Project.find()
                .sort({ createdAt: -1 })
                .limit(5)
                .populate('projectHead', 'name')
                .populate('members', 'name');

            // Get upcoming deadlines (tasks)
            const upcomingDeadlines = await Task.find({
                status: { $nin: ['Completed', 'Cancelled'] },
                deadline: { 
                    $gte: new Date(), 
                    $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
                }
            })
            .sort({ deadline: 1 })
            .limit(5)
            .populate('assignedTo', 'name');

            res.json({
                success: true,
                data: {
                    totalProjects,
                    activeTasks,
                    teamMembers,
                    completedTasks,
                    recentProjects,
                    upcomingDeadlines
                }
            });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch dashboard statistics',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
};

module.exports = dashboardController; 