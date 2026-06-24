import { ConversationRole, ConversationState } from '../enums';

import { ConversationItem } from './conversation-item';
import { ConversationParticipant } from './conversation-participant';


export interface Conversation {
  id?: number;
  activityDate?: Date;
  conversationParticipants?: ConversationParticipant[];
  recentConversationParticipants?: ConversationParticipant[];
  createDate?: Date;
  creatorConversationParticipantId?: number;
  guid?: string;
  lastConversationItem?: ConversationItem;
  lastConversationItemId?: number;
  name?: string;
  title?: string;
  state?: ConversationState;
  accountConversationRoles?: ConversationRole[];
  unread?: number;
  participantsEnvironmentId?: number;
  conversationParticipantCount?: number;
  addAllParents?: boolean;
  environment?: any;
}
