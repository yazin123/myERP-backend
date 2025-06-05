const Task = require('../models/Task');
const Project = require('../models/Project');
const Performance = require('../models/Performance');
const { createNotification } = require('../utils/notification');
const mongoose = require('mongoose');

// Get all tasks for a specific project
exports.getProjectTasks = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { status, assignee, priority, search } = req.query;
        
        // Build query
        const query = { project: projectId };
        if (status) query.status = status;
        if (assignee) query.assignee = assignee;
        if (priority) query.priority = priority;
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Get tasks with populated references
        const tasks = await Task.find(query)
            .populate('assignee', 'name email photo')
            .populate('createdBy', 'name')
            .populate('dependencies.task', 'title status')
            .sort({ priority: -1, dueDate: 1 });

        res.json(tasks);
    } catch (error) {
        console.error('Error in getProjectTasks:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Create a new task
exports.createProjectTask = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { projectId } = req.params;
        const {
            title,
            description,
            assignee,
            priority,
            dueDate,
            startDate,
            estimatedHours,
            dependencies,
            subtasks,
            tags
        } = req.body;

        // Verify project exists
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Create task
        const task = new Task({
            title,
            description,
            project: projectId,
            assignee,
            priority,
            dueDate,
            startDate,
            estimatedHours,
            dependencies,
            subtasks,
            tags,
            createdBy: req.user._id
        });

        await task.save({ session });

        // Update project task count
        await Project.findByIdAndUpdate(
            projectId,
            { $inc: { 'taskMetrics.total': 1 } },
            { session }
        );

        // Create notification for assigned user
        await createNotification({
            user: assignee,
            title: 'New Task Assignment',
            message: `You have been assigned a new task: ${title}`,
            type: 'task_assignment',
            priority: priority,
            reference: {
                type: 'task',
                id: task._id
            }
        }, { session });

        await session.commitTransaction();

        const populatedTask = await Task.findById(task._id)
            .populate('assignee', 'name email photo')
            .populate('createdBy', 'name')
            .populate('dependencies.task', 'title status');

        res.status(201).json(populatedTask);
    } catch (error) {
        await session.abortTransaction();
        console.error('Error in createProjectTask:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    } finally {
        session.endSession();
    }
};

// Update a task
exports.updateProjectTask = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { projectId, taskId } = req.params;
        const updates = req.body;
        const oldTask = await Task.findOne({ _id: taskId, project: projectId });

        if (!oldTask) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Track changes for history
        const changes = [];
        for (const [key, value] of Object.entries(updates)) {
            if (oldTask[key] !== value) {
                changes.push({
                    field: key,
                    oldValue: oldTask[key],
                    newValue: value,
                    changedBy: req.user._id,
                    changedAt: new Date()
                });
            }
        }

        // Special handling for status change to completed
        if (updates.status === 'completed' && oldTask.status !== 'completed') {
            updates.completedAt = new Date();
            updates.completedBy = req.user._id;

            // Create performance record for task completion
            const performance = new Performance({
                period: {
                    startDate: oldTask.startDate,
                    endDate: new Date()
                },
                user: oldTask.assignee,
                project: projectId,
                metrics: [{
                    category: 'task_completion',
                    score: oldTask.dueDate >= new Date() ? 10 : 7,
                    weight: 1
                }],
                createdBy: 'SYSTEM'
            });

            await performance.save({ session });
        }

        // Update task with history
        const task = await Task.findOneAndUpdate(
            { _id: taskId, project: projectId },
            {
                ...updates,
                $push: { history: { $each: changes } }
            },
            { new: true, session }
        )
        .populate('assignee', 'name email photo')
        .populate('createdBy', 'name')
        .populate('dependencies.task', 'title status');

        // Create notification for status changes
        if (updates.status && updates.status !== oldTask.status) {
            await createNotification({
                user: oldTask.assignee,
                title: 'Task Status Updated',
                message: `Task "${oldTask.title}" status changed to ${updates.status}`,
                type: 'task_update',
                priority: oldTask.priority,
                reference: {
                    type: 'task',
                    id: taskId
                }
            }, { session });
        }

        await session.commitTransaction();
        res.json(task);
    } catch (error) {
        await session.abortTransaction();
        console.error('Error in updateProjectTask:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    } finally {
        session.endSession();
    }
};

// Delete a task
exports.deleteProjectTask = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { projectId, taskId } = req.params;

        // Find task and check if it exists
        const task = await Task.findOne({ _id: taskId, project: projectId });
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Check for dependent tasks
        const dependentTasks = await Task.find({
            'dependencies.task': taskId
        });

        if (dependentTasks.length > 0) {
            return res.status(400).json({
                message: 'Cannot delete task with dependencies',
                dependentTasks: dependentTasks.map(t => ({
                    id: t._id,
                    title: t.title
                }))
            });
        }

        // Delete task
        await Task.findOneAndDelete(
            { _id: taskId, project: projectId },
            { session }
        );

        // Update project task count
        await Project.findByIdAndUpdate(
            projectId,
            { $inc: { 'taskMetrics.total': -1 } },
            { session }
        );

        // Create notification for assignee
        await createNotification({
            user: task.assignee,
            title: 'Task Deleted',
            message: `Task "${task.title}" has been deleted`,
            type: 'task_deletion',
            priority: task.priority,
            reference: {
                type: 'project',
                id: projectId
            }
        }, { session });

        await session.commitTransaction();
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        await session.abortTransaction();
        console.error('Error in deleteProjectTask:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    } finally {
        session.endSession();
    }
};

// Get task statistics
exports.getTaskStatistics = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { startDate, endDate } = req.query;

        const query = { project: projectId };
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const stats = await Task.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    avgCompletionTime: {
                        $avg: {
                            $cond: [
                                { $eq: ['$status', 'completed'] },
                                {
                                    $divide: [
                                        { $subtract: ['$completedAt', '$createdAt'] },
                                        1000 * 60 * 60 // Convert to hours
                                    ]
                                },
                                null
                            ]
                        }
                    }
                }
            }
        ]);

        const overdueTasks = await Task.countDocuments({
            project: projectId,
            dueDate: { $lt: new Date() },
            status: { $ne: 'completed' }
        });

        res.json({
            statusBreakdown: stats,
            overdueTasks
        });
    } catch (error) {
        console.error('Error in getTaskStatistics:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Bulk assign tasks to team members
exports.assignProjectTasks = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { projectId } = req.params;
        const { assignments } = req.body;

        // Validate request body
        if (!Array.isArray(assignments) || assignments.length === 0) {
            return res.status(400).json({
                message: 'Invalid request. Expected array of task assignments'
            });
        }

        // Verify project exists and user has access
        const project = await Project.findOne({
            _id: projectId,
            $or: [
                { projectHead: req.user._id },
                { members: req.user._id }
            ]
        });

        if (!project) {
            return res.status(404).json({
                message: 'Project not found or access denied'
            });
        }

        // Process task assignments
        const updatedTasks = [];
        const notifications = [];

        for (const assignment of assignments) {
            const { taskId, assigneeId } = assignment;

            // Update task
            const task = await Task.findOneAndUpdate(
                { _id: taskId, project: projectId },
                {
                    assignee: assigneeId,
                    $push: {
                        history: {
                            field: 'assignee',
                            oldValue: null, // Will be filled by previous assignee if any
                            newValue: assigneeId,
                            changedBy: req.user._id,
                            changedAt: new Date()
                        }
                    }
                },
                { new: true, session }
            )
            .populate('assignee', 'name email photo')
            .populate('createdBy', 'name');

            if (!task) {
                throw new Error(`Task ${taskId} not found or not part of project`);
            }

            updatedTasks.push(task);

            // Create notification for new assignee
            notifications.push({
                user: assigneeId,
                title: 'Task Assignment',
                message: `You have been assigned to task: ${task.title}`,
                type: 'task_assignment',
                priority: task.priority,
                reference: {
                    type: 'task',
                    id: task._id
                }
            });
        }

        // Create all notifications
        for (const notification of notifications) {
            await createNotification(notification, { session });
        }

        await session.commitTransaction();

        res.json({
            success: true,
            message: `Successfully assigned ${updatedTasks.length} tasks`,
            tasks: updatedTasks
        });
    } catch (error) {
        await session.abortTransaction();
        console.error('Error in assignProjectTasks:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign tasks',
            error: error.message
        });
    } finally {
        session.endSession();
    }
};

module.exports = exports; 