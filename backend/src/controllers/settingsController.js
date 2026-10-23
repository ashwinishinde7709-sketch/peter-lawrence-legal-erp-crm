import { FirmSettings } from '../models/index.js';

const fields = ['firmName', 'address', 'phone', 'email', 'website', 'logoUrl', 'currency', 'timezone', 'branding'];
const currencies = ['INR', 'USD', 'GBP', 'EUR'];

function normalizedSettings(settings) {
  const row = settings.toObject();
  delete row.__v;
  return row;
}

export async function getSettings(req, res, next) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only an admin can view firm settings' });
    }
    const settings = await FirmSettings.findOneAndUpdate(
      { key: 'firm' },
      { $setOnInsert: { key: 'firm' } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.json({ data: normalizedSettings(settings) });
  } catch (error) {
    next(error);
  }
}

export async function updateSettings(req, res, next) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only an admin can update firm settings' });
    }
    const update = {};
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] !== 'string' || req.body[field].length > 2000) {
          return res.status(400).json({ message: `${field} must be text of at most 2000 characters` });
        }
        update[field] = req.body[field].trim();
      }
    }
    if (!Object.keys(update).length) {
      return res.status(400).json({ message: 'Provide at least one setting to update' });
    }
    if (update.currency && !currencies.includes(update.currency)) {
      return res.status(400).json({ message: 'Currency must be INR, USD, GBP or EUR' });
    }
    if (update.timezone) {
      try {
        new Intl.DateTimeFormat('en', { timeZone: update.timezone });
      } catch {
        return res.status(400).json({ message: 'Timezone must be a valid IANA timezone' });
      }
    }
    const settings = await FirmSettings.findOneAndUpdate(
      { key: 'firm' },
      { $set: update, $setOnInsert: { key: 'firm' } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.json({ data: normalizedSettings(settings), message: 'Firm settings saved successfully' });
  } catch (error) {
    next(error);
  }
}
