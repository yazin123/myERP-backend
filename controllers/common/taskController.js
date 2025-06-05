const Task = require('../../models/Task');
const Comment = require('../../models/Comment');
const logger = require('../../utils/logger');
const notificationService = require('../../utils/notification');
const Project = require('../../models/Project');
const { validateTask } = require('../../utils/validation');
const { ApiError } = require('../../utils/errors');

const taskController = {
    // Get all tasks with filtering options
    getTasks: async (req, res, next) => {
        try {
            const {
                status,
                priority,
                assignee,
                project,
                startDate,
                endDate,
                search
            } = req.query;

            // Build query
            const query = {};
            
            if (status) query.status = status;
            if (priority) query.priority = priority;
            if (assignee) query.assignee = assignee;
            if (project) query.project = project;
            
            // Date range
            if (startDate || endDate) {
                query.dueDate = {};
                if (startDate) query.dueDate.$gte = new Date(startDate);
                if (endDate) query.dueDate.$lte = new Date(endDate);
            }

            // Search in title and description
            if (search) {
                query.$or = [
                    { title: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            const tasks = await Task.find(query)
                .populate('assignee', 'name email')
                .populate('project', 'name')
                .sort({ createdAt: -1 });

            res.json(tasks);
        } catch (error) {
            next(error);
        }
    },

    // Get user's tasks
    getMyTasks: async (req, res, next) => {
        try {
            const tasks = await Task.find({ assignee: req.user._id })
                .populate('project', 'name')
                .sort({ dueDate: 1 });

            res.json(tasks);
        } catch (error) {
            next(error);
        }
    },

    // Get task by ID
    getTaskById: async (req, res, next) => {
        try {
            const task = await Task.findById(req.params.id)
                .populate('assignee', 'name email')
                .populate('project', 'name');

            if (!task) {
                throw new ApiError(404, 'Task not found');
            }

            res.json(task);
        } catch (error) {
            next(error);
        }
    },

    // Create new task
    createTask: async (req, res, next) => {
        try {
            const { error } = validateTask(req.body);
            if (error) {
                throw new ApiError(400, error.details[0].message);
            }

            const task = new Task({
                ...req.body,
                createdBy: req.user._id
            });

            await task.save();

            // Populate references
            await task.populate('assignee', 'name email');
            await task.populate('project', 'name');

            res.status(201).json(task);
        } catch (error) {
            next(error);
        }
    },

    // Update task
    updateTask: async (req, res, next) => {
        try {
            const { error } = validateTask(req.body);
            if (error) {
                throw new ApiError(400, error.details[0].message);
            }

            const task = await Task.findByIdAndUpdate(
                req.params.id,
                { ...req.body, updatedAt: Date.now() },
                { new: true }
            )
            .populate('assignee', 'name email')
            .populate('project', 'name');

            if (!task) {
                throw new ApiError(404, 'Task not found');
            }

            res.json(task);
        } catch (error) {
            next(error);
        }
    },

    // Delete task
    deleteTask: async (req, res, next) => {
        try {
            const task = await Task.findByIdAndDelete(req.params.id);
            
            if (!task) {
                throw new ApiError(404, 'Task not found');
            }

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    },

    // Update task status
    updateTaskStatus: async (req, res, next) => {
        try {
            const task = await Task.findOne({
                _id: req.params.id,
                assignee: req.user._id
            });

            if (!task) {
                throw new ApiError(404, 'Task not found or access denied');
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
            next(error);
        }
    },

    // Get tasks board data (for Kanban view)
    getTasksBoard: async (req, res, next) => {
        try {
            const { project } = req.query;

            const query = {};
            if (project) query.project = project;

            const tasks = await Task.find(query)
                .populate('assignee', 'name email')
                .populate('project', 'name');

            // Group tasks by status
            const board = {
                todo: tasks.filter(task => task.status === 'todo'),
                in_progress: tasks.filter(task => task.status === 'in_progress'),
                review: tasks.filter(task => task.status === 'review'),
                completed: tasks.filter(task => task.status === 'completed')
            };

            res.json(board);
        } catch (error) {
            next(error);
        }
    },

    // Add task comment
    addTaskComment: async (req, res, next) => {
        try {
            const task = await Task.findOne({
                _id: req.params.id,
                $or: [
                    { assignee: req.user._id },
                    { createdBy: req.user._id }
                ]
            });

            if (!task) {
                throw new ApiError(404, 'Task not found or access denied');
            }

            const comment = new Comment({
                task: task._id,
                user: req.user._id,
                content: req.body.content
            });

            await comment.save();
            task.comments.push(comment._id);
            await task.save();

            // Send notification to task participants
            const notifyUsers = [task.createdBy];
            if (task.assignee.toString() !== req.user._id.toString()) {
                notifyUsers.push(task.assignee);
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
            next(error);
        }
    },

    // Get task comments
    getTaskComments: async (req, res, next) => {
        try {
            const task = await Task.findOne({
                _id: req.params.id,
                $or: [
                    { assignee: req.user._id },
                    { createdBy: req.user._id }
                ]
            });

            if (!task) {
                throw new ApiError(404, 'Task not found or access denied');
            }

            const comments = await Comment.find({ task: task._id })
                .populate('user', 'name photo')
                .sort({ createdAt: -1 });

            res.json(comments);
        } catch (error) {
            next(error);
        }
    },

    // Update task comment
    updateTaskComment: async (req, res, next) => {
        try {
            const comment = await Comment.findOne({
                _id: req.params.commentId,
                task: req.params.id,
                user: req.user._id
            });

            if (!comment) {
                throw new ApiError(404, 'Comment not found or access denied');
            }

            comment.content = req.body.content;
            comment.edited = true;
            await comment.save();

            await comment.populate('user', 'name photo');
            res.json(comment);
        } catch (error) {
            next(error);
        }
    },

    // Delete task comment
    deleteTaskComment: async (req, res, next) => {
        try {
            const comment = await Comment.findOne({
                _id: req.params.commentId,
                task: req.params.id,
                user: req.user._id
            });

            if (!comment) {
                throw new ApiError(404, 'Comment not found or access denied');
            }

            await comment.deleteOne();

            // Remove comment from task's comments array
            await Task.findByIdAndUpdate(req.params.id, {
                $pull: { comments: comment._id }
            });

            res.json({ message: 'Comment deleted successfully' });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = taskController; 