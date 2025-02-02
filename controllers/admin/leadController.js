// controllers/leadController.js
const Lead = require('../../models/Lead');
const Followup = require('../../models/Followup');

const leadController = {
    async getLeads(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 10; // Fixed limit of 10 leads per page
            const skipIndex = (page - 1) * limit;
    
            const leads = await Lead.find()
                .populate('leadOwner', 'name email')
                .populate('access', 'name email')
                .skip(skipIndex)
                .limit(limit)
                .sort({dateCreated: -1});
    
            const total = await Lead.countDocuments();
    
            res.json({
                leads,
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalLeads: total
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    async getAllLeads(req, res) {
        try {
            const leads = await Lead.find()
                .populate('leadOwner', 'name email')
                .populate('access', 'name email')
                .sort({dateCreated: -1});
    
            res.json(leads);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
    async getLeadsDashboard(req, res) {
        try {
            console.log("fetching all leads")
            const leads = await Lead.find()
                .populate('leadOwner', 'name email')
                .populate('access', 'name email');
            res.json(leads);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },


    async getLeadById(req, res) {
        try {
            const lead = await Lead.findById(req.params.id)
                .populate('leadOwner', 'name email')
                .populate('access', 'name email');
            if (!lead) return res.status(404).json({ message: 'Lead not found' });
            res.json(lead);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getfollowupsByLeadId(req, res) {
        try {
            const lead = await Followup.find({ leadId: req.params.id })
                .populate('leadId', 'name email')
                .populate('createdBy', 'name email');
            if (!lead) return res.status(404).json({ message: 'Lead not found' });
            res.json(lead);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async getLeadsByLeadOwner(req, res) {
        try {
            const leads = await Lead.find({ leadOwner: req.params.id })
                .populate('leadOwner', 'name email')
                .populate('access', 'name email');
            res.json(leads);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    async createLead(req, res) {
        try {
            if (!req.body.leadOwner) {
                req.body.leadOwner = req.user.userId
            }
            const leadData = {
                ...req.body,
                createdBy: req.user.userId,
                photo: req.files?.photo?.[0]?.path,
                companyPhoto: req.files?.companyPhoto?.[0]?.path
            };
            const lead = await Lead.create(leadData);
            res.status(201).json(lead);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async updateLead(req, res) {
        try {
            const updateData = {
                ...req.body,
                photo: req.files?.photo?.[0]?.path || req.body.photo,
                companyPhoto: req.files?.companyPhoto?.[0]?.path || req.body.companyPhoto
            };
            const lead = await Lead.findByIdAndUpdate(req.params.id, updateData, { new: true });
            if (!lead) return res.status(404).json({ message: 'Lead not found' });
            res.json(lead);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async updateStatusLead(req, res) {
        try {
            const lead = await Lead.findById(req.params.id);
            if (!lead) return res.status(404).json({ message: 'Lead not found' });

            lead.status = req.body.status;
            lead.statusHistory.push({
                status: req.body.status,
                timestamp: new Date()
            });

            await lead.save();
            res.json(lead);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async giveAccessToUser(req, res) {
        try {
            const lead = await Lead.findById(req.params.id);
            if (!lead) return res.status(404).json({ message: 'Lead not found' });
            console.log("new user", req.params)
            lead.access.addToSet(req.params.userid);
            await lead.save();
            res.json(lead);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async addFollowUps(req, res) {
        try {
            const followupData = {
                ...req.body,
                leadId: req.params.id,
                createdBy: req.user.userId,
                status: 'created',
                files: req.files?.map(file => file.path)
            };
            const followup = await Followup.create(followupData);
            res.status(201).json(followup);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async updateFollowUps(req, res) {
        try {
            const updateData = {
                ...req.body,
                updatedBy: req.user.id,
                updatedDateTime: new Date(),
                files: req.files?.map(file => file.path) || req.body.files
            };
            const followup = await Followup.findByIdAndUpdate(req.params.id, updateData, { new: true });
            if (!followup) return res.status(404).json({ message: 'Followup not found' });
            res.json(followup);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    async updateFollowUpsStatus(req, res) {
        try {
            const followup = await Followup.findByIdAndUpdate(
                req.params.id,
                { status: req.body.status },
                { new: true }
            );
            if (!followup) return res.status(404).json({ message: 'Followup not found' });
            res.json(followup);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
};

module.exports = leadController;