import { Injectable, TemplateRef } from '@angular/core';
import { RequestConfig } from '@firestitch/api';

import { EMPTY, forkJoin, Observable, of } from 'rxjs';
import { filter, map, switchMap, tap } from 'rxjs/operators';

import { ConversationConfig, Conversation, ConversationParticipant } from '../types';


@Injectable()
export class ConversationService {

  public conversationSettingTemplate: TemplateRef<any>;
  public conversationHeadingTemplate: TemplateRef<any>;
  public startConversation = {
    disabled: false,
    show: true,
    tooltip: '',
  };

  public leaveConverstation: {
    show?: boolean,
  };

  private _conversationConfig: ConversationConfig;

  public get conversationConfig(): ConversationConfig {
    return this._conversationConfig;
  }

  public set conversationConfig(conversationConfig: ConversationConfig) {
    this._conversationConfig = {
      ...conversationConfig,
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
    config?: RequestConfig
  ): Observable<ConversationParticipant> {
    return this.conversationConfig.conversationParticipantsGet(conversation, {
      ...query,
    }, config)
      .pipe(
        map((response) => (response.conversationParticipants[0])),
      );
  }

  public initStartConversation(): Observable<any> {
    const startConversation = this.conversationConfig.startConversation || {};
    const leaveConversation = this.conversationConfig.leaveConversation || {};
    const startConversationShow = startConversation.show ? startConversation.show() : undefined;
    const startConversationDisabled = startConversation.disabled ? startConversation.disabled() : undefined;
    const startConversationTooltip = startConversation.tooltip ? startConversation.tooltip() : undefined;
    const leaveConversationShow = leaveConversation.show ? leaveConversation.show() : undefined;

    const configs$: { 
      startConversationShow?: Observable<boolean>,
      startConversationDisabled?: Observable<boolean>,
      startConversationTooltip?: Observable<string>,
      leaveConversationShow?: Observable<boolean>,
      dummy?: Observable<boolean>,
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
          };
          this.leaveConverstation = {
            show: config.leaveConversationShow,
          }
        }), 
      );
  }

  public hasWebSocketConnection(): boolean {
    return this.conversationConfig.websocketService() && this.conversationConfig.websocketService().isConnected();
  }

  public sendMessageNotice(conversationId: number, accountId: number): void {
    if (this.hasWebSocketConnection()) {
      this.sendTypingStopNotice(conversationId, accountId);
      this.conversationConfig.websocketService().send(`conversation/${conversationId}/message`);
    }
  }

  public sendTypingStartNotice(conversationId: number, accountId: number) {
    if (this.hasWebSocketConnection()) {
      this.conversationConfig.websocketService().send(`conversation/${conversationId}/typing`, {isTyping: true})
    }
  }

  public sendTypingStopNotice(conversationId: number, accountId: number): void {
    if (this.hasWebSocketConnection()) {
      this.conversationConfig.websocketService().send(`conversation/${conversationId}/typing`, {isTyping: false})
    }
  }


  public onUnreadNotice(accountId: number): Observable<any> {
    if (this.conversationConfig.websocketService()) {
      return this.conversationConfig.websocketService().routeObservable(`account/${accountId}/unreadconversations`);
    } else {
      return EMPTY;
    }
  }

  public onMessageNotice(conversationId: number): Observable<any> {
    if (this.conversationConfig.websocketService()) {
      return this.conversationConfig.websocketService().routeObservable(`conversation/${conversationId}/message`);
    } else {
      return EMPTY;
    }
  }

  public onTypingNotice(conversationId: number): Observable<any> {
    if (this.conversationConfig.websocketService()) {
      return this.conversationConfig.websocketService().routeObservable(`conversation/${conversationId}/typing`);
    } else {
      return EMPTY;
    }
  }

}
