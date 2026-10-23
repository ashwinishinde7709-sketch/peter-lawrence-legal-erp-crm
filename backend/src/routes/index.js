import { Router } from 'express';
import auth from './authRoutes.js';
import resources from './resourceRoutes.js';
import { allowRoles, requireAuth } from '../middleware/auth.js';
import { dashboard } from '../controllers/dashboardController.js';
import { reports } from '../controllers/reportsController.js';
import { submitForm, career } from '../controllers/publicController.js';
import { downloadFile, uploadFile } from '../controllers/uploadController.js';
import {
  approveConsultation, cancelInvoice, recordPayment, rejectPayment, reassignCaseLawyer,
  submitClientPayment, updateCaseProgress
} from '../controllers/workflowController.js';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { attendanceWorkday, billingOptions, reviewLeave, saveAttendanceWorkday } from '../controllers/peopleController.js';
import { upload } from '../middleware/upload.js';

const router = Router();
router.get('/health', (_req, res) => res.json({ ok: true, service: 'Peter Lawrence Legal ERP API' }));
router.use('/auth', auth);
router.get('/dashboard/:role', requireAuth, dashboard);
router.get('/reports', requireAuth, reports);
router.get('/settings', requireAuth, getSettings);
router.put('/settings', requireAuth, updateSettings);
router.post('/upload', requireAuth, allowRoles('admin', 'lawyer', 'client'), upload.single('file'), uploadFile);
router.get('/uploads/:filename', requireAuth, downloadFile);
router.post('/appointments/:id/approve-consultation', requireAuth, approveConsultation);
router.patch('/cases/:id/progress', requireAuth, updateCaseProgress);
router.patch('/cases/:id/lawyer', requireAuth, reassignCaseLawyer);
router.patch('/invoices/:id/cancel', requireAuth, cancelInvoice);
router.post('/invoices/:id/payments', requireAuth, recordPayment);
router.patch('/invoices/:id/payments/:paymentId/reject', requireAuth, rejectPayment);
router.post('/invoices/:id/payment-submissions', requireAuth, submitClientPayment);
router.get('/attendance/workday', requireAuth, attendanceWorkday);
router.put('/attendance/workday', requireAuth, saveAttendanceWorkday);
router.patch('/leave/:id/review', requireAuth, reviewLeave);
router.get('/billing/options', requireAuth, billingOptions);
router.post('/public/submit-form', submitForm);
router.post('/public/contact', submitForm);
router.post('/public/careers', upload.single('resume'), career);
router.use('/', resources);
export default router;
