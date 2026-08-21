import { Injectable, inject } from '@angular/core';

import { ItemType } from '@firestitch/filter';
import { FsGalleryItem } from '@firestitch/gallery';

import { of } from 'rxjs';

import {
  Conversation,
  ConversationConfig,
  ConversationItem,
  ConversationItemMessage,
  ConversationParticipant,
} from 'src/app/types';

import { ConversationStoreService } from './conversation-store.service';


/**
 * A `ConversationConfig` backed entirely by the in-memory store — no HTTP, no server.
 * Every entry is a plain function returning an Observable, so the conversation
 * components cannot tell it apart from the API-backed config.
 */
@Injectable({
  providedIn: 'root',
})
export class ConversationsStaticService {

  private _store = inject(ConversationStoreService);

  public conversationConfig: ConversationConfig = {
    conversationsGet: (query?: any) => {
      return this._store.conversationsGet(query);
    },
    conversationsStats: (query?: any) => {
      return this._store.conversationsStats(query);
    },
    conversationSave: (conversation: Conversation) => {
      return this._store.conversationSave(conversation);
    },
    conversationDelete: (conversation: Conversation) => {
      return this._store.conversationDelete(conversation);
    },
    conversationRead: (conversation: Conversation, conversationItem: ConversationItem) => {
      return this._store.conversationRead(conversation, conversationItem);
    },
    conversationItemsGet: (conversation: Conversation, query?: any) => {
      return this._store.conversationItemsGet(conversation, query);
    },
    conversationItemSave: (conversationItem: ConversationItem | ConversationItemMessage) => {
      return this._store.conversationItemSave(conversationItem);
    },
    conversationItemDelete: (conversationItem: ConversationItem | ConversationItemMessage) => {
      return this._store.conversationItemDelete(conversationItem);
    },
    conversationItemFilePost: (conversationItem: ConversationItem, file: Blob) => {
      return this._store.conversationItemFilePost(conversationItem, file);
    },
    conversationItemFileDownload: (conversationItem: ConversationItem, fileId: number) => {
      this._store.conversationItemFileDownload(conversationItem, fileId);
    },
    conversationParticipantsGet: (conversation: Conversation, query?: any) => {
      return this._store.conversationParticipantsGet(conversation, query);
    },
    conversationParticipantSave: (
      conversation: Conversation,
      conversationParticipant: ConversationParticipant,
    ) => {
      return this._store.conversationParticipantSave(conversation, conversationParticipant);
    },
    conversationParticipantAdd: (conversation: Conversation, data: any) => {
      return this._store.conversationParticipantAdd(conversation, data);
    },
    conversationParticipantSession: (conversation: Conversation) => {
      return this._store.conversationParticipantSession(conversation);
    },
    conversationParticipantDelete: (
      conversation: Conversation,
      conversationParticipant: ConversationParticipant,
    ) => {
      return this._store.conversationParticipantDelete(conversation, conversationParticipant);
    },
    conversationParticipantBulk: (conversation: Conversation, data: any) => {
      return this._store.conversationParticipantBulk(conversation, data);
    },
    accountsGet: (conversation: Conversation, query?: any) => {
      return this._store.accountsGet(conversation, query);
    },

    mapGalleryItem: (conversationItem, conversationItemFile): FsGalleryItem => {
      return {
        name: conversationItemFile.file.filename,
        preview: conversationItemFile.file.preview?.small,
        url: conversationItemFile.file.preview?.large,
        index: conversationItemFile.id,
        data: conversationItemFile,
        extension: conversationItemFile.file.extension,
        guid: String(conversationItemFile.id),
      };
    },

    leaveConversation: {
      show: () => true,
    },

    readConversation: {
      show: () => of(true),
    },

    startConversation: {
      show: () => of(true),
      disabled: () => of(false),
      tooltip: () => of('Start a new conversation'),
    },

    conversationsFilters: [
      {
        type: ItemType.Checkbox,
        label: 'Checkbox',
        name: 'checkbox',
      },
    ],

    conversationActions: [
      {
        label: 'Flag Conversation',
        click: (conversation: Conversation & { flag?: boolean }) => {
          conversation.flag = !conversation.flag;

          return of(conversation);
        },
        show: () => true,
      },
    ],
  };

}
