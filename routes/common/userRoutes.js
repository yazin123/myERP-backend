const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../../middleware/auth');
const userController = require('../../controllers/common/userController');
const BaseRoutes = require('./baseRoutes');
const { validate, validationChains } = require('../../middleware/validation');

// Configure multer for profile photo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../uploads/photos');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const uploadMulter = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

class UserRoutes extends BaseRoutes {
    constructor() {
        super(userController);
    }

    initializeRoutes() {
        // Authentication routes (no authentication required)
        this.createRoute(
            '/login',
            'POST',
            this.controller.login
        );

        // Authentication required routes
        this.createRoute(
            '/logout',
            'POST',
            this.controller.logout,
            { authenticate: true }
        );

        this.createRoute(
            '/current',
            'GET',
            this.controller.getCurrentUser,
            { authenticate: true }
        );

        // New route for getting user with role information
        this.createRoute(
            '/me/role',
            'GET',
            this.controller.getUserWithRole,
            { authenticate: true }
        );

        // Profile routes
        this.createRoute(
            '/profile/photo/:filename',
            'GET',
            this.controller.getProfilePhoto
        );

        this.createRoute(
            '/profile',
            'PUT',
            this.controller.updateProfile,
            {
                authenticate: true,
                validator: validationChains.user.updateProfile
            }
        );

        this.createRoute(
            '/profile/password',
            'PUT',
            this.controller.changePassword,
            {
                authenticate: true,
                validator: validationChains.user.changePassword
            }
        );

        // Special route for photo upload with multer
        this.router.put(
            '/profile/photo',
            authenticate,
            uploadMulter.single('photo'),
            this.controller.updatePhoto
        );

        // User management routes
        this.createRoute(
            '/',
            'GET',
            this.controller.getUsers,
            {
                authenticate: true,
                permission: 'user.read'
            }
        );

        this.createRoute(
            '/:id',
            'GET',
            this.controller.getUserById,
            {
                authenticate: true,
                permission: 'user.read',
                validator: validationChains.user.getById
            }
        );

        this.createRoute(
            '/',
            'POST',
            this.controller.createUser,
            {
                authenticate: true,
                permission: 'user.create',
                validator: validationChains.user.create
            }
        );

        this.createRoute(
            '/:id',
            'PUT',
            this.controller.updateUser,
            {
                authenticate: true,
                permission: 'user.update',
                validator: validationChains.user.update
            }
        );

        this.createRoute(
            '/:id',
            'DELETE',
            this.controller.deleteUser,
            {
                authenticate: true,
                permission: 'user.delete',
                validator: validationChains.user.delete
            }
        );
    }
}

// Export router instance
module.exports = new UserRoutes().getRouter(); 