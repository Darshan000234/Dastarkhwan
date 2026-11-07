export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const statusCode = Number(error.statusCode || error.status) || 500;
  const message = statusCode >= 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error.'
    : error.message || 'Internal server error.';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' ? { stack: error.stack } : {}),
  });
}
