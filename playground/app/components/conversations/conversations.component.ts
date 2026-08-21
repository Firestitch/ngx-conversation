import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild, inject } from '@angular/core';

import { MatButton } from '@angular/material/button';

import { FsConversationsComponent } from '@firestitch/conversation';

import { of } from 'rxjs';

import { accountData, accountsData, sessionAccountId } from 'playground/app/data';
import {
  ConversationStoreService, ConversationsStaticService, PlaygroundWebSocket,
} from 'playground/app/services';
import { CONVERSATION_EVENT_TYPING, conversationTopic } from 'src/app/consts';
import { Account, ConversationConfig } from 'src/app/types';

import { FsConversationsComponent as FsConversationsComponent_1 } from '../../../../src/app/components/conversations/conversations.component';
import { ConversationsConversationDirective } from '../../../../src/app/directives/conversation-conversation.directive';
import { ConversationsConversationNameDirective } from '../../../../src/app/directives/conversations-conversation-name.directive';


@Component({
  selector: 'app-conversations',
  templateUrl: './conversations.component.html',
  styleUrls: ['./conversations.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FsConversationsComponent_1,
    ConversationsConversationDirective,
    NgTemplateOutlet,
    ConversationsConversationNameDirective,
    MatButton,
  ],
})
export class ConversationsComponent {

  @ViewChild(FsConversationsComponent)
  public conversations: FsConversationsComponent;

  public account = accountData;

  public conversationConfig: ConversationConfig;

  /** The account the button is currently pretending is at the keyboard, if any. */
  public simulatedTyping: { conversationId: number; account: Account } = null;

  // Swap for ConversationsApiService to run the demo against a real backend
  private _conversationsService = inject(ConversationsStaticService);
  private _conversationStore = inject(ConversationStoreService);
  private _webSocket = inject(PlaygroundWebSocket);
  private _cdRef = inject(ChangeDetectorRef);

  // Cycled so clicking the button again after stopping brings a different face
  private _simulatedTypingIndex = 0;

  constructor() {
    // Be an admin everywhere so the admin-only actions are reachable in the example
    this._conversationStore.sessionAdmin = true;

    // Set `debug` to log every socket frame to the console — chatty, because the pane
    // sends a typing frame per keypress. `disconnect()` drops the components back onto
    // polling, which is a useful way to compare the two paths.
    this._webSocket.debug = false;

    this.conversationConfig = {
      ...this._conversationsService.conversationConfig,
      startConversation: {
        ...this._conversationsService.conversationConfig.startConversation,
        afterOpen: (conversation) => {
          this.conversations.conversationPane.openSettings();

          return of(conversation);
        },
      },
      converstationsReloadInterval: 10,
    };
  }

  /**
   * Somebody else typing in the open conversation, without a second browser.
   *
   * The frame goes out through `broadcast()` rather than the client's own
   * `typingStart()`: a publish gets stamped with the session account, and the
   * pane drops its own account so nobody watches themselves type. Broadcasting
   * is the server speaking, which is the only way to be another participant.
   *
   * Stopping is deliberate rather than on a timer, so the indicator can be left
   * up while its styling is looked at. It is withdrawn against the conversation
   * it was raised in, which is not necessarily the one now open.
   */
  public simulatedTypingToggle(): void {
    if (this.simulatedTyping) {
      this._simulatedTypingSend(this.simulatedTyping.conversationId, this.simulatedTyping.account, false);
      this.simulatedTyping = null;
      this._cdRef.markForCheck();

      return;
    }

    const conversationId = this.conversations?.conversation?.id;

    if (!conversationId) {
      return;
    }

    const others = accountsData
      .filter((row) => row.id !== sessionAccountId);
    const account = others[this._simulatedTypingIndex % others.length];

    this._simulatedTypingIndex++;
    this.simulatedTyping = { conversationId, account };
    this._simulatedTypingSend(conversationId, account, true);
    this._cdRef.markForCheck();
  }

  private _simulatedTypingSend(conversationId: number, account: Account, typing: boolean): void {
    this._webSocket.broadcast(
      conversationTopic(conversationId),
      CONVERSATION_EVENT_TYPING,
      {
        accountId: account.id,
        accountName: account.name,
        accountAvatar: account.avatar?.tiny,
        typing,
      },
    );
  }

}
