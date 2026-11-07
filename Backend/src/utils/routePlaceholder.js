/**
 * Controller declaration placeholder.
 * Implement this function in a later controller-focused task.
 */
export const notImplemented = (req, res) => {
  res.status(501).json({
    success: false,
    message: 'This endpoint is registered but its controller is not implemented yet.',
  });
};
