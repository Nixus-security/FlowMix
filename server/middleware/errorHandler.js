export function errorHandler(err, _req, res, _next) {
  const status = err.status ?? err.statusCode ?? 500;
  console.error(`[error] ${err.message}`);
  res.status(status).json({
    error:   err.message ?? 'Internal server error',
    status,
  });
}

export function notFound(_req, res) {
  res.status(404).json({ error: 'Route introuvable', status: 404 });
}
