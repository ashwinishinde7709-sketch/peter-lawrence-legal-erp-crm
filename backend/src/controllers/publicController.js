import { ContactMessage, Candidate } from '../models/index.js';
export async function submitForm(req,res,next){try{if(req.body?.email && req.body?.message) await ContactMessage.create(req.body);res.status(201).json({data:req.body});}catch(e){next(e)}}
export async function career(req,res,next){try{const item=await Candidate.create({...req.body,stage:'Applied',resumePath:req.file?`/uploads/${req.file.filename}`:''});res.status(201).json({data:item});}catch(e){next(e)}}
