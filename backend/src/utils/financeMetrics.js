import { Invoice, Payment } from '../models/index.js';

export async function financeMetrics(now = new Date()) {
  const [paymentStats, invoiceStats] = await Promise.all([
    Payment.aggregate([
      { $match: { status: 'Paid' } },
      { $facet: {
        byMonth: [
          { $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } },
            total: { $sum: '$amount' }
          } }
        ],
        total: [{ $group: { _id: null, value: { $sum: '$amount' } } }]
      } }
    ]),
    Invoice.aggregate([
      { $facet: {
        legacyPaid: [
          { $match: { status: { $in: ['Paid', 'paid'] } } },
          { $lookup: {
            from: Payment.collection.name,
            localField: '_id',
            foreignField: 'invoiceId',
            as: 'payments'
          } },
          { $match: { payments: { $size: 0 } } },
          { $group: {
            _id: { $dateToString: {
              format: '%Y-%m',
              date: { $ifNull: ['$paidAt', { $ifNull: ['$updatedAt', '$invoiceDate'] }] }
            } },
            total: { $sum: '$amount' }
          } }
        ],
        pending: [
          { $match: { status: { $nin: ['Paid', 'paid', 'Cancelled', 'cancelled'] } } },
          { $group: {
            _id: null,
            amount: { $sum: '$amount' },
            count: { $sum: 1 }
          } }
        ],
        overdue: [
          { $match: {
            status: { $in: ['Pending', 'Outstanding', 'Overdue'] },
            dueAt: { $lt: now }
          } },
          { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } }
        ],
        count: [{ $count: 'value' }]
      } }
    ])
  ]);

  const paymentMonthRows = paymentStats[0]?.byMonth || [];
  const legacyMonthRows = invoiceStats[0]?.legacyPaid || [];
  const monthTotals = new Map();
  for (const row of [...paymentMonthRows, ...legacyMonthRows]) {
    monthTotals.set(row._id, (monthTotals.get(row._id) || 0) + row.total);
  }
  const currentMonth = now.toISOString().slice(0, 7);
  const trend = [];
  for (let offset = 11; offset >= 0; offset -= 1) {
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const key = month.toISOString().slice(0, 7);
    trend.push({
      name: month.toLocaleString('en', { month: 'short', timeZone: 'UTC' }),
      month: key,
      value: monthTotals.get(key) || 0
    });
  }
  const paymentRevenue = paymentStats[0]?.total?.[0]?.value || 0;
  const legacyRevenue = legacyMonthRows.reduce((sum, row) => sum + row.total, 0);
  const pending = invoiceStats[0]?.pending?.[0] || {};
  const overdue = invoiceStats[0]?.overdue?.[0] || {};

  return {
    totalRevenue: paymentRevenue + legacyRevenue,
    monthlyRevenue: monthTotals.get(currentMonth) || 0,
    pendingPayments: pending.amount || 0,
    pendingInvoiceCount: pending.count || 0,
    overduePayments: overdue.amount || 0,
    overdueInvoiceCount: overdue.count || 0,
    totalInvoices: invoiceStats[0]?.count?.[0]?.value || 0,
    revenueTrend: trend
  };
}
