const Task = require('../../models/Task');
const Comment = require('../../models/Comment');
const logger = require('../../utils/logger');
const notificationService = require('../../utils/notification');

const taskController = {
    // Get user's tasks
    getMyTasks: async (req, res) => {
        try {
            const query = {
                $or: [
                    { assignedTo: req.user._id },
                    { createdBy: req.user._id }
                ]
            };

            const tasks = await Task.find(query)
                .populate('project', 'name')
                .populate('assignedTo', 'name photo')
                .populate('createdBy', 'name')
                .sort({ deadline: 1 });

            res.json({
                success: true,
                data: tasks
            });
        } catch (error) {
            logger.error('Get my tasks error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch tasks',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    },

    // Get task by ID
    getTaskById: async (req, res) => {
        try {
            const task = await Task.findOne({
                _id: req.params.id,
                $or: [
                    { assignedTo: req.user._id },
                    { createdBy: req.user._id }
                ]
            })
            .populate('project', 'name status')
            .populate('assignedTo', 'name photo')
            .populate('createdBy', 'name')
            .populate({
                path: 'comments',
                populate: {
                    path: 'user',
                    select: 'name photo'
                }
            });

            if (!task) {
                return res.status(404).json({ message: 'Task not found or access denied' });
            }

            res.json(task);
        } catch (error) {
            logger.error('Get task by ID error:', error);
            res.status(500).json({ message: 'Failed to fetch task details' });
        }
    },

    // Update task status
    updateTaskStatus: async (req, res) => {
        try {
            const task = await Task.findOne({
                _id: req.params.id,
                assignedTo: req.user._id
            });

            if (!task) {
                return res.status(404).json({ message: 'Task not found or access denied' });
            }

            const oldStatus = task.status;
            task.status = req.body.status;
            await task.save();

            // Send notification to task creator
            if (task.createdBy.toString() !== req.user._id.toString()) {
                await notificationService.sendNotification({
                    type: 'TASK_STATUS_UPDATE',
                    user: task.createdBy,
                    data: {
                        taskId: task._id,
                        taskTitle: task.title,
                        oldStatus,
                        newStatus: task.status,
                        updatedBy: req.user.name
                    }
                });
            }

            res.json({ message: 'Task status updated successfully', task });
        } catch (error) {
            logger.error('Update task status error:', error);
            res.status(500).json({ message: 'Failed to update task status' });
        }
    },

    // Add task comment
    addTaskComment: async (req, res) => {
        try {
            const task = await Task.findOne({
                _id: req.params.id,
                $or: [
                    { assignedTo: req.user._id },
                    { createdBy: req.user._id }
                ]
            });

            if (!task) {
                return res.status(404).json({ message: 'Task not found or access denied' });
            }

            const comment = new Comment({
                task: task._id,
                user: req.user._id,
                content: req.body.comment
            });

            await comment.save();
            task.comments.push(comment._id);
            await task.save();

            // Send notification to task participants
            const notifyUsers = [task.createdBy];
            if (task.assignedTo.toString() !== req.user._id.toString()) {
                notifyUsers.push(task.assignedTo);
            }

            for (const userId of notifyUsers) {
                if (userId.toString() !== req.user._id.toString()) {
                    await notificationService.sendNotification({
                        type: 'TASK_COMMENT',
                        user: userId,
                        data: {
                            taskId: task._id,
                            taskTitle: task.title,
                            commentBy: req.user.name
                        }
                    });
                }
            }

            await comment.populate('user', 'name photo');
            res.json(comment);
        } catch (error) {
            logger.error('Add task comment error:', error);
            res.status(500).json({ message: 'Failed to add comment' });
        }
    },

    // Get task comments
    getTaskComments: async (req, res) => {
        try {
            const task = await Task.findOne({
                _id: req.params.id,
                $or: [
                    { assignedTo: req.user._id },
                    { createdBy: req.user._id }
                ]
            });

            if (!task) {
                return res.status(404).json({ message: 'Task not found or access denied' });
            }

            const comments = await Comment.find({ task: task._id })
                .populate('user', 'name photo')
                .sort({ createdAt: -1 });

            res.json(comments);
        } catch (error) {
            logger.error('Get task comments error:', error);
            res.status(500).json({ message: 'Failed to fetch comments' });
        }
    },

    // Update task comment
    updateTaskComment: async (req, res) => {
        try {
            const comment = await Comment.findOne({
                _id: req.params.commentId,
                task: req.params.id,
                user: req.user._id
            });

            if (!comment) {
                return res.status(404).json({ message: 'Comment not found or access denied' });
            }

            comment.content = req.body.comment;
            comment.edited = true;
            await comment.save();

            await comment.populate('user', 'name photo');
            res.json(comment);
        } catch (error) {
            logger.error('Update task comment error:', error);
            res.status(500).json({ message: 'Failed to update comment' });
        }
    },

    // Delete task comment
    deleteTaskComment: async (req, res) => {
        try {
            const comment = await Comment.findOne({
                _id: req.params.commentId,
                task: req.params.id,
                user: req.user._id
            });

            if (!comment) {
                return res.status(404).json({ message: 'Comment not found or access denied' });
            }

            await comment.deleteOne();

            // Remove comment from task's comments array
            await Task.findByIdAndUpdate(req.params.id, {
                $pull: { comments: comment._id }
            });

            res.json({ message: 'Comment deleted successfully' });
        } catch (error) {
            logger.error('Delete task comment error:', error);
            res.status(500).json({ message: 'Failed to delete comment' });
        }
    }
};

module.exports = taskController; 