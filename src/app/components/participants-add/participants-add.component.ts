import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';

import { MAT_DIALOG_DATA, MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';

import { FsMessage } from '@firestitch/message';

import { Subject } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { ConversationService } from '../../services';
import { Account, Conversation, ConversationParticipant } from '../../types';
import { FormsModule } from '@angular/forms';
import { FsFormModule } from '@firestitch/form';
import { FsDialogModule } from '@firestitch/dialog';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { FsAutocompleteChipsModule } from '@firestitch/autocomplete-chips';
import { MatButton } from '@angular/material/button';


@Component({
    templateUrl: './participants-add.component.html',
    styleUrls: ['./participants-add.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        FormsModule,
        FsFormModule,
        FsDialogModule,
        MatDialogTitle,
        CdkScrollable,
        MatDialogContent,
        FsAutocompleteChipsModule,
        MatDialogActions,
        MatButton,
        MatDialogClose,
    ],
})
export class ParticipantsAddComponent implements OnInit, OnDestroy {
  private _data = inject(MAT_DIALOG_DATA);
  private _dialogRef = inject<MatDialogRef<ParticipantsAddComponent>>(MatDialogRef);
  private _message = inject(FsMessage);


  public accounts: Account[] = [];
  public conversation: Conversation;

  private _destroy$ = new Subject<void>();
  private _conversationService: ConversationService;

  public ngOnInit(): void {
    this.conversation = this._data.conversation;
    this._conversationService = this._data.conversationService;
  }

  public ngOnDestroy(): void {
    this._destroy$.next(null);
    this._destroy$.complete();
  }

  public save = () => {
    return this._conversationService.conversationConfig
      .conversationParticipantAdd(this.conversation,
        {
          accountIds: this.accounts.map((account) => account.id),
        })
      .pipe(
        tap((response) => {
          this._message.success('Saved Changes');
          this._dialogRef.close(response);

          this._conversationService.sendMessageNotice(this.conversation.id);
        }),
      );
  }

  public accountsFetch = (keyword) => {
    return this._conversationService.conversationConfig.accountsGet(
      this.conversation,
      {
        keyword,
        avatars: true,
        limit: 30,
      })
      .pipe(
        map((response) => response.accounts)
      );
  }

}
