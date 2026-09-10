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

  // If headers have already been sent, delegate to Express's default handler
  if (res.headersSent) {
    return next(err);
  }

  const status = typeof err.statusCode === 'number' ? err.statusCode : (typeof err.status === 'number' ? err.status : 500);
  
  // Sanitize error messages on 5xx errors in production to avoid leaking internals
  const message = status >= 500 && process.env.NODE_ENV !== 'development'
    ? 'Internal Server Error'
    : (err.message || 'Internal Server Error');

  res.status(status).json({
    status: 'error',
    statusCode: status,
    message: message,
    // Only expose stack traces in explicit development mode
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}
