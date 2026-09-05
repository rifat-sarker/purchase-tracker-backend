import config from '../config';
import { CloudinaryStorageAdapter } from './cloudinary.storage';
import { LocalStorageAdapter } from './local.storage';
import { StorageAdapter } from './storage.interface';

// Swapping local disk (dev) for Cloudinary (prod) is a one-line change:
// whichever adapter is active is entirely determined by whether
// CLOUDINARY_* env vars were supplied.
const storageAdapter: StorageAdapter = config.cloudinary.isConfigured
  ? new CloudinaryStorageAdapter()
  : new LocalStorageAdapter();

export default storageAdapter;
