import { Injectable } from '@angular/core';

import { FsApi } from '@firestitch/api';
import { FsWebSocket } from '@firestitch/web-socket';
import { Observable, of } from 'rxjs';

import { map } from 'rxjs/operators';

import { ConversationConfig, Conversation, ConversationItem,
  ConversationItemMessage, ConversationParticipant } from 'src/app/types';


@Injectable({
  providedIn: 'root'
})
export class ConversationsApiService {

  private _url = 'https://tuiopay.local.firestitch.com/api/';

  public constructor(
    private _api: FsApi,
    private _websocketService: FsWebSocket,
  ) {
  }

  public save(url, data) {
    return data.id ? this._api.put(`${this._url}${url}/${data.id}`, data) : this._api.post(`${this._url}${url}`, data);
  }

  public delete(url, data) {
    return this._api.delete(`${this._url}${url}/${data.id}`, {});
  }

  public get(url, data = {}) {
    return this._api.get(`${this._url}${url}`, data);
  }

  public post(url, data) {
    return this._api.post(`${this._url}${url}`, data);
  }

  public conversationConfig: ConversationConfig = {
    conversationsGet: (query?: any) => {
      return this._api.get(`${this._url}conversations`, query);
    },
    conversationsStats: (query?: any) => {
      return this._api.get(`${this._url}conversations/stats`, query);
    },
    conversationSave: (conversation: Conversation) => {
      const data: any = conversation;
      if(!data.environmentId) {
        data.environmentId = 12;
      }
      
      return this.save('conversations', data)
        .pipe(
          map((response) => response.conversation),
        );
    },
    conversationDelete: (conversation: Conversation) => {
      return this.delete('conversations', conversation);
    },
    conversationRead: (conversation: Conversation, conversationItem: ConversationItem) => {
      return this.post(`conversations/${conversation.id}/read`, { conversationItemId: conversationItem.id });
    },
    conversationItemsGet: (conversation: Conversation, query?: any) => {
      return this.get(`conversations/${conversation.id}/items`, query);
    },
    conversationItemSave: (conversationItem: ConversationItem | ConversationItemMessage) => {
      return this.save(`conversations/${conversationItem.conversationId}/items`, conversationItem)
        .pipe(
          map((response) => response.conversationItem),
        );
    },
    conversationItemDelete: (conversationItem: ConversationItem | ConversationItemMessage) => {
      return this.delete(`conversations/${conversationItem.conversationId}/items`, conversationItem)
        .pipe(
          map((response) => response.conversationItem),
        );
    },
    conversationItemFilePost: (conversationItem: ConversationItem, file: Blob) => {
      return this.post(`conversations/${conversationItem.conversationId}/items/${conversationItem.id}/files`, { file });
    },
    conversationItemFileDownload: (conversationItem: ConversationItem, conversationItemFileId: number) => {
      console.log(`conversations/${conversationItem.conversationId}/items/${conversationItem.id}/files/${conversationItemFileId}/download`);
    },
    conversationParticipantsGet: (conversation: Conversation, query?: any) => {
      return this.get(`conversations/${conversation.id}/participants`, query);
    },
    conversationParticipantAdd: (conversation: Conversation, data) => {
      return this.post(`conversations/${conversation.id}/participants`, data);
    },
    conversationParticipantSave: (conversation: Conversation, conversationParticipant: ConversationParticipant) => {
      return this.save(`conversations/${conversation.id}/participants`, conversationParticipant)
        .pipe(
          map((response) => response.conversationParticipant),
        );
    },
    conversationParticipantSession: (conversation: Conversation) => {
      return this.get(`conversations/${conversation.id}/participants/session`)
        .pipe(
          map((response) => response.conversationParticipant),
        );
    },
    conversationParticipantDelete: (conversation: Conversation, conversationParticipant: ConversationParticipant) => {
      return this.delete(`conversations/${conversation.id}/participants`, conversationParticipant);
    },
    conversationParticipantBulk: (conversation: Conversation, data: any) => {
      return this.post(`conversations/${conversation.id}/participants/bulk`, data);
    },
    accountsGet: (conversation: Conversation, query?: any) => {
      return this.get('accounts', query);
    },
    websocketService: () => {
      return this._websocketService;
    },

    leaveConversation: {
      show: () => true,
    },
    
    startConversation: {
      show: () => {
        return of(true);
      },
      disabled: () => {
        return of(true);
      },
      tooltip: () => {
        return of('This is a tooltip');
      }
    }
  }

}
