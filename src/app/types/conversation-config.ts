import { RequestConfig } from '@firestitch/api';
import { IFilterConfigItem } from '@firestitch/filter';
import { FsGalleryItem } from '@firestitch/gallery';

import { Observable } from 'rxjs';

import { Account, Conversation, ConversationItem, ConversationItemFile, ConversationItemMessage, ConversationParticipant } from '../types';


export interface ConversationConfig {
  conversationsGet: (query?: any, config?: RequestConfig) => Observable<{ conversations: Conversation[]; paging?: any }>;
  conversationsStats: (query?: any, config?: RequestConfig) => Observable<any>;

  conversationSave: (conversation: Conversation, config?: RequestConfig) => Observable<Conversation>;
  conversationDelete: (conversation: Conversation, config?: RequestConfig) => Observable<Conversation>;
  conversationRead: (conversation: Conversation, conversationItem: ConversationItem, config?: RequestConfig) => Observable<Conversation>;

  conversationItemsGet: (conversation: Conversation, query?: any, config?: RequestConfig) => Observable<{ conversationItems: ConversationItem[]; paging?: any }>;

  conversationItemSave: (conversationItem: ConversationItem | ConversationItemMessage, config?: RequestConfig) => Observable<ConversationItem>;
  conversationItemDelete: (conversationItem: ConversationItem | ConversationItemMessage, config?: RequestConfig) => Observable<ConversationItem>;
  conversationItemFilePost: (conversationItem: ConversationItem, file: Blob, config?: RequestConfig) => Observable<any>;
  conversationItemFileDownload: (conversationItem: ConversationItem | ConversationItemMessage, fileId: number, config?: RequestConfig) => void;

  conversationParticipantsGet: (conversation: Conversation, query?: any, config?: RequestConfig) => Observable<{ conversationParticipants: ConversationParticipant[]; paging?: any }>;
  conversationParticipantSave: (conversation: Conversation, conversationParticipant: ConversationParticipant, config?: RequestConfig) => Observable<ConversationParticipant>;
  conversationParticipantAdd: (conversation: Conversation, data: any, config?: RequestConfig) => Observable<any>;
  conversationParticipantSession: (conversation: Conversation, config?: RequestConfig) => Observable<ConversationParticipant>;
  conversationParticipantDelete: (conversation: Conversation, conversationParticipant: ConversationParticipant, config?: RequestConfig) => Observable<ConversationParticipant>;
  conversationParticipantBulk: (conversation: Conversation, data: any, config?: RequestConfig) => Observable<any>;

  accountsGet: (conversation: Conversation, query: any, config?: RequestConfig) => Observable<{ accounts: Account[]; paging?: any }>;

  mapAccount?: (account) => Account;
  mapGalleryItem?: (conversationItem: ConversationItem, conversationItemFile: ConversationItemFile) => FsGalleryItem;
  converstationsReloadInterval?: number;

  leaveConversation?: {
    show?: () => Observable<boolean> | boolean;
  };
  
  readConversation?: {
    show?: () => Observable<boolean>;
  };

  openConversation?: {
    afterOpen?: (conversation: Conversation) => Observable<Conversation>;
    beforeOpen?: (conversation: Conversation) => Observable<Conversation>;
  };

  startConversation?: {
    disabled?: () => Observable<boolean> | boolean;
    tooltip?: () => Observable<string> | string;
    show?: () => Observable<boolean> | boolean;
    afterStart?: (conversation: Conversation) => Observable<Conversation>;
    beforeStart?: (conversation: Conversation) => Observable<Conversation>;
    afterOpen?: (conversation: Conversation) => Observable<Conversation>;
  };

  conversationActions?: ConversationAction[];
  conversationsFilters?: IFilterConfigItem[];
  conversationSettings?: {
    name?: {
      required?: boolean;
      show?: boolean;
    }
  };

  tabs?: {
    account?: boolean;
    open?: boolean;
    closed?: boolean; 
  } | boolean
}

export interface ConversationAction {
  label?: string;
  click?: (conversation: Conversation) => Observable<Conversation>;
  show?: (conversation: Conversation) => boolean;
}
