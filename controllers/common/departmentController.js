const Department = require('../../models/Department');
const User = require('../../models/User');
const Project = require('../../models/Project');
const { ApiError } = require('../../utils/errors');

/**
 * Get all departments
 */
exports.getDepartments = async (req, res, next) => {
  try {
    const { search, status, parentDepartment } = req.query;

    // Build query
    const query = {};
    
    if (status) query.status = status;
    if (parentDepartment) query.parentDepartment = parentDepartment;
    
    // Search in name and description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const departments = await Department.find(query)
      .populate('head', 'name email')
      .populate('parentDepartment', 'name')
      .sort({ name: 1 });

    res.json(departments);
  } catch (error) {
    next(error);
  }
};

/**
 * Get department by ID
 */
exports.getDepartmentById = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.departmentId)
      .populate('head', 'name email')
      .populate('parentDepartment', 'name')
      .populate('createdBy', 'name');

    if (!department) {
      throw new ApiError(404, 'Department not found');
    }

    res.json(department);
  } catch (error) {
    next(error);
  }
};

/**
 * Create new department
 */
exports.createDepartment = async (req, res, next) => {
  try {
    const department = new Department({
      ...req.body,
      createdBy: req.user._id
    });

    await department.save();

    // Populate references
    await department.populate([
      { path: 'head', select: 'name email' },
      { path: 'parentDepartment', select: 'name' }
    ]);

    res.status(201).json(department);
  } catch (error) {
    next(error);
  }
};

/**
 * Update department
 */
exports.updateDepartment = async (req, res, next) => {
  try {
    const department = await Department.findByIdAndUpdate(
      req.params.departmentId,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    )
    .populate('head', 'name email')
    .populate('parentDepartment', 'name');

    if (!department) {
      throw new ApiError(404, 'Department not found');
    }

    res.json(department);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete department
 */
exports.deleteDepartment = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.departmentId);
    
    if (!department) {
      throw new ApiError(404, 'Department not found');
    }

    // Check if department has employees
    const employeeCount = await User.countDocuments({ department: department._id });
    if (employeeCount > 0) {
      throw new ApiError(400, 'Cannot delete department with active employees');
    }

    // Check if department has projects
    const projectCount = await Project.countDocuments({ department: department._id });
    if (projectCount > 0) {
      throw new ApiError(400, 'Cannot delete department with active projects');
    }

    // Check if department has sub-departments
    const subDepartmentCount = await Department.countDocuments({ parentDepartment: department._id });
    if (subDepartmentCount > 0) {
      throw new ApiError(400, 'Cannot delete department with sub-departments');
    }

    await department.deleteOne();
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Get department employees
 */
exports.getDepartmentEmployees = async (req, res, next) => {
  try {
    const employees = await User.find({ department: req.params.departmentId })
      .select('name email role status')
      .populate('role', 'name');

    res.json(employees);
  } catch (error) {
    next(error);
  }
};

/**
 * Get department projects
 */
exports.getDepartmentProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({ department: req.params.departmentId })
      .populate('manager', 'name email')
      .sort({ startDate: -1 });

    res.json(projects);
  } catch (error) {
    next(error);
  }
};

/**
 * Get department statistics
 */
exports.getDepartmentStatistics = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.departmentId);
    if (!department) {
      throw new ApiError(404, 'Department not found');
    }

    const [employees, projects, subDepartments] = await Promise.all([
      User.find({ department: department._id }).select('role status'),
      Project.find({ department: department._id }).select('status budget'),
      Department.find({ parentDepartment: department._id }).select('name')
    ]);

    const employeeStats = {
      total: employees.length,
      active: employees.filter(e => e.status === 'active').length,
      roles: employees.reduce((acc, emp) => {
        acc[emp.role] = (acc[emp.role] || 0) + 1;
        return acc;
      }, {})
    };

    const projectStats = {
      total: projects.length,
      inProgress: projects.filter(p => p.status === 'in_progress').length,
      completed: projects.filter(p => p.status === 'completed').length,
      budget: {
        allocated: projects.reduce((sum, p) => sum + p.budget.allocated, 0),
        spent: projects.reduce((sum, p) => sum + p.budget.spent, 0)
      }
    };

    res.json({
      employees: employeeStats,
      projects: projectStats,
      subDepartments: subDepartments.length,
      budget: department.budget
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update department budget
 */
exports.updateDepartmentBudget = async (req, res, next) => {
  try {
    const { allocated, spent } = req.body;
    const department = await Department.findById(req.params.departmentId);
    
    if (!department) {
      throw new ApiError(404, 'Department not found');
    }

    if (allocated !== undefined) {
      department.budget.allocated = allocated;
    }
    
    if (spent !== undefined) {
      department.budget.spent = spent;
    }

    await department.save();
    res.json(department);
  } catch (error) {
    next(error);
  }
}; 