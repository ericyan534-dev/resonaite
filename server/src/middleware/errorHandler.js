/**
 * Express error handler middleware
 * Catches and formats all errors as JSON responses
 */

function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV === 'development';

  // Log error for debugging
  if (isDev) {
    console.error('Error:', err);
  }

  // Extract status code and message
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Build response
  const response = {
    error: message,
    status
  };

  // Include stack trace in development
  if (isDev && err.stack) {
    response.stack = err.stack;
  }

  res.status(status).json(response);
}

module.exports = errorHandler;
