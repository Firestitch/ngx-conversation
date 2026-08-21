import { Injectable, TemplateRef, inject } from '@angular/core';

import { RequestConfig } from '@firestitch/api';
import { FsGalleryItem } from '@firestitch/gallery';

import { FsWebSocket, FsWebSocketTopic } from '@firestitch/web-socket';

import { forkJoin, Observable, of } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';

import {
  ACCOUNT_CONVERSATIONS_EVENT, CONVERSATION_EVENT_ITEM, CONVERSATION_EVENT_TYPING,
  accountConversationsTopic, conversationTopic,
} from '../consts';
import { Account, Conversation, ConversationConfig, ConversationItem, ConversationItemFile, ConversationParticipant, ConversationTypingNotice } from '../types';


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

  /**
   * How often a keystroke is allowed to announce typing, and how long without
   * one before it is withdrawn. The pair is what turns a keypress stream into
   * roughly one frame every few seconds.
   */
  private static readonly _typingThrottleMs = 3000;

  private static readonly _typingIdleMs = 5000;

  /**
   * The socket this module talks to, taken from DI rather than handed in
   * through the config — the same relationship the backend's conversation
   * module has with its WebSocket layer. An application that needs different
   * behaviour, a test, or a demo with no server provides its own FsWebSocket.
   */
  private _webSocket = inject(FsWebSocket);

  /** The conversation typing was last announced in, and when. */
  private _typing: { conversationId: number; sentAt: number } = null;

  private _typingIdleTimeout;

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

  /**
   * Whether live updates are arriving, from the moment it is subscribed to.
   *
   * Screens watch this to choose between being pushed and polling themselves,
   * so it must be false on a build with no socket rather than never emitting —
   * a screen waiting on a stream that stays silent never starts its timer.
   */
  public get connected$(): Observable<boolean> {
    return this._webSocket.connected$;
  }

  /**
   * New, edited and deleted messages in one conversation. Carries no message:
   * the thread re-reads through the endpoint that decides what this reader is
   * allowed to see, so a signal is all that can safely be on the wire.
   */
  public watchConversationItems(conversationId: number): Observable<unknown> {
    return this._getConversationTopic(conversationId)
      .on(CONVERSATION_EVENT_ITEM);
  }

  /**
   * Anything that changes what this account's conversation list shows — a
   * message, a conversation closing, a participant added or removed.
   */
  public watchAccountConversations(accountId: number): Observable<unknown> {
    return this._webSocket
      .topic(accountConversationsTopic(accountId))
      .on(ACCOUNT_CONVERSATIONS_EVENT);
  }

  /**
   * Who is typing in this conversation. The only stream here that carries
   * content rather than a signal, because "somebody is typing" is worthless
   * without a name and worthless a second later — there is nothing to re-read.
   *
   * The server stamps the account from the session, so the name is the sender's
   * whatever their browser claimed. It is delivered to every subscriber
   * including the sender, so consumers drop their own account.
   */
  public watchTyping(conversationId: number): Observable<ConversationTypingNotice> {
    return this._getConversationTopic(conversationId)
      .on<ConversationTypingNotice>(CONVERSATION_EVENT_TYPING);
  }

  /**
   * Say that this account started or stopped typing. Carries the flag only —
   * the server will not take our word for who we are.
   *
   * Callers must send the `false` themselves once the message goes, and on any
   * idle timeout they keep: nothing else ever clears it, and an indicator that
   * sticks on is worse than none at all.
   */
  public typingStart(conversationId: number): void {
    const now = Date.now();
    const typing = this._typing;

    // Called on every keystroke, so the throttle is the whole point: without it
    // this is one socket frame per character, and the server's own publish cap
    // would start dropping them partway through a sentence.
    if (!typing || typing.conversationId !== conversationId
      || now - typing.sentAt >= ConversationService._typingThrottleMs) {
      this._typing = { conversationId, sentAt: now };
      this._sendTyping(conversationId, true);
    }

    // Nothing else ever clears the indicator. Somebody who starts a sentence
    // and walks away would otherwise be shown as typing to everyone else until
    // they came back and sent it.
    clearTimeout(this._typingIdleTimeout);
    this._typingIdleTimeout = setTimeout(
      () => this.typingStop(conversationId),
      ConversationService._typingIdleMs,
    );
  }

  /**
   * Stop, at once — on sending the message, on leaving the conversation, or on
   * going idle long enough that the indicator has stopped being true.
   */
  public typingStop(conversationId: number): void {
    clearTimeout(this._typingIdleTimeout);

    // Never announced, nothing to withdraw. Skipped rather than sent anyway so
    // a conversation nobody typed in does not publish on being closed.
    if (this._typing?.conversationId !== conversationId) {
      return;
    }

    this._typing = null;
    this._sendTyping(conversationId, false);
  }

  public mapAccount(account): Account {
    return this._conversationConfig.mapAccount ? this._conversationConfig.mapAccount(account) : account;
  }

  public mapGalleryItem(conversationItem: ConversationItem, conversationItemFile: ConversationItemFile): FsGalleryItem {
    return this._conversationConfig.mapGalleryItem ? this._conversationConfig.mapGalleryItem(conversationItem, conversationItemFile) : null;
  }

  /**
   * The channel one conversation's messages and typing both travel on.
   *
   * Taken fresh each time rather than cached: the handle is stateless, and the
   * server-side subscription it stands for is reference-counted inside the
   * socket — so the messages stream and the typing stream share one
   * subscription, and it is released only when the last of them goes away.
   */
  private _sendTyping(conversationId: number, typing: boolean): void {
    this._getConversationTopic(conversationId)
      .publish(CONVERSATION_EVENT_TYPING, { typing });
  }

  private _getConversationTopic(conversationId: number): FsWebSocketTopic {
    return this._webSocket.topic(conversationTopic(conversationId));
  }

}
