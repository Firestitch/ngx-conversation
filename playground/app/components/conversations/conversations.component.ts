import { ChangeDetectionStrategy, Component, ViewChild, inject } from '@angular/core';

import { FsConversationsComponent } from '@firestitch/conversation';
import { FsWebSocket } from '@firestitch/web-socket';

import { of } from 'rxjs';

import { accountData } from 'playground/app/data';
import { ConversationsApiService } from 'playground/app/services';
import { ConversationConfig } from 'src/app/types';
import { FsConversationsComponent as FsConversationsComponent_1 } from '../../../../src/app/components/conversations/conversations.component';
import { ConversationsConversationDirective } from '../../../../src/app/directives/conversation-conversation.directive';
import { NgTemplateOutlet } from '@angular/common';
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
  private _conversationsService = inject(ConversationsApiService);
  private _websocketService = inject(FsWebSocket);


  @ViewChild(FsConversationsComponent)
  public conversations: FsConversationsComponent;

  public account = accountData;

  public conversationConfig: ConversationConfig;

  constructor() {
    this.conversationConfig = {
      ...this._conversationsService.conversationConfig,
      tabs: false,
      // readConversation: {
      //   show: () => of(false),
      // },
      startConversation: {
        ...this._conversationsService.conversationConfig.startConversation,
        afterOpen: (conversation) => {
          const conversationPane = this.conversations.conversationPane;
          conversationPane.openSettings();

          return of(conversation);
        },
      },
      converstationsReloadInterval: 10000,
    };
  }
}
