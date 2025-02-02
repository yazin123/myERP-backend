
// middleware/auth.js
const jwt = require('jsonwebtoken');
const Lead = require('../models/Lead');


const loginAuth = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
       
        if (!token) {
            console.log("authentication required")
            return res.status(401).json({ message: 'Authentication required' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {   
        res.status(401).json({ message: 'Invalid token' });
    }
};

const adminAuth = (req, res, next) => {
    try {
        if (!['admin', 'superadmin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'Admin access required' });
        }
        next();
    } catch (error) {
        res.status(403).json({ message: 'Access denied' });
    }
};
const teamLeadAuth = (req, res, next) => {
    try {
        if (!['team lead', 'admin'].includes(req.user.role)) {
            return res.status(403).json({ message: 'team lead access required' });
        }
        next();
    } catch (error) {
        res.status(403).json({ message: 'Access denied' });
    }
};

const superadminAuth = (req, res, next) => {
    try {
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ message: 'Superadmin access required' });
        }
        next();
    } catch (error) {
        res.status(403).json({ message: 'Access denied' });
    }
};




const checkAccess = async (req, res, next) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ message: 'Lead not found' });
        console.log("checking acccess", req.user)
        const hasAccess = 
            lead.leadOwner.equals(req.user.userId) || 
            lead.access.includes(req.user.userId) || 
            req.user.role === 'admin' ||
            req.user.role === 'superadmin';

        if (!hasAccess) {
            return res.status(403).json({ message: 'Access denied' });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { loginAuth, adminAuth, superadminAuth, teamLeadAuth, checkAccess};

