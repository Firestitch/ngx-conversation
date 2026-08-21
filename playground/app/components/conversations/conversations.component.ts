import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewChild, inject } from '@angular/core';

import { FsConversationsComponent } from '@firestitch/conversation';

import { of } from 'rxjs';

import { accountData } from 'playground/app/data';
import {
  ConversationStoreService, ConversationsStaticService, PlaygroundWebSocket,
} from 'playground/app/services';
import { ConversationConfig } from 'src/app/types';

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
  ],
})
export class ConversationsComponent {

  @ViewChild(FsConversationsComponent)
  public conversations: FsConversationsComponent;

  public account = accountData;

  public conversationConfig: ConversationConfig;

  // Swap for ConversationsApiService to run the demo against a real backend
  private _conversationsService = inject(ConversationsStaticService);
  private _conversationStore = inject(ConversationStoreService);
  private _webSocket = inject(PlaygroundWebSocket);

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

}
