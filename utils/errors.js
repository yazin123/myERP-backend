class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends ApiError {
  constructor(message) {
    super(400, message);
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends ApiError {
  constructor(message = 'Authentication failed') {
    super(401, message);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends ApiError {
  constructor(message = 'Not authorized to access this resource') {
    super(403, message);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

module.exports = {
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError
}; 