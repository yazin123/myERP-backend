const cron = require('node-cron');
const Task = require('../models/Task');
const Followup = require('../models/Followup');
const Performance = require('../models/Performance');
const Lead = require('../models/Lead');
const User = require('../models/User');
const moment = require('moment');

// Notification Service
const notificationService = {
    sendNotification: async (userId, message) => {
        // Implementation of notification service
        // This could be email, push notification, SMS, etc.
        console.log(`Notification sent to ${userId}: ${message}`);
    }
};

// Main Cron Jobs Setup Function
const setupCronJobs = () => {
    // Daily task check at 6:00 PM
    cron.schedule('0 18 * * *', async () => {
        try {
            const currentDate = moment().startOf('day');
            
            // Find tasks that were due today
            const tasks = await Task.find({
                $or: [
                    { 
                        isDaily: true,
                        createdAt: {
                            $gte: currentDate.toDate(),
                            $lt: moment(currentDate).endOf('day').toDate()
                        }
                    },
                    {
                        deadline: {
                            $gte: currentDate.toDate(),
                            $lt: moment(currentDate).endOf('day').toDate()
                        }
                    }
                ]
            }).populate('assignedTo createdBy');

            for (const task of tasks) {
                await processTaskPerformance(task);
            }
            console.log("CRON updated :- Checked Pending tasks and created performance");

        } catch (error) {
            console.error('Cron job error:', error);
        }
    });

    // Check for pending task approvals every 24 hours
    cron.schedule('0 0 * * *', async () => {
        try {
            const yesterday = moment().subtract(1, 'day').startOf('day');
            
            // Find completed tasks without approval
            const pendingTasks = await Task.find({
                status: 'Completed',
                isCompletedApproved: false,
                completedDateTime: {
                    $gte: yesterday.toDate(),
                    $lt: moment(yesterday).endOf('day').toDate()
                }
            }).populate('assignedTo');

            for (const task of pendingTasks) {
                await processPendingApproval(task);
            }
            console.log("CRON updated :- Checked Pending Approval and created performance");
        } catch (error) {
            console.error('Approval check cron job error:', error);
        }
    });

    // Followup notifications - check every minute
    cron.schedule('* * * * *', async () => {
        try {
            const now = moment();
            
            // Find followups scheduled for today
            const followups = await Followup.find({
                status: 'created',
                followupDate: {
                    $gte: now.clone().startOf('day').toDate(),
                    $lte: now.clone().endOf('day').toDate()
                }
            }).populate({
                path: 'leadId',
                populate: { path: 'leadOwner' }
            });

            for (const followup of followups) {
                const followupTime = moment(followup.followupDate);
                const diffMinutes = followupTime.diff(now, 'minutes');

                // Notify at the start of the day
                if (now.clone().startOf('day').isSame(moment(), 'minute')) {
                    await notifyOwner(followup, 'start_of_day');
                }

                // Notify 15 minutes before
                if (diffMinutes === 15) {
                    await notifyOwner(followup, '15min_before');
                }
            }

        } catch (error) {
            console.error('Follow-up notification cron job error:', error);
        }
    });

    // Check for missed followups daily at midnight
    cron.schedule('0 0 * * *', async () => {
        try {
            const yesterday = moment().subtract(1, 'day');

            // Find missed followups from yesterday
            const missedFollowups = await Followup.find({
                status: 'created',
                isResponded: false,
                followupDate: {
                    $gte: yesterday.startOf('day').toDate(),
                    $lte: yesterday.endOf('day').toDate()
                }
            }).populate({
                path: 'leadId',
                populate: { path: 'leadOwner' }
            });

            for (const followup of missedFollowups) {
                await processFollowupPerformance(followup);
            }

            console.log("CRON updated: Checked missed followups and updated performance");
        } catch (error) {
            console.error('Missed follow-up check cron job error:', error);
        }
    });
};

// Helper Functions for Task Performance
const processTaskPerformance = async (task) => {
    try {
        let performanceData;

        if (task.status === 'Completed' && task.isCompletedApproved) {
            // Task successfully completed and approved
            performanceData = {
                category: 'task_completed',
                points: 1,
                remark: `Task "${task.description}" completed successfully`,
                user_id: task.assignedTo._id,
                createdBy: "CRON",
                taskId: task._id
            };
        } else {
            // Task not completed
            performanceData = {
                category: 'task_not_completed',
                points: 0,
                remark: `Task "${task.description}" not completed by deadline`,
                user_id: task.assignedTo._id,
                createdBy: "CRON",
                status: "Missed",
                taskId: task._id
            };
        }

        await new Performance(performanceData).save();
    } catch (error) {
        console.error('Error processing task performance:', error);
    }
};

const processPendingApproval = async (task) => {
    try {
        // Find the team lead from the user's department
        const teamLead = await User.findOne({
            department: task.assignedTo.department,
            role: 'team lead'
        });

        if (teamLead) {
            // Create performance record for team lead
            await new Performance({
                category: 'task_not_completed',
                points: 0,
                remark: `Failed to approve completed task "${task.description}"`,
                user_id: teamLead._id,
                createdBy: "CRON",
                taskId: task._id
            }).save();
        }
    } catch (error) {
        console.error('Error processing pending approval:', error);
    }
};

// Helper Functions for Followup Performance
const notifyOwner = async (followup, notificationType) => {
    const owner = followup.leadId.leadOwner;
    const lead = followup.leadId;
    const followupTime = moment(followup.followupDate).format('HH:mm');
    
    let message;
    switch (notificationType) {
        case 'start_of_day':
            message = `You have a ${followup.method} follow-up scheduled with ${lead.name} at ${followupTime} today`;
            break;
        case '15min_before':
            message = `Reminder: ${followup.method} follow-up with ${lead.name} in 15 minutes`;
            break;
    }

    await notificationService.sendNotification(owner._id, message);
};

const processFollowupPerformance = async (followup) => {
    try {
        // Mark followup as missed
        followup.status = 'missed';
        await followup.save();

        // Create performance record
        const performanceData = {
            category: 'task_not_completed',
            points: -1, // Negative point for missed follow-up
            remark: `Missed ${followup.method} follow-up with lead "${followup.leadId.name}"`,
            user_id: followup.leadId.leadOwner._id,
            createdBy: "CRON",
            taskId: followup._id
        };

        await new Performance(performanceData).save();

        // Send notification to owner about missed follow-up
        await notificationService.sendNotification(
            followup.leadId.leadOwner._id,
            `You missed a scheduled ${followup.method} follow-up with ${followup.leadId.name}. Please reschedule.`
        );

    } catch (error) {
        console.error('Error processing follow-up performance:', error);
    }
};

module.exports = setupCronJobs;