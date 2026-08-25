import { FsGalleryConfig } from '@firestitch/gallery';

import { ConversationItem } from './conversation-item';


/**
 * A message as the thread holds it: the row the API returned plus the two
 * things only the thread can decide — whether this reader may delete it, and
 * the gallery its attachments render through.
 */
export interface ConversationThreadItem extends ConversationItem {
  canDelete?: boolean;
  galleryConfig?: FsGalleryConfig;
}
