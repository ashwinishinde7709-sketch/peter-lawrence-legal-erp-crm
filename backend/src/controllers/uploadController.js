import mongoose from 'mongoose';
import path from 'node:path';
import { Case, Candidate, Client, Document, caseQueryForUser } from '../models/index.js';

export async function uploadFile(req, res, next) {
  try {
    if (!['admin', 'lawyer', 'client'].includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to upload case documents' });
    }
    if (!req.file) return res.status(400).json({ message: 'File is required' });
    let caseRecord = null;
    if (req.body.caseId) {
      if (!mongoose.isValidObjectId(req.body.caseId)) return res.status(400).json({ message: 'Invalid case id' });
      const scope = await caseQueryForUser(req.user);
      caseRecord = await Case.findOne({ _id: req.body.caseId, ...(scope || {}) })
        .select('clientId lawyerId').lean();
      if (!caseRecord) return res.status(404).json({ message: 'Case not found' });
    }

    const client = req.user.role === 'client'
      ? await Client.findOne({ userId: req.user._id }).select('_id').lean()
      : null;
    if (req.user.role === 'client' && !client) {
      return res.status(409).json({ message: 'Your client profile is not configured' });
    }
    const filePath = `/api/uploads/${req.file.filename}`;
    let document;
    if (req.body.documentId) {
      if (req.user.role !== 'client' || !caseRecord) {
        return res.status(403).json({ message: 'Only the case client can fulfill a document request' });
      }
      document = await Document.findOne({
        _id: req.body.documentId,
        caseId: caseRecord._id,
        clientId: client._id,
        $or: [{ status: 'Requested' }, { reviewStatus: 'Re-upload requested' }]
      });
      if (!document) return res.status(404).json({ message: 'Open document request not found' });
      document.path = filePath;
      document.mimeType = req.file.mimetype;
      document.size = req.file.size;
      document.ownerId = req.user._id;
      document.status = 'Uploaded';
      document.reviewStatus = 'Pending';
      document.reviewNote = '';
      await document.save();
    } else {
      document = await Document.create({
        name: req.file.originalname,
        path: filePath,
        mimeType: req.file.mimetype,
        size: req.file.size,
        category: req.body.category || 'General',
        ownerId: req.user._id,
        clientId: caseRecord?.clientId || client?._id,
        lawyerId: caseRecord?.lawyerId || (req.user.role === 'lawyer' ? req.user._id : undefined),
        caseId: caseRecord?._id,
        status: 'Uploaded',
        reviewStatus: 'Pending'
      });
    }
    return res.status(201).json({
      data: { file: { id: document._id, name: document.name, path: document.path, mimeType: document.mimeType, size: document.size } }
    });
  } catch (error) {
    next(error);
  }
}

export async function downloadFile(req, res, next) {
  try {
    const filename = path.basename(req.params.filename);
    const filePaths = [`/api/uploads/${filename}`, `/uploads/${filename}`];
    const candidatePath = `/uploads/${filename}`;
    const document = await Document.findOne({ path: { $in: filePaths } }).select('clientId lawyerId').lean();
    let allowed = Boolean(document && req.user.role === 'admin');
    if (document && req.user.role === 'client') {
      const client = await Client.findOne({ userId: req.user._id }).select('_id').lean();
      allowed = Boolean(client && String(client._id) === String(document.clientId));
    }
    if (document && req.user.role === 'lawyer') {
      allowed = String(document.lawyerId) === String(req.user._id);
    }
    if (!document && ['admin', 'hr'].includes(req.user.role)) {
      allowed = Boolean(await Candidate.exists({ resumePath: candidatePath }));
    }
    if (!allowed) {
      return res.status(document ? 403 : 404).json({
        message: document ? 'You do not have access to this document' : 'File not found'
      });
    }
    const directory = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
    return res.sendFile(path.join(directory, filename), {
      headers: { 'Cache-Control': 'private, no-store' }
    }, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
}
