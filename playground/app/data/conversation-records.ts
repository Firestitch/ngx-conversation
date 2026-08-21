import {
  ConversationItemState, ConversationItemType,
  ConversationParticipantType, ConversationState,
} from 'src/app/enums';


/**
 * The shapes below are the simulated database tables. They are deliberately flat and
 * normalized — the store denormalizes them into API responses the same way a backend
 * would, so nothing about the seed data is tailored to a particular component.
 */
export interface ConversationRecord {
  id: number;
  state: ConversationState;
  name: string;
  guid: string;
  createDate: string;
  activityDate: string;
  creatorConversationParticipantId: number;
}

export interface ConversationParticipantRecord {
  id: number;
  conversationId: number;
  accountId: number;
  state: 'active' | 'deleted';
  type: ConversationParticipantType;
  admin: boolean;
  createDate: string;
  activityDate: string;
  readConversationItemId: number;
  guid: string;
}

export interface ConversationItemFileRecord {
  id: number;
  conversationItemId: number;
  fileId: number;
  file: {
    id: number;
    filename: string;
    extension: string;
    size: number;
    preview: { small: string; large: string };
  };
}

export interface ConversationItemRecord {
  id: number;
  conversationId: number;
  conversationParticipantId: number;
  type: ConversationItemType;
  state: ConversationItemState;
  message: string;
  createDate: string;
  guid: string;
  conversationItemFiles: ConversationItemFileRecord[];
  /** Accounts referenced by participantAdded/participantRemoved items */
  addRemoveAccountIds: number[];
}
