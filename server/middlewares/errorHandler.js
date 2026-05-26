/**
 * Global operational error-handling middleware.
 * Ensures consistent JSON formatted payload responses.
 * 
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function errorHandler(err, req, res, next) {
  console.error('❌ Operational server error occurred:', err);

  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    status: 'error',
    statusCode: status,
    message: message,
    // Safely hide trace stack dumps in potential production stages
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
}
