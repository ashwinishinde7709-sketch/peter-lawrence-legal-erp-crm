export function errorHandler(error, _req, res, _next) {
  console.error(error);
  if (error?.code === 11000) {
    return res.status(409).json({ message: 'A record with that value already exists' });
  }
  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    return res.status(400).json({ message: error.message });
  }
  if (error?.name === 'MulterError') {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ message: error.message });
  }
  return res.status(error.status || 500).json({ message: error.message || 'Unexpected server error' });
}
