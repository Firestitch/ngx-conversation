import {
  ChangeDetectionStrategy,
  Component,
  Inject,
  OnInit,
} from '@angular/core';

import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { ItemType } from '@firestitch/filter';
import { FsListConfig } from '@firestitch/list';

import { map } from 'rxjs/operators';

import { ConversationService } from '../../services';
import { Account, Conversation, ConversationItem } from '../../types';


@Component({
  templateUrl: './conversation-read-participants-dialog.component.html',
  styleUrls: ['./conversation-read-participants-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationReadParticipantsDialogComponent implements OnInit {

  public listConfig: FsListConfig;

  constructor(
    @Inject(MAT_DIALOG_DATA) private _data: {
      conversation: Conversation;
      conversationItem: ConversationItem;
      conversationService: ConversationService;
      account: Account;
    },
  ) { }

  public get conversationService(): ConversationService {
    return this._data.conversationService;
  }

  public ngOnInit(): void {
    this.listConfig = {
      paging: {
        limit: 10,
      },
      filters: [
        {
          name: 'keyword',
          type: ItemType.Keyword,
          label: 'Search',
        },
      ],
      status: true,
      fetch: (query) => {
        const conversationItem = this._data.conversationItem;
        const conversation = this._data.conversation;

        query = {
          ...query,
          limit: 10,
          maxReadConversationItemId: conversationItem.id,
          notConversationParticipantId: conversationItem.conversationParticipantId,
          accounts: true,
          accountAvatars: true,
        };

        return this._data.conversationService.conversationConfig.conversationParticipantsGet(conversation, query)
          .pipe(
            map((response) => ({ data: response.conversationParticipants, paging: response.paging })),
          );
      },
    };
  }
}
