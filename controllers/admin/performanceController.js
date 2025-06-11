// controllers/admin/performanceController.js
const Performance = require('../../models/Performance');
const User = require('../../models/User');
const mongoose = require('mongoose');

const performanceController = {
  // Get all performance records with filtering
  getAllPerformance: async (req, res) => {
    try {
      const {
        userId,
        month,
        year,
        category,
        startDate,
        endDate,
        page = 1,
        limit = 10,
        sortBy = 'createdDate',
        sortOrder = 'desc'
      } = req.query;

      const skip = (page - 1) * limit;

      // Build date filter
      let dateFilter = {};
      if (startDate && endDate) {
        dateFilter = {
          createdDate: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        };
      } else if (month && year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        dateFilter = {
          createdDate: {
            $gte: startDate,
            $lte: endDate
          }
        };
      } else if (year) {
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31);
        dateFilter = {
          createdDate: {
            $gte: startDate,
            $lte: endDate
          }
        };
      }

      // Build query
      let query = { ...dateFilter };
      if (userId) {
        query.userId = mongoose.Types.ObjectId(userId);
      }
      if (category) {
        query.category = category;
      }

      // Build sort options
      const sortOptions = {
        [sortBy]: sortOrder === 'desc' ? -1 : 1
      };

      // Execute main query
      const performance = await Performance.find(query)
        .populate('userId', 'name email department position')
        .populate('taskId', 'description')
        .populate({
          path: 'createdBy',
          select: 'name',
          // Only populate if createdBy is an ObjectId
          match: { _id: { $exists: true } }
        })
        .skip(skip)
        .limit(parseInt(limit))
        .sort(sortOptions);

      // Get aggregated stats
      const stats = await Performance.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalPoints: { $sum: "$points" },
            avgPoints: { $avg: "$points" },
            maxPoints: { $max: "$points" },
            minPoints: { $min: "$points" },
            totalRecords: { $sum: 1 },
            categories: {
              $push: {
                category: "$category",
                points: "$points"
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            totalPoints: 1,
            avgPoints: 1,
            maxPoints: 1,
            minPoints: 1,
            totalRecords: 1,
            categoryBreakdown: {
              $reduce: {
                input: "$categories",
                initialValue: {},
                in: {
                  $mergeObjects: [
                    "$$value",
                    {
                      $arrayToObject: [[{
                        k: "$$this.category",
                        v: {
                          count: { $add: [{ $ifNull: [{ $getField: { field: { $concat: ["$$this.category", "_count"] }, input: "$$value" } }, 0] }, 1] },
                          points: { $add: [{ $ifNull: [{ $getField: { field: { $concat: ["$$this.category", "_points"] }, input: "$$value" } }, 0] }, "$$this.points"] }
                        }
                      }]]
                    }
                  ]
                }
              }
            }
          }
        }
      ]);

      // Get total count for pagination
      const totalRecords = await Performance.countDocuments(query);
      const totalPages = Math.ceil(totalRecords / limit);

      // Transform response to handle CRON cases
      const transformedPerformance = performance.map(record => {
        const doc = record.toObject();
        if (doc.createdBy === 'CRON' || doc.createdBy === null) {
          doc.createdBy = {
            _id: 'CRON',
            name: 'Automated System'
          };
        }
        return doc;
      });

      res.json({
        success: true,
        data: transformedPerformance,
        stats: stats[0] || {
          totalPoints: 0,
          avgPoints: 0,
          maxPoints: 0,
          minPoints: 0,
          totalRecords: 0,
          categoryBreakdown: {}
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalRecords,
          limit: parseInt(limit)
        }
      });

    } catch (error) {
      console.log('Error in getAllPerformance:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch performance records',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Get performance by ID
  getPerformanceById: async (req, res) => {
    try {
      console.log("data is fetching for peroformance by id")
      const performance = await Performance.findById(req.params.id)
        .populate('userId', 'name email department position')
        .populate('taskId', 'description')
        .populate({
          path: 'createdBy',
          select: 'name',
          match: { _id: { $exists: true } }
        });

      if (!performance) {
        return res.status(404).json({
          success: false,
          message: 'Performance record not found'
        });
      }

      // Transform response for CRON case
      const doc = performance.toObject();
      if (doc.createdBy === 'CRON' || doc.createdBy === null) {
        doc.createdBy = {
          _id: 'CRON',
          name: 'Automated System'
        };
      }

      res.json({
        success: true,
        data: doc
      });

    } catch (error) {
      console.log('Error in getPerformanceById:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch performance record',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Create new performance record
  createPerformance: async (req, res) => {
    try {
      const {
        userId,
        category,
        points,
        remark,
        taskId
      } = req.body;

      // Validate user exists
      const userExists = await User.exists({ _id: userId });
      if (!userExists) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Create performance record
      const performance = new Performance({
        userId,
        category,
        points,
        remark,
        taskId,
        createdBy: req.user._id // Assuming req.user is set by auth middleware
      });

      await performance.save();

      const savedPerformance = await Performance.findById(performance._id)
        .populate('userId', 'name email department position')
        .populate('taskId', 'description')
        .populate('createdBy', 'name');

      res.status(201).json({
        success: true,
        message: 'Performance record created successfully',
        data: savedPerformance
      });

    } catch (error) {
      console.log('Error in createPerformance:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create performance record',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Update performance record
  updatePerformance: async (req, res) => {
    try {
      const {
        category,
        points,
        remark,
        taskId
      } = req.body;

      const performance = await Performance.findById(req.params.id);

      if (!performance) {
        return res.status(404).json({
          success: false,
          message: 'Performance record not found'
        });
      }

      // Update fields
      performance.category = category || performance.category;
      performance.points = points || performance.points;
      performance.remark = remark || performance.remark;
      performance.taskId = taskId || performance.taskId;

      await performance.save();

      const updatedPerformance = await Performance.findById(performance._id)
        .populate('userId', 'name email department position')
        .populate('taskId', 'description')
        .populate('createdBy', 'name');

      res.json({
        success: true,
        message: 'Performance record updated successfully',
        data: updatedPerformance
      });

    } catch (error) {
      console.log('Error in updatePerformance:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update performance record',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Delete performance record
  deletePerformance: async (req, res) => {
    try {
      const performance = await Performance.findById(req.params.id);

      if (!performance) {
        return res.status(404).json({
          success: false,
          message: 'Performance record not found'
        });
      }

      await performance.remove();

      res.json({
        success: true,
        message: 'Performance record deleted successfully',
        data: performance
      });

    } catch (error) {
      console.log('Error in deletePerformance:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete performance record',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Get performance summary for a specific user
  getUserPerformanceSummary: async (req, res) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;

      // Validate user exists
      const user = await User.findById(userId).select('name email department position');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Build date filter
      let dateFilter = {};
      if (startDate && endDate) {
        dateFilter = {
          createdDate: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        };
      }

      // Get performance summary
      const summary = await Performance.aggregate([
        {
          $match: {
            userId: mongoose.Types.ObjectId(userId),
            ...dateFilter
          }
        },
        {
          $group: {
            _id: '$category',
            totalPoints: { $sum: '$points' },
            count: { $sum: 1 },
            avgPoints: { $avg: '$points' },
            records: { $push: '$$ROOT' }
          }
        },
        {
          $project: {
            category: '$_id',
            totalPoints: 1,
            count: 1,
            avgPoints: 1,
            lastFiveRecords: { $slice: ['$records', -5] }
          }
        }
      ]);

      // Get overall stats
      const overallStats = await Performance.aggregate([
        {
          $match: {
            userId: mongoose.Types.ObjectId(userId),
            ...dateFilter
          }
        },
        {
          $group: {
            _id: null,
            totalPoints: { $sum: '$points' },
            totalRecords: { $sum: 1 },
            avgPoints: { $avg: '$points' },
            maxPoints: { $max: '$points' },
            minPoints: { $min: '$points' }
          }
        },
        {
          $project: {
            _id: 0,
            totalPoints: 1,
            totalRecords: 1,
            avgPoints: 1,
            maxPoints: 1,
            minPoints: 1
          }
        }
      ]);

      res.json({
        success: true,
        data: {
          user,
          categorySummary: summary,
          overallStats: overallStats[0] || {
            totalPoints: 0,
            totalRecords: 0,
            avgPoints: 0,
            maxPoints: 0,
            minPoints: 0
          }
        }
      });

    } catch (error) {
      console.log('Error in getUserPerformanceSummary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch performance summary',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Get own performance summary
  getOwnPerformanceSummary: async (req, res) => {
    try {
      // Use the authenticated user's ID
      req.params.userId = req.user._id;
      await performanceController.getUserPerformanceSummary(req, res);
    } catch (error) {
      console.log('Error in getOwnPerformanceSummary:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch own performance summary',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  // Get employee performance
  getEmployeePerformance: async (req, res) => {
    try {
      const { employeeId } = req.params;
      const { startDate, endDate, departmentId } = req.query;

      // Validate employee exists
      const employee = await User.findById(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      // Build query
      const query = {
        userId: mongoose.Types.ObjectId(employeeId)
      };

      if (startDate && endDate) {
        query.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      if (departmentId) {
        query.departmentId = mongoose.Types.ObjectId(departmentId);
      }

      // Get performance records
      const performance = await Performance.find(query)
        .populate('userId', 'name email department position')
        .populate('taskId', 'title description')
        .sort({ createdAt: -1 });

      // Calculate summary stats
      const stats = await Performance.aggregate([
        {
          $match: query
        },
        {
          $group: {
            _id: null,
            totalPoints: { $sum: '$points' },
            avgPoints: { $avg: '$points' },
            totalRecords: { $sum: 1 },
            categories: {
              $push: {
                category: '$category',
                points: '$points'
              }
            }
          }
        }
      ]);

      // Transform performance records
      const transformedPerformance = performance.map(record => {
        const doc = record.toObject();
        return {
          ...doc,
          score: Math.round(doc.points * 10), // Convert to percentage
          date: doc.createdAt
        };
      });

      res.json({
        success: true,
        data: {
          employee: {
            _id: employee._id,
            name: employee.name,
            email: employee.email,
            department: employee.department,
            position: employee.position
          },
          performance: transformedPerformance,
          summary: stats[0] || {
            totalPoints: 0,
            avgPoints: 0,
            totalRecords: 0
          }
        }
      });
    } catch (error) {
      console.error('Error in getEmployeePerformance:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch employee performance',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
};

module.exports = performanceController;