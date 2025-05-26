const Project = require('../../models/Project');
const Task = require('../../models/Task');

const dashboardController = {
    // Get dashboard statistics for regular user
    getMyDashboardStats: async (req, res) => {
        try {
            const userId = req.user._id;

            // Get total projects user is involved in
            const totalProjects = await Project.countDocuments({
                $or: [
                    { projectHead: userId },
                    { members: userId }
                ]
            });
            
            // Get active tasks assigned to user
            const activeTasks = await Task.countDocuments({ 
                assignedTo: userId,
                status: { $nin: ['Completed', 'Cancelled'] } 
            });
            
            // Get team members (from user's projects)
            const userProjects = await Project.find({
                $or: [
                    { projectHead: userId },
                    { members: userId }
                ]
            }).select('members projectHead');

            const teamMemberIds = new Set();
            userProjects.forEach(project => {
                project.members.forEach(member => teamMemberIds.add(member.toString()));
                teamMemberIds.add(project.projectHead.toString());
            });
            const teamMembers = teamMemberIds.size;
            
            // Get completed tasks by user
            const completedTasks = await Task.countDocuments({ 
                assignedTo: userId,
                status: 'Completed' 
            });

            // Get recent projects
            const recentProjects = await Project.find({
                $or: [
                    { projectHead: userId },
                    { members: userId }
                ]
            })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('projectHead', 'name')
            .populate('members', 'name');

            // Get upcoming deadlines (tasks)
            const upcomingDeadlines = await Task.find({
                assignedTo: userId,
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