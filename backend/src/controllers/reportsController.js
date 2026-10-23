import { Case, Candidate, User } from '../models/index.js';
import { financeMetrics } from '../utils/financeMetrics.js';

export async function reports(req, res, next) {
  try {
    if (!['admin', 'accountant'].includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to view firm reports' });
    }
    const [caseAgg, candidateAgg, lawyers, finance] = await Promise.all([
      Case.aggregate([{ $group: { _id: '$status', value: { $sum: 1 } } }]),
      Candidate.aggregate([{ $group: { _id: '$stage', value: { $sum: 1 } } }]),
      User.find({ role: 'lawyer', active: true }).select('name').lean(),
      financeMetrics()
    ]);
    return res.json({
      ...finance,
      caseStatus: caseAgg.map((item) => ({ name: item._id || 'Unknown', value: item.value })),
      lawyerPerformance: lawyers.map((lawyer) => ({ name: lawyer.name.split(' ')[0], value: 0 })),
      recruitment: candidateAgg.map((item) => ({ name: item._id || 'Applied', value: item.value }))
    });
  } catch (error) {
    next(error);
  }
}
