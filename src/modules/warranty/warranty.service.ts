import config from '../../config';
import prisma from '../../lib/prisma';
import logger from '../../utils/logger';
import sendMail from '../../utils/mailer';

/**
 * Finds products whose warranty expires within the next 30 days and that
 * haven't already been notified about, emails the owner one summary
 * email, then marks them as notified so the reminder doesn't repeat daily.
 */
const checkAndNotifyExpiringWarranties = async (): Promise<{ notified: number }> => {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const expiring = await prisma.product.findMany({
    where: {
      warrantyExpiry: { gte: now, lte: in30Days },
      warrantyNotified: false,
    },
    orderBy: { warrantyExpiry: 'asc' },
  });

  if (expiring.length === 0) {
    logger.info('Warranty cron: no products with expiring warranties to notify.');
    return { notified: 0 };
  }

  const to = config.notificationEmailTo || config.owner.email;

  const lines = expiring.map((p) => {
    const days = Math.ceil((p.warrantyExpiry!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    return `- ${p.name} (${p.category}) — warranty expires ${p.warrantyExpiry!.toISOString().slice(0, 10)} (${days} day(s) left)`;
  });

  const text = `The following products have a warranty expiring within 30 days:\n\n${lines.join('\n')}`;
  const html = `<p>The following products have a warranty expiring within 30 days:</p><ul>${expiring
    .map((p) => `<li>${p.name} (${p.category}) — expires ${p.warrantyExpiry!.toISOString().slice(0, 10)}</li>`)
    .join('')}</ul>`;

  await sendMail({
    to,
    subject: `Gadget Tracker: ${expiring.length} warrant${expiring.length === 1 ? 'y' : 'ies'} expiring soon`,
    text,
    html,
  });

  await prisma.product.updateMany({
    where: { id: { in: expiring.map((p) => p.id) } },
    data: { warrantyNotified: true },
  });

  logger.info(`Warranty cron: notified owner about ${expiring.length} product(s).`);

  return { notified: expiring.length };
};

export default { checkAndNotifyExpiringWarranties };
