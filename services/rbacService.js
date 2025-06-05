const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RolePermission = require('../models/RolePermission');
const logger = require('../utils/logger');

class RBACService {
    // Cache for permissions to avoid frequent DB lookups
    static permissionCache = new Map();
    static roleLevelCache = new Map();

    // Initialize system roles
    static async initializeSystemRoles(superadminUser) {
        try {
            // Create superadmin role if it doesn't exist
            const superadminRole = await Role.findOneAndUpdate(
                { name: 'superadmin' },
                {
                    name: 'superadmin',
                    description: 'Super Administrator with full system access',
                    level: 100,
                    isSystem: true,
                    canManageRoles: true,
                    createdBy: superadminUser._id
                },
                { upsert: true, new: true }
            );

            // Create admin role if it doesn't exist
            await Role.findOneAndUpdate(
                { name: 'admin' },
                {
                    name: 'admin',
                    description: 'Administrator with high-level system access',
                    level: 90,
                    parent: superadminRole._id,
                    isSystem: true,
                    canManageRoles: true,
                    createdBy: superadminUser._id
                },
                { upsert: true, new: true }
            );

            logger.info('System roles initialized successfully');
        } catch (error) {
            logger.error('Error initializing system roles:', error);
            throw error;
        }
    }

    // Check if a user has a specific permission
    static async hasPermission(user, permissionName, context = {}) {
        try {
            // Superadmin always has all permissions
            if (user.role.name === 'superadmin') return true;

            // No need to find the role again since it's populated
            const userRole = user.role;
            if (!userRole) return false;

            // Get all roles in the hierarchy (including parent roles)
            const roles = await this.getAllParentRoles(userRole._id);
            roles.push(userRole._id);

            // Check permission cache first
            const cacheKey = `${roles.join(',')}-${permissionName}`;
            if (this.permissionCache.has(cacheKey)) {
                return this.permissionCache.get(cacheKey);
            }

            // Find the permission
            const permission = await Permission.findOne({ name: permissionName });
            if (!permission) return false;

            // Check if any role has this permission
            const rolePermission = await RolePermission.findOne({
                role: { $in: roles },
                permission: permission._id,
                granted: true
            });

            const hasPermission = !!rolePermission;
            
            // Cache the result
            this.permissionCache.set(cacheKey, hasPermission);
            
            return hasPermission;
        } catch (error) {
            logger.error('Error checking permission:', error);
            return false;
        }
    }

    // Get all parent roles recursively
    static async getAllParentRoles(roleId, visited = new Set()) {
        if (visited.has(roleId.toString())) return [];
        visited.add(roleId.toString());

        const role = await Role.findById(roleId);
        if (!role || !role.parent) return [];

        const parents = [role.parent];
        const grandParents = await this.getAllParentRoles(role.parent, visited);
        return [...parents, ...grandParents];
    }

    // Compare role levels
    static async compareRoles(role1, role2) {
        const [level1, level2] = await Promise.all([
            this.getRoleLevel(role1),
            this.getRoleLevel(role2)
        ]);
        return level1 - level2;
    }

    // Get role level (with caching)
    static async getRoleLevel(roleName) {
        if (this.roleLevelCache.has(roleName)) {
            return this.roleLevelCache.get(roleName);
        }

        const role = await Role.findOne({ name: roleName });
        if (!role) return -1;

        this.roleLevelCache.set(roleName, role.level);
        return role.level;
    }

    // Clear caches
    static clearCache() {
        this.permissionCache.clear();
        this.roleLevelCache.clear();
    }
}

module.exports = RBACService; 