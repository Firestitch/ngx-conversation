import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';

import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';

import { FsDialogModule } from '@firestitch/dialog';
import { ItemType } from '@firestitch/filter';
import { FsFormModule } from '@firestitch/form';
import { FsListCellDirective, FsListColumnDirective, FsListComponent, FsListConfig } from '@firestitch/list';

import { map } from 'rxjs/operators';

import { ConversationService } from '../../services';
import { ConversationParticipantComponent } from '../conversation-participant/conversation-participant.component';


@Component({
  templateUrl: './conversation-read-participants-dialog.component.html',
  styleUrls: ['./conversation-read-participants-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FsDialogModule,
    MatDialogTitle,
    CdkScrollable,
    MatDialogContent,
    FsListComponent,
    FsListColumnDirective,
    FsListCellDirective,
    ConversationParticipantComponent,
    MatDialogActions,
    MatButton,
    FsFormModule,
    MatDialogClose,
  ],
})
export class ConversationReadParticipantsDialogComponent implements OnInit {
  private _data = inject(MAT_DIALOG_DATA);


  public listConfig: FsListConfig;

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

        return this._data.conversationService
          .conversationConfig.conversationParticipantsGet(conversation, query)
          .pipe(
            map((response: any) => ({
              data: response.conversationParticipants,
              paging: response.paging,
            })),
          );
      },
    };
  }
}
