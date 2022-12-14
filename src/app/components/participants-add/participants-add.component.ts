import { Component, Inject, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';

import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { FsMessage } from '@firestitch/message';

import { forkJoin, Subject } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { ConversationService } from '../../services';
import { Account, Conversation, ConversationParticipant } from '../../types';


@Component({
  templateUrl: './participants-add.component.html',
  styleUrls: ['./participants-add.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParticipantsAddComponent implements OnInit, OnDestroy {

  public accounts: Account[] = [];
  public conversation: Conversation;

  private _destroy$ = new Subject<void>();
  private _conversationService: ConversationService;

  constructor(
    @Inject(MAT_DIALOG_DATA) private _data: {
      conversationParticipants: ConversationParticipant[];
      conversation: Conversation;
      conversationService: ConversationService,
    },
    private _dialogRef: MatDialogRef<ParticipantsAddComponent>,
    private _message: FsMessage,
  ) { }

  public ngOnInit(): void {
    this.conversation = this._data.conversation;
    this._conversationService = this._data.conversationService;
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  public save = () => {
    return this._conversationService.conversationConfig.conversationParticipantAdd(this.conversation,
        {
          accountIds: this.accounts.map((account) => account.id),
        })
      .pipe(
        tap((response) => {
          this._message.success('Saved Changes');
          this._dialogRef.close(response);
        }),
      );
  }

  public accountsFetch = (keyword) => {
    return this._conversationService.conversationConfig.accountsGet(
      this.conversation,
      {
        keyword,
        avatars: true,
        notConversationId: this.conversation.id,
        limit: 30,
      })
      .pipe(
        map((response) => response.accounts)
      );
  }

}
