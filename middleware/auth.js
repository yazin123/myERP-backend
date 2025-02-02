const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Project = require('../models/Project')

// In-memory token blacklist
const tokenBlacklist = new Set();

// Rate limiting configuration
const loginLimiter = rateLimit({
   windowMs: 15 * 60 * 1000, // 15 minutes
   max: 5, 
   message: 'Too many login attempts. Please try again later.'
});

const apiLimiter = rateLimit({
   windowMs: 60 * 1000, // 1 minute
   max: 100
});

// Token generation
const generateTokens = (user) => ({
   accessToken: jwt.sign(
       { userId: user._id, role: user.role },
       process.env.JWT_SECRET,
       { expiresIn: '15m' }
   ),
   refreshToken: jwt.sign(
       { userId: user._id },
       process.env.REFRESH_TOKEN_SECRET,
       { expiresIn: '7d' }
   )
});

const loginAuth = async (req, res, next) => {
   try {
       const token = req.headers.authorization?.split(' ')[1];
       if (!token) return res.status(401).json({ message: 'Authentication required' });

       if (tokenBlacklist.has(token)) {
           return res.status(401).json({ message: 'Token revoked' });
       }

       const decoded = jwt.verify(token, process.env.JWT_SECRET);
       const user = await User.findById(decoded.userId);
       
       if (!user || user.status !== 'active') {
           return res.status(401).json({ message: 'User inactive or not found' });
       }

       req.user = decoded;
       next();
   } catch (error) {
       if (error.name === 'TokenExpiredError') {
           return res.status(401).json({ message: 'Token expired' });
       }
       res.status(401).json({ message: 'Invalid token' });
   }
};

const createRoleAuth = (roles) => (req, res, next) => {
   if (!roles.includes(req.user.role)) {
       return res.status(403).json({
           message: `Access denied. Requires ${roles.join(' or ')} role.`
       });
   }
   next();
};

const adminAuth = createRoleAuth(['admin', 'superadmin']);
const teamLeadAuth = createRoleAuth(['team lead', 'admin', 'superadmin']);
const superadminAuth = createRoleAuth(['superadmin']);

const refreshToken = async (req, res) => {
   try {
       const { refreshToken } = req.body;
       if (!refreshToken) {
           return res.status(401).json({ message: 'Refresh token required' });
       }

       const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
       const user = await User.findById(decoded.userId);

       if (!user || user.status !== 'active') {
           return res.status(401).json({ message: 'User inactive or not found' });
       }

       const tokens = generateTokens(user);
       res.json(tokens);
   } catch (error) {
       res.status(401).json({ message: 'Invalid refresh token' });
   }
};

const checkAccess = async (req, res, next) => {
   try {
       const lead = await Lead.findById(req.params.id);
       if (!lead) return res.status(404).json({ message: 'Lead not found' });

       const hasAccess =
           lead.leadOwner.equals(req.user.userId) ||
           lead.access.includes(req.user.userId) ||
           ['admin', 'superadmin'].includes(req.user.role);

       if (!hasAccess) return res.status(403).json({ message: 'Access denied' });
       next();
   } catch (error) {
       res.status(500).json({ error: error.message });
   }
};
const checkAccessProject = async (req, res, next) => {
    try {
        // Get project id from body for PUT/POST requests, or params for GET/DELETE
        const projectId = req.body.id || req.params.id;
        
        if (!projectId) {
            return res.status(400).json({ message: 'Project ID is required' });
        }

        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user has access to the project
        const hasAccess = 
            project.projectOwner.equals(req.user.userId) ||   // Is project owner
            project.assigned_to.includes(req.user.userId) ||  // Is team member
            project.access.includes(req.user.userId) ||       // Has explicit access
            ['admin', 'superadmin'].includes(req.user.role);  // Is admin/superadmin

        if (!hasAccess) {
            return res.status(403).json({ message: 'Access denied to this project' });
        }

        // Add project to request object for potential future use
        req.project = project;
        next();
    } catch (error) {
        console.error('Access check error:', error);
        res.status(500).json({ error: error.message });
    }
};

const logout = async (req, res) => {
   try {
       const token = req.headers.authorization?.split(' ')[1];
       if (token) tokenBlacklist.add(token);
       res.json({ message: 'Logged out successfully' });
   } catch (error) {
       res.status(500).json({ message: 'Logout failed' });
   }
};

module.exports = {
   loginLimiter,
   apiLimiter, 
   loginAuth,
   adminAuth,
   teamLeadAuth,
   superadminAuth,
   refreshToken,
   logout,
   generateTokens,
   checkAccess,
   checkAccessProject
};