const Task = require('../models/Task');
const Project = require('../models/Project');
const { createNotification } = require('../utils/notification');

// Get all tasks for a specific project
exports.getProjectTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Get tasks for the project
    const tasks = await Task.find({ project: projectId })
      .populate('assignedTo', 'name photo')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error('Error in getProjectTasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create a new task for a project
exports.createProjectTask = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { description, assignedTo, deadline, priority, isDaily } = req.body;

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const task = new Task({
      description,
      assignedTo,
      deadline,
      priority,
      isDaily,
      project: projectId,
      status: 'Assigned',
      createdBy: req.user._id
    });

    await task.save();

    // Create notification for assigned user
    await createNotification({
      user: assignedTo,
      title: 'New Task Assignment',
      message: `You have been assigned a new task in project ${project.name}`,
      type: 'task_assignment',
      reference: {
        type: 'task',
        id: task._id
      }
    });

    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name photo');

    res.status(201).json(populatedTask);
  } catch (error) {
    console.error('Error in createProjectTask:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a project task
exports.updateProjectTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const updates = req.body;

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Find and update task
    const task = await Task.findOneAndUpdate(
      { _id: taskId, project: projectId },
      updates,
      { new: true }
    ).populate('assignedTo', 'name photo');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error in updateProjectTask:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a project task
exports.deleteProjectTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Find and delete task
    const task = await Task.findOneAndDelete({ _id: taskId, project: projectId });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error in deleteProjectTask:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Assign multiple tasks to project members
exports.assignProjectTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { tasks } = req.body;

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const createdTasks = [];

    // Create tasks and notifications
    for (const taskData of tasks) {
      const { description, assignees, deadline, priority, isDaily } = taskData;

      // Create tasks for each assignee
      for (const assigneeId of assignees) {
        const task = new Task({
          description,
          assignedTo: assigneeId,
          deadline,
          priority,
          isDaily,
          project: projectId,
          status: 'Assigned',
          createdBy: req.user._id
        });

        await task.save();

        // Create notification for assigned user
        await createNotification({
          user: assigneeId,
          title: 'New Task Assignment',
          message: `You have been assigned a new task in project ${project.name}`,
          type: 'task_assignment',
          reference: {
            type: 'task',
            id: task._id
          }
        });

        const populatedTask = await Task.findById(task._id)
          .populate('assignedTo', 'name photo');
        
        createdTasks.push(populatedTask);
      }
    }

    res.status(201).json(createdTasks);
  } catch (error) {
    console.error('Error in assignProjectTasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
}; 