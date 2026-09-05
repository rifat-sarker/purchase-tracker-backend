import cron from 'node-cron';
import logger from '../../utils/logger';
import warrantyService from './warranty.service';

/**
 * Runs daily at 08:00 server time. Checks for products whose warranty
 * expires in the next 30 days and haven't been notified yet, emails the
 * owner, and flags them as notified.
 */
const scheduleWarrantyCron = (): void => {
  cron.schedule('0 8 * * *', async () => {
    try {
      await warrantyService.checkAndNotifyExpiringWarranties();
    } catch (err) {
      logger.error(`Warranty cron job failed: ${(err as Error).message}`);
    }
  });

  logger.info('Warranty expiry cron scheduled (daily at 08:00 server time).');
};

export default scheduleWarrantyCron;
