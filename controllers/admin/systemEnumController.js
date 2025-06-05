const SystemEnum = require('../../models/SystemEnum');
const { validateObjectId } = require('../../utils/validators');
const { AppError } = require('../../utils/error').default;

// Create a new system enum
exports.createSystemEnum = async (req, res, next) => {
    try {
        const { name, description, module, type, values } = req.body;

        // Create new system enum
        const systemEnum = new SystemEnum({
            name,
            description,
            module,
            type,
            values: values.map((value, index) => ({
                ...value,
                order: value.order || index
            })),
            createdBy: req.user._id
        });

        await systemEnum.save();

        res.status(201).json({
            success: true,
            data: systemEnum
        });
    } catch (error) {
        if (error.code === 11000) {
            return next(new AppError('System enum with this name already exists', 400));
        }
        next(error);
    }
};

// Get all system enums
exports.getAllSystemEnums = async (req, res, next) => {
    try {
        console.log("=============getAllSystemEnums");
        const systemEnums = await SystemEnum.find({ isActive: true })
            .sort({ module: 1, type: 1, name: 1 });

        res.status(200).json({
            success: true,
            data: systemEnums
        });
    } catch (error) {
        next(error);
    }
};

// Get system enum by ID
exports.getSystemEnumById = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!validateObjectId(id)) {
            return next(new AppError('Invalid system enum ID', 400));
        }

        const systemEnum = await SystemEnum.findOne({ _id: id, isActive: true });

        if (!systemEnum) {
            return next(new AppError('System enum not found', 404));
        }

        res.status(200).json({
            success: true,
            data: systemEnum
        });
    } catch (error) {
        next(error);
    }
};

// Get system enums by module and type
exports.getSystemEnumsByModuleAndType = async (req, res, next) => {
    try {
        const { module, type } = req.params;

        const systemEnums = await SystemEnum.find({
            module,
            type,
            isActive: true
        }).sort({ 'values.order': 1 });

        res.status(200).json({
            success: true,
            data: systemEnums
        });
    } catch (error) {
        next(error);
    }
};

// Update system enum
exports.updateSystemEnum = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, module, type, values } = req.body;

        if (!validateObjectId(id)) {
            return next(new AppError('Invalid system enum ID', 400));
        }

        const systemEnum = await SystemEnum.findOne({ _id: id, isActive: true });

        if (!systemEnum) {
            return next(new AppError('System enum not found', 404));
        }

        // Don't allow modification of system enums
        if (systemEnum.isSystem) {
            return next(new AppError('Cannot modify system enums', 400));
        }

        systemEnum.name = name || systemEnum.name;
        systemEnum.description = description || systemEnum.description;
        systemEnum.module = module || systemEnum.module;
        systemEnum.type = type || systemEnum.type;
        
        if (values) {
            systemEnum.values = values.map((value, index) => ({
                ...value,
                order: value.order || index
            }));
        }
        
        systemEnum.updatedBy = req.user._id;

        await systemEnum.save();

        res.status(200).json({
            success: true,
            data: systemEnum
        });
    } catch (error) {
        if (error.code === 11000) {
            return next(new AppError('System enum with this name already exists', 400));
        }
        next(error);
    }
};

// Delete system enum (soft delete)
exports.deleteSystemEnum = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!validateObjectId(id)) {
            return next(new AppError('Invalid system enum ID', 400));
        }

        const systemEnum = await SystemEnum.findOne({ _id: id, isActive: true });

        if (!systemEnum) {
            return next(new AppError('System enum not found', 404));
        }

        // Don't allow deletion of system enums
        if (systemEnum.isSystem) {
            return next(new AppError('Cannot delete system enums', 400));
        }

        systemEnum.isActive = false;
        systemEnum.updatedBy = req.user._id;
        await systemEnum.save();

        res.status(200).json({
            success: true,
            message: 'System enum deleted successfully'
        });
    } catch (error) {
        next(error);
    }
}; 