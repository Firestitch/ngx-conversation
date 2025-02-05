import { Injectable, TemplateRef } from '@angular/core';

import { RequestConfig } from '@firestitch/api';
import { FsGalleryItem } from '@firestitch/gallery';

import { forkJoin, Observable, of } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';

import { Account, Conversation, ConversationConfig, ConversationItem, ConversationItemFile, ConversationParticipant } from '../types';


@Injectable()
export class ConversationService {

  public conversationSettingTemplate: TemplateRef<any>;
  public conversationHeadingTemplate: TemplateRef<any>;
  public inited = false;
  public startConversation: {
    disabled?: boolean;
    show?: boolean;
    tooltip?: string;
    beforeStart?: (conversation: Conversation) => Observable<Conversation>;
    afterStart?: (conversation: Conversation) => Observable<Conversation>;
    afterOpen?: (conversation: Conversation) => Observable<Conversation>;
  } = {
      disabled: false,
      show: true,
      tooltip: '',
    };

  public tabs: {
    account?: boolean;
    open?: boolean;
    closed?: boolean; 
  };

  public leaveConverstation: {
    show?: boolean;
  };

  public openConversation: {
    beforeOpen?: (conversation: Conversation) => Observable<Conversation>;
    afterOpen?: (conversation: Conversation) => Observable<Conversation>;
  };

  private _conversationConfig: ConversationConfig;

  public get conversationConfig(): ConversationConfig {
    return this._conversationConfig;
  }

  public set conversationConfig(conversationConfig: ConversationConfig) {
    const conversationSettings = conversationConfig.conversationSettings || {};
    if(conversationConfig.tabs === false) {
      this.tabs = {
        account: false,
        open: false,
        closed: false,
      };
    } else { 
      this.tabs = conversationConfig.tabs === undefined ? {
        account: true,
        open: true,
        closed: true,
      } : conversationConfig.tabs as any;
    } 
    
    this._conversationConfig = {
      ...conversationConfig,
      readConversation: {
        show: () => of(true),
        ...conversationConfig.readConversation, 
      },
      conversationActions: conversationConfig.conversationActions || [],
      conversationSettings: {
        ...conversationSettings,
        name: {
          show: true,
          required: false,
          ...(conversationSettings.name || {}),
        },
      },
    };
  }

  public conversationGet(conversationId: number, query?: any, config?: RequestConfig): Observable<Conversation> {
    return this.conversationConfig.conversationsGet({
      ...query,
      conversationId,
    }, config)
      .pipe(
        map((response) => (response.conversations[0])),
      );
  }

  public conversationParticipantGet(
    conversation: Conversation,
    query?: any,
    config?: RequestConfig,
  ): Observable<ConversationParticipant> {
    return this.conversationConfig.conversationParticipantsGet(conversation, {
      ...query,
    }, config)
      .pipe(
        map((response) => (response.conversationParticipants[0])),
      );
  }

  public initStartConversation(): Observable<any> {
    const leaveConversation = this.conversationConfig.leaveConversation || {};
    const leaveConversationShow = leaveConversation.show ? leaveConversation.show() : undefined;

    const startConversation = this.conversationConfig.startConversation || {};
    const openConversation = this.conversationConfig.openConversation || {};
    const startConversationShow = startConversation.show ? startConversation.show() : undefined;
    const startConversationDisabled = startConversation.disabled ? startConversation.disabled() : undefined;
    const startConversationTooltip = startConversation.tooltip ? startConversation.tooltip() : undefined;

    const configs$: {
      startConversationShow?: Observable<boolean>;
      startConversationDisabled?: Observable<boolean>;
      startConversationTooltip?: Observable<string>;
      leaveConversationShow?: Observable<boolean>;
      dummy?: Observable<boolean>;
    } = {
      startConversationShow: startConversationShow instanceof Observable ? startConversationShow : of(startConversationShow),
      startConversationDisabled: startConversationDisabled instanceof Observable ? startConversationDisabled : of(startConversationDisabled),
      startConversationTooltip: startConversationTooltip instanceof Observable ? startConversationTooltip : of(startConversationTooltip),
      leaveConversationShow: leaveConversationShow instanceof Observable ? leaveConversationShow : of(leaveConversationShow),
      dummy: of(true),
    };

    return forkJoin(configs$)
      .pipe(
        filter((config: any) => config.show ?? true),
        tap((config) => {
          this.startConversation = {
            show: config.startConversationShow ?? true,
            disabled: config.startConversationDisabled ?? false,
            tooltip: config.startConversationTooltip,
            beforeStart: startConversation.beforeStart ? startConversation.beforeStart : (conversation) => of(conversation),
            afterStart: startConversation.afterStart ? startConversation.afterStart : (conversation) => of(conversation),
            afterOpen: startConversation.afterOpen ? startConversation.afterOpen : (conversation) => of(conversation),
          };

          this.leaveConverstation = {
            show: config.leaveConversationShow,
          };

          this.openConversation = {
            beforeOpen: openConversation.beforeOpen ? openConversation.beforeOpen : (conversation) => of(conversation),
            afterOpen: openConversation.afterOpen ? openConversation.afterOpen : (conversation) => of(conversation),
          };
        }),
      )
      .pipe(
        tap(() => this.inited = true),
      );
  }

  public hasWebSocketConnection(): boolean {
    return this.conversationConfig.websocketService() && this.conversationConfig.websocketService().isConnected();
  }

  public sendMessageNotice(conversationId: number, accountId: number = null): void {
    if (this.hasWebSocketConnection()) {
      if (accountId) {
        this.sendTypingStopNotice(conversationId, accountId);
      }

      this.conversationConfig.websocketService().send(`conversation/${conversationId}/message`);
    }
  }

  public sendTypingStartNotice(conversationId: number, accountId: number) {
    if (this.hasWebSocketConnection()) {
      this.conversationConfig.websocketService().send(`conversation/${conversationId}/typing`, { isTyping: true });
    }
  }

  public sendTypingStopNotice(conversationId: number, accountId: number): void {
    if (this.hasWebSocketConnection()) {
      this.conversationConfig.websocketService().send(`conversation/${conversationId}/typing`, { isTyping: false });
    }
  }

  public mapAccount(account): Account {
    return this._conversationConfig.mapAccount ? this._conversationConfig.mapAccount(account) : account;
  }

  public mapGalleryItem(conversationItem: ConversationItem, conversationItemFile: ConversationItemFile): FsGalleryItem {
    return this._conversationConfig.mapGalleryItem ? this._conversationConfig.mapGalleryItem(conversationItem, conversationItemFile) : null;
  }

  public onUnreadNotice(accountId: number): Observable<any> {
    if (!this.conversationConfig.websocketService()) {
      return of();
    }

    return this.conversationConfig.websocketService().routeObservable(`account/${accountId}/unreadconversations`);
  }

  public onMessageNotice(conversationId: number): Observable<any> {
    if (!this.conversationConfig.websocketService()) {
      return of();
    }

    return this.conversationConfig.websocketService().routeObservable(`conversation/${conversationId}/message`);
  }

  public onTypingNotice(conversationId: number): Observable<any> {
    if (!this.conversationConfig.websocketService()) {
      return of();
    }

    return this.conversationConfig.websocketService().routeObservable(`conversation/${conversationId}/typing`);
  }

}
