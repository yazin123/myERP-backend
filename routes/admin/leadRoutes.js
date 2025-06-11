// routes/leadRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, checkAccess, apiLimiter } = require('../../middleware/auth');
const leadController = require('../../controllers/admin/leadController');
const upload = require('../../middleware/upload');

// Get all leads
router.get('', authenticate, leadController.getLeads);

// Get all leads (admin)
router.get('/all', authenticate, leadController.getAllLeads);

// Get leads dashboard
router.get('/dashboard', authenticate, leadController.getLeadsDashboard);

// Get lead by ID
router.get('/:id', authenticate, leadController.getLeadById);

// Get leads by lead owner
router.get('/owner/:id', authenticate, leadController.getLeadsByLeadOwner);

// Create new lead
router.post('', authenticate, upload.fields([
    { name: 'documents', maxCount: 5 }
]), leadController.createLead);

// Update lead
router.put('/:id', authenticate, apiLimiter, checkAccess, upload.fields([
    { name: 'documents', maxCount: 5 }
]), leadController.updateLead);

// Update lead status
router.patch('/:id/status', authenticate, checkAccess, leadController.updateStatusLead);

// Give access to user
router.post('/:id/access/:userid', authenticate, checkAccess, leadController.giveAccessToUser);

// Follow-ups
router.get('/:id/followups', authenticate, leadController.getfollowupsByLeadId);
router.post('/:id/followups', authenticate, checkAccess, upload.array('files'), leadController.addFollowUps);
router.put('/followups/:id', authenticate, checkAccess, upload.array('files'), leadController.updateFollowUps);
router.patch('/followups/:id/status', authenticate, checkAccess, leadController.updateFollowUpsStatus);

module.exports = router;