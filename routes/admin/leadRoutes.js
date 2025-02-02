// routes/leadRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { loginAuth, checkAccess, apiLimiter } = require('../../middleware/auth');
const leadController = require('../../controllers/admin/leadController');

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/leads');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

// Lead routes with authentication and authorization
router.get('', loginAuth, leadController.getLeads);
router.get('/all', loginAuth, leadController.getAllLeads);
router.get('/dashboard', loginAuth, leadController.getLeadsDashboard);
router.get('/:id', loginAuth, leadController.getLeadById);
router.get('/owner/:id', loginAuth, leadController.getLeadsByLeadOwner);
router.post('', loginAuth, upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'companyPhoto', maxCount: 1 }
]), leadController.createLead);
router.put('/:id', loginAuth,apiLimiter, checkAccess, upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'companyPhoto', maxCount: 1 }
]), leadController.updateLead);
router.patch('/:id/status', loginAuth, checkAccess, leadController.updateStatusLead);
router.post('/:id/access/:userid', loginAuth, checkAccess, leadController.giveAccessToUser);

// Followup routes
router.get('/:id/followups', loginAuth, leadController.getfollowupsByLeadId);
router.post('/:id/followups', loginAuth, checkAccess, upload.array('files'), leadController.addFollowUps);
router.put('/followups/:id', loginAuth, checkAccess, upload.array('files'), leadController.updateFollowUps);
router.patch('/followups/:id/status', loginAuth, checkAccess, leadController.updateFollowUpsStatus);


module.exports = router;