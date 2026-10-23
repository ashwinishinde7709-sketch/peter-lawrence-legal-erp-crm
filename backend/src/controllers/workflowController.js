import mongoose from 'mongoose';
import { Appointment, Case, Client, Invoice, Payment, Receipt, User, caseQueryForUser } from '../models/index.js';

const isId = (value) => mongoose.isValidObjectId(value);
const paymentMethods = ['Cash', 'UPI', 'Card', 'Bank Transfer'];

async function issueReceipt(invoice, payment) {
  const receiptNumber = `RC-${new Date().getUTCFullYear()}-${String(payment._id).slice(-8).toUpperCase()}`;
  return Receipt.findOneAndUpdate(
    { paymentId: payment._id },
    {
      $setOnInsert: {
        number: receiptNumber,
        paymentId: payment._id,
        invoiceId: invoice._id,
        clientId: invoice.clientId,
        caseId: invoice.caseId,
        amount: payment.amount,
        method: payment.method,
        paidAt: payment.paidAt,
        status: 'Paid'
      }
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
}

export async function approveConsultation(req, res, next) {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: 'Invalid appointment id' });
    if (req.user.role !== 'admin' && req.user.role !== 'lawyer') {
      return res.status(403).json({ message: 'You do not have permission to approve consultations' });
    }
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
    if (req.user.role === 'lawyer' && String(appointment.lawyerId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You can only review your assigned appointments' });
    }
    if (appointment.status !== 'Completed') {
      return res.status(409).json({ message: 'Complete the consultation before approving it' });
    }
    if (!appointment.clientId || !appointment.lawyerId) {
      return res.status(400).json({ message: 'The appointment must have an assigned client and lawyer' });
    }

    const client = await Client.findById(appointment.clientId).select('_id');
    if (!client) return res.status(400).json({ message: 'The appointment client no longer exists' });
    const fee = req.body.fee === undefined ? 0 : Number(req.body.fee);
    if (!Number.isFinite(fee) || fee < 0) return res.status(400).json({ message: 'Case fee must be a non-negative number' });
    const title = String(req.body.title || appointment.title || 'New legal matter').trim();
    if (!title) return res.status(400).json({ message: 'Case title is required' });
    let caseRecord;
    try {
      caseRecord = await Case.findOneAndUpdate(
        { appointmentId: appointment._id },
        {
          $setOnInsert: {
            title,
            type: req.body.type || appointment.type || 'Consultation',
            description: req.body.description || appointment.consultationNotes || '',
            priority: req.body.priority || 'Medium',
            fee,
            status: 'Active',
            consultationApproved: true,
            appointmentId: appointment._id,
            clientId: appointment.clientId,
            lawyerId: appointment.lawyerId
          }
        },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      caseRecord = await Case.findOne({ appointmentId: appointment._id });
      if (!caseRecord) throw error;
    }
    let repaired = false;
    if (!caseRecord.clientId) {
      caseRecord.clientId = appointment.clientId;
      repaired = true;
    }
    if (!caseRecord.lawyerId) {
      caseRecord.lawyerId = appointment.lawyerId;
      repaired = true;
    }
    if (repaired) await caseRecord.save();
    appointment.consultationApproved = true;
    appointment.caseId = caseRecord._id;
    await appointment.save();
    res.status(201).json({ data: caseRecord });
  } catch (error) {
    next(error);
  }
}

export async function updateCaseProgress(req, res, next) {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ message: 'Invalid case id' });
    const progress = Number(req.body.progress);
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      return res.status(400).json({ message: 'Progress must be a number between 0 and 100' });
    }
    const scope = await caseQueryForUser(req.user);
    if (req.user.role !== 'admin' && req.user.role !== 'lawyer') {
      return res.status(403).json({ message: 'You do not have permission to update case progress' });
    }
    const caseRecord = await Case.findOne({ _id: req.params.id, ...(scope || {}) });
    if (!caseRecord) return res.status(404).json({ message: 'Case not found' });
    if (req.user.role === 'lawyer' && String(caseRecord.lawyerId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You can only update your assigned cases' });
    }
    if (!caseRecord.consultationApproved || !caseRecord.appointmentId) {
      return res.status(409).json({ message: 'A case can only progress after an approved consultation' });
    }
    if (caseRecord.status === 'Completed' && progress < 100) {
      return res.status(409).json({ message: 'Completed cases cannot be reopened through progress updates' });
    }

    caseRecord.progress = progress;
    if (progress === 100) caseRecord.status = 'Completed';
    await caseRecord.save();

    res.json({ data: { case: caseRecord, invoice: null } });
  } catch (error) {
    next(error);
  }
}

export async function reassignCaseLawyer(req, res, next) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only an admin can reassign a case' });
    }
    if (!isId(req.params.id) || !isId(req.body.lawyerId)) {
      return res.status(400).json({ message: 'A valid case and lawyer are required' });
    }
    const lawyer = await User.findOne({ _id: req.body.lawyerId, role: 'lawyer', active: { $ne: false } })
      .select('_id').lean();
    if (!lawyer) return res.status(400).json({ message: 'Select an active lawyer' });

    const caseRecord = await Case.findByIdAndUpdate(
      req.params.id,
      { $set: { lawyerId: lawyer._id } },
      { new: true, runValidators: true }
    ).populate('clientId', 'name email').populate('lawyerId', 'name email');
    if (!caseRecord) return res.status(404).json({ message: 'Case not found' });
    await Invoice.updateMany({ caseId: caseRecord._id, status: { $ne: 'Paid' } }, { $set: { lawyerId: lawyer._id } });
    return res.json({ data: caseRecord });
  } catch (error) {
    next(error);
  }
}

export async function submitClientPayment(req, res, next) {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ message: 'Only a client can submit payment details' });
    }
    if (!isId(req.params.id)) return res.status(400).json({ message: 'Invalid invoice id' });
    const method = String(req.body.method || '');
    if (!paymentMethods.includes(method)) return res.status(400).json({ message: 'Select a supported payment method' });
    const paidAt = req.body.paidAt ? new Date(req.body.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) return res.status(400).json({ message: 'Payment date is invalid' });

    const client = await Client.findOne({ userId: req.user._id }).select('_id').lean();
    if (!client) return res.status(409).json({ message: 'Your client profile is not configured' });
    const invoice = await Invoice.findOne({ _id: req.params.id, clientId: client._id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (['paid', 'cancelled'].includes(String(invoice.status).toLowerCase())) {
      return res.status(409).json({ message: 'This invoice is not available for payment' });
    }
    if (!Number.isFinite(invoice.amount) || invoice.amount <= 0) {
      return res.status(409).json({ message: 'The invoice must have a positive amount before payment' });
    }
    if (!invoice.caseId || !await Case.exists({ _id: invoice.caseId, status: 'Completed', progress: 100 })) {
      return res.status(409).json({ message: 'The invoice case must be completed before payment' });
    }
    const paymentData = {
      invoiceId: invoice._id,
      clientId: client._id,
      caseId: invoice.caseId,
      recordedBy: req.user._id,
      amount: invoice.amount,
      method,
      reference: String(req.body.reference || '').trim().slice(0, 200) || undefined,
      transactionReference: String(req.body.reference || '').trim().slice(0, 200) || undefined,
      status: 'Pending',
      paidAt
    };
    const existingPayment = await Payment.findOne({ invoiceId: invoice._id });
    let payment;
    if (existingPayment) {
      if (existingPayment.status !== 'Failed') {
        return res.status(409).json({ message: 'Payment details have already been submitted for this invoice' });
      }
      payment = await Payment.findOneAndUpdate(
        { _id: existingPayment._id, status: 'Failed' },
        { $set: paymentData },
        { new: true, runValidators: true }
      );
      if (!payment) return res.status(409).json({ message: 'Payment details changed; refresh and try again' });
    } else {
      payment = await Payment.create(paymentData);
    }
    return res.status(201).json({ data: payment, message: 'Payment details submitted for confirmation' });
  } catch (error) {
    next(error);
  }
}

export async function recordPayment(req, res, next) {
  try {
    if (req.user.role !== 'accountant' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only an accountant or admin can record payments' });
    }
    if (!isId(req.params.id)) return res.status(400).json({ message: 'Invalid invoice id' });
    const { method, reference, transactionReference, paidAt } = req.body;
    const paymentMethod = String(method || '').trim();
    if (!paymentMethods.includes(paymentMethod)) return res.status(400).json({ message: 'Select a supported payment method' });
    const paymentDate = paidAt ? new Date(paidAt) : new Date();
    if (Number.isNaN(paymentDate.getTime())) return res.status(400).json({ message: 'Payment date is invalid' });

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (String(invoice.status).toLowerCase() === 'cancelled') return res.status(409).json({ message: 'Cancelled invoices cannot be paid' });
    if (!Number.isFinite(invoice.amount) || invoice.amount <= 0) {
      return res.status(409).json({ message: 'The invoice must have a positive amount before payment' });
    }
    if (!invoice.caseId) return res.status(409).json({ message: 'An invoice must be linked to a case before payment' });
    const completedCase = await Case.exists({ _id: invoice.caseId, status: 'Completed', progress: 100 });
    if (!completedCase) return res.status(409).json({ message: 'The invoice case must be completed before payment' });

    const existingPayment = await Payment.findOne({ invoiceId: invoice._id });
    if (existingPayment?.status === 'Paid') {
      const [receipt, updatedInvoice] = await Promise.all([
        issueReceipt(invoice, existingPayment),
        Invoice.findOneAndUpdate(
          { _id: invoice._id, status: { $ne: 'Paid' } },
          { $set: { status: 'Paid', paidAt: existingPayment.paidAt } },
          { new: true, runValidators: true }
        )
      ]);
      return res.json({ data: { payment: existingPayment, receipt, invoice: updatedInvoice || invoice } });
    }
    if (String(invoice.status).toLowerCase() === 'paid') {
      return res.status(409).json({ message: 'This invoice has already been paid' });
    }

    const paymentData = {
      clientId: invoice.clientId,
      caseId: invoice.caseId,
      recordedBy: req.user._id,
      amount: invoice.amount,
      method: paymentMethod,
      reference: reference ? String(reference).trim().slice(0, 200) : undefined,
      transactionReference: transactionReference ? String(transactionReference).trim().slice(0, 200) : undefined,
      paidAt: paymentDate,
      status: 'Paid'
    };
    let payment;
    try {
      payment = await Payment.findOneAndUpdate(
        { invoiceId: invoice._id },
        { $set: paymentData, $setOnInsert: { invoiceId: invoice._id } },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      payment = await Payment.findOne({ invoiceId: invoice._id });
      if (!payment) throw error;
    }

    const receipt = await issueReceipt(invoice, payment);
    const updatedInvoice = await Invoice.findOneAndUpdate(
      { _id: invoice._id, status: { $ne: 'Paid' } },
      { $set: { status: 'Paid', paidAt: payment.paidAt } },
      { new: true, runValidators: true }
    ) || await Invoice.findById(invoice._id);
    return res.status(201).json({ data: { payment, receipt, invoice: updatedInvoice } });
  } catch (error) {
    next(error);
  }
}

export async function cancelInvoice(req, res, next) {
  try {
    if (!['admin', 'accountant'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only an admin or accountant can cancel an invoice' });
    }
    if (!isId(req.params.id)) return res.status(400).json({ message: 'Invalid invoice id' });
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    const payment = await Payment.findOne({ invoiceId: invoice._id });
    if (String(invoice.status).toLowerCase() === 'paid' || payment?.status === 'Paid') {
      return res.status(409).json({ message: 'A paid invoice cannot be cancelled' });
    }
    if (payment?.status === 'Pending') return res.status(409).json({ message: 'Resolve the submitted payment before cancelling this invoice' });
    invoice.status = 'Cancelled';
    await invoice.save();
    return res.json({ data: invoice });
  } catch (error) {
    next(error);
  }
}

export async function rejectPayment(req, res, next) {
  try {
    if (!['admin', 'accountant'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only an admin or accountant can reject payment details' });
    }
    if (!isId(req.params.id) || !isId(req.params.paymentId)) {
      return res.status(400).json({ message: 'Invalid invoice or payment id' });
    }
    const payment = await Payment.findOneAndUpdate(
      { _id: req.params.paymentId, invoiceId: req.params.id, status: 'Pending' },
      { $set: { status: 'Failed' } },
      { new: true, runValidators: true }
    );
    if (!payment) {
      if (!await Payment.exists({ _id: req.params.paymentId, invoiceId: req.params.id })) {
        return res.status(404).json({ message: 'Payment submission not found' });
      }
      return res.status(409).json({ message: 'Only a pending payment submission can be rejected' });
    }
    return res.json({ data: payment, message: 'Payment submission rejected; the client may submit updated details' });
  } catch (error) {
    next(error);
  }
}
