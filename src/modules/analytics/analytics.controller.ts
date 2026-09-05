import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import analyticsService from './analytics.service';

const getSummary = catchAsync(async (_req, res) => {
  const data = await analyticsService.getSummary();
  sendResponse(res, { statusCode: httpStatus.OK, message: 'Analytics summary retrieved successfully', data });
});

const getByCategory = catchAsync(async (_req, res) => {
  const data = await analyticsService.getByCategory();
  sendResponse(res, { statusCode: httpStatus.OK, message: 'Spend by category retrieved successfully', data });
});

const getByMonth = catchAsync(async (_req, res) => {
  const data = await analyticsService.getByMonth();
  sendResponse(res, { statusCode: httpStatus.OK, message: 'Spend by month retrieved successfully', data });
});

const getUpcomingWarranty = catchAsync(async (_req, res) => {
  const data = await analyticsService.getUpcomingWarranty();
  sendResponse(res, { statusCode: httpStatus.OK, message: 'Upcoming warranty expirations retrieved successfully', data });
});

export default { getSummary, getByCategory, getByMonth, getUpcomingWarranty };
