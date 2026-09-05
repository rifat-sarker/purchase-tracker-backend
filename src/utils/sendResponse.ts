import { Response } from 'express';

interface ResponsePayload<T> {
  statusCode: number;
  success?: boolean;
  message: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  data?: T;
}

const sendResponse = <T>(res: Response, payload: ResponsePayload<T>): void => {
  res.status(payload.statusCode).json({
    success: payload.success ?? true,
    statusCode: payload.statusCode,
    message: payload.message,
    ...(payload.meta ? { meta: payload.meta } : {}),
    data: payload.data,
  });
};

export default sendResponse;
