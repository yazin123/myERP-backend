const Project = require('../../models/Project');
const { ApiError } = require('../../utils/errors');
const { validateTimelineEvent } = require('../../utils/validation');

exports.getTimelineEvents = async (req, res, next) => {
    try {
        const { startDate, endDate, type, status } = req.query;
        const projects = await Project.find({
            $or: [
                { manager: req.user._id },
                { 'team.user': req.user._id },
                { createdBy: req.user._id }
            ]
        }).select('timeline name');

        let events = projects.reduce((acc, project) => {
            return acc.concat(project.timeline.map(event => ({
                ...event.toObject(),
                projectId: project._id,
                projectName: project.name
            })));
        }, []);

        if (startDate) events = events.filter(event => new Date(event.date) >= new Date(startDate));
        if (endDate) events = events.filter(event => new Date(event.date) <= new Date(endDate));
        if (type) events = events.filter(event => event.type === type);
        if (status) events = events.filter(event => event.status === status);

        events.sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(events);
    } catch (error) {
        next(error);
    }
};

exports.getTimelineEventById = async (req, res, next) => {
    try {
        const project = await Project.findOne({
            'timeline._id': req.params.eventId,
            $or: [
                { manager: req.user._id },
                { 'team.user': req.user._id },
                { createdBy: req.user._id }
            ]
        });

        if (!project) {
            throw new ApiError(404, 'Timeline event not found or access denied');
        }

        const event = project.timeline.id(req.params.eventId);
        res.json({
            ...event.toObject(),
            projectId: project._id,
            projectName: project.name
        });
    } catch (error) {
        next(error);
    }
};

exports.createTimelineEvent = async (req, res, next) => {
    try {
        const { error } = validateTimelineEvent(req.body);
        if (error) {
            throw new ApiError(400, error.details[0].message);
        }

        const { projectId, ...eventData } = req.body;
        const project = await Project.findOne({
            _id: projectId,
            $or: [
                { manager: req.user._id },
                { 'team.user': req.user._id },
                { createdBy: req.user._id }
            ]
        });

        if (!project) {
            throw new ApiError(404, 'Project not found or access denied');
        }

        const event = {
            ...eventData,
            createdBy: req.user._id,
            createdAt: new Date()
        };

        project.timeline.push(event);
        await project.save();

        const newEvent = project.timeline[project.timeline.length - 1];
        res.status(201).json({
            ...newEvent.toObject(),
            projectId: project._id,
            projectName: project.name
        });
    } catch (error) {
        next(error);
    }
};

exports.updateTimelineEvent = async (req, res, next) => {
    try {
        const { error } = validateTimelineEvent({
            ...req.body,
            projectId: 'placeholder'
        });
        if (error) {
            throw new ApiError(400, error.details[0].message);
        }

        const project = await Project.findOne({
            'timeline._id': req.params.eventId,
            $or: [
                { manager: req.user._id },
                { 'team.user': req.user._id },
                { createdBy: req.user._id }
            ]
        });

        if (!project) {
            throw new ApiError(404, 'Timeline event not found or access denied');
        }

        const event = project.timeline.id(req.params.eventId);
        Object.assign(event, req.body);
        await project.save();

        res.json({
            ...event.toObject(),
            projectId: project._id,
            projectName: project.name
        });
    } catch (error) {
        next(error);
    }
};

exports.deleteTimelineEvent = async (req, res, next) => {
    try {
        const project = await Project.findOne({
            'timeline._id': req.params.eventId,
            $or: [
                { manager: req.user._id },
                { 'team.user': req.user._id },
                { createdBy: req.user._id }
            ]
        });

        if (!project) {
            throw new ApiError(404, 'Timeline event not found or access denied');
        }

        project.timeline = project.timeline.filter(
            event => !event._id.equals(req.params.eventId)
        );

        await project.save();
        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

exports.getProjectTimelineEvents = async (req, res, next) => {
    try {
        const project = await Project.findOne({
            _id: req.params.projectId,
            $or: [
                { manager: req.user._id },
                { 'team.user': req.user._id },
                { createdBy: req.user._id }
            ]
        }).select('timeline name');

        if (!project) {
            throw new ApiError(404, 'Project not found or access denied');
        }

        const events = project.timeline.map(event => ({
            ...event.toObject(),
            projectId: project._id,
            projectName: project.name
        }));

        events.sort((a, b) => new Date(b.date) - new Date(a.date));
        res.json(events);
    } catch (error) {
        next(error);
    }
}; 