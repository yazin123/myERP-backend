const Role = require('../../models/Role');
const Permission = require('../../models/Permission');
const RolePermission = require('../../models/RolePermission');
const RBACService = require('../../services/rbacService');
const logger = require('../../utils/logger');

const rbacController = {
    // Role Management
    getAllRoles: async (req, res) => {
        try {
            const roles = await Role.find()
                .populate('parent', 'name')
                .sort('level');

            res.json({
                success: true,
                data: roles
            });
        } catch (error) {
            logger.error('Get all roles error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch roles'
            });
        }
    },

    createRole: async (req, res) => {
        try {
            const { name, description, parentId, level } = req.body;

            // Check if role already exists
            const existingRole = await Role.findOne({ name });
            if (existingRole) {
                return res.status(400).json({
                    success: false,
                    message: 'Role already exists'
                });
            }

            // Create new role
            const role = new Role({
                name,
                description,
                parent: parentId,
                level,
                createdBy: req.user._id
            });

            await role.save();

            // Clear RBAC cache
            RBACService.clearCache();

            res.json({
                success: true,
                data: role
            });
        } catch (error) {
            logger.error('Create role error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create role'
            });
        }
    },

    updateRole: async (req, res) => {
        try {
            const { name, description, parentId, level } = req.body;
            const roleId = req.params.id;

            // Check if role exists
            const role = await Role.findById(roleId);
            if (!role) {
                return res.status(404).json({
                    success: false,
                    message: 'Role not found'
                });
            }

            // Cannot modify system roles
            if (role.isSystem) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot modify system roles'
                });
            }

            // Update role
            role.name = name || role.name;
            role.description = description || role.description;
            role.parent = parentId || role.parent;
            role.level = level || role.level;
            role.updatedBy = req.user._id;

            await role.save();

            // Clear RBAC cache
            RBACService.clearCache();

            res.json({
                success: true,
                data: role
            });
        } catch (error) {
            logger.error('Update role error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update role'
            });
        }
    },

    deleteRole: async (req, res) => {
        try {
            const roleId = req.params.id;

            // Check if role exists
            const role = await Role.findById(roleId);
            if (!role) {
                return res.status(404).json({
                    success: false,
                    message: 'Role not found'
                });
            }

            // Cannot delete system roles
            if (role.isSystem) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot delete system roles'
                });
            }

            // Check if role has child roles
            const hasChildren = await Role.exists({ parent: roleId });
            if (hasChildren) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot delete role with child roles'
                });
            }

            // Delete role and its permissions
            await Promise.all([
                Role.findByIdAndDelete(roleId),
                RolePermission.deleteMany({ role: roleId })
            ]);

            // Clear RBAC cache
            RBACService.clearCache();

            res.json({
                success: true,
                message: 'Role deleted successfully'
            });
        } catch (error) {
            logger.error('Delete role error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete role'
            });
        }
    },

    // Permission Management
    getAllPermissions: async (req, res) => {
        try {
            const permissions = await Permission.find()
                .sort('module action');

            res.json({
                success: true,
                data: permissions
            });
        } catch (error) {
            logger.error('Get all permissions error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch permissions'
            });
        }
    },

    createPermission: async (req, res) => {
        try {
            const { name, description, module, action, conditions } = req.body;

            // Check if permission already exists
            const existingPermission = await Permission.findOne({ name });
            if (existingPermission) {
                return res.status(400).json({
                    success: false,
                    message: 'Permission already exists'
                });
            }

            // Create new permission
            const permission = new Permission({
                name,
                description,
                module,
                action,
                conditions,
                createdBy: req.user._id
            });

            await permission.save();

            // Clear RBAC cache
            RBACService.clearCache();

            res.json({
                success: true,
                data: permission
            });
        } catch (error) {
            logger.error('Create permission error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create permission'
            });
        }
    },

    // Role Permission Management
    getRolePermissions: async (req, res) => {
        try {
            const roleId = req.params.roleId;

            const rolePermissions = await RolePermission.find({ role: roleId })
                .populate('permission')
                .sort('permission.module permission.action');

            res.json({
                success: true,
                data: rolePermissions
            });
        } catch (error) {
            logger.error('Get role permissions error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch role permissions'
            });
        }
    },

    updateRolePermissions: async (req, res) => {
        try {
            const roleId = req.params.roleId;
            const { permissions } = req.body;

            // Check if role exists
            const role = await Role.findById(roleId);
            if (!role) {
                return res.status(404).json({
                    success: false,
                    message: 'Role not found'
                });
            }

            // Cannot modify system role permissions
            if (role.isSystem) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot modify system role permissions'
                });
            }

            // Update permissions
            await RolePermission.deleteMany({ role: roleId });

            const rolePermissions = permissions.map(p => ({
                role: roleId,
                permission: p.permissionId,
                granted: p.granted,
                conditions: p.conditions,
                createdBy: req.user._id
            }));

            await RolePermission.insertMany(rolePermissions);

            // Clear RBAC cache
            RBACService.clearCache();

            res.json({
                success: true,
                message: 'Role permissions updated successfully'
            });
        } catch (error) {
            logger.error('Update role permissions error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update role permissions'
            });
        }
    }
};

module.exports = rbacController; 