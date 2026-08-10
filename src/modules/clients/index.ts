export { Clients } from './collection';
export {
  CLIENT_NUMBER_UNIQUE_INDEX,
  createWithClientNumberCollisionRetry,
  generateClientNumber,
  isClientNumberCollision,
} from './client-number-service';
export { normalizeContactEmail } from './contact-email';
