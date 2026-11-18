import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../../utils/apiResponse.js';
import * as authService from './auth.service.js';

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  return sendCreated(res, result);
});

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return sendSuccess(res, result);
});

export const logout = asyncHandler(async (_req, res) => {
  // Stateless JWT logout; client clears token from storage.
  return sendSuccess(res, { message: 'Logged out successfully.' });
});

export const me = asyncHandler(async (req, res) => {
  const result = await authService.getCurrentUser(req.user.id);
  return sendSuccess(res, result);
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user.id, req.body);
  return sendSuccess(res, { user });
});

export const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(req.user.id, req.body);
  return sendSuccess(res, result);
});
