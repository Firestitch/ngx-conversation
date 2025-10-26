import {
  Component, OnInit, OnDestroy,
  ChangeDetectionStrategy, ChangeDetectorRef, Inject,
} from '@angular/core';

import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';

import { index } from '@firestitch/common';
import { FsMessage } from '@firestitch/message';

import { Observable, of, Subject } from 'rxjs';
import { filter, switchMap, tap } from 'rxjs/operators';

import { ConversationState } from '../../enums';
import { ConversationStates } from '../../consts';
import { Account, Conversation } from '../../types';
import { ConversationService } from '../../services';
import { hasAdminRole } from '../../helpers';
import { FormsModule } from '@angular/forms';
import { FsFormModule } from '@firestitch/form';
import { FsDialogModule } from '@firestitch/dialog';
import { FsSkeletonModule } from '@firestitch/skeleton';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { MatTabGroup, MatTab, MatTabContent } from '@angular/material/tabs';
import { FsTabsModule } from '@firestitch/tabs';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatOption } from '@angular/material/core';
import { NgTemplateOutlet } from '@angular/common';
import { ParticipantsListComponent } from '../participants-list/participants-list.component';
import { MatButton } from '@angular/material/button';


@Component({
    templateUrl: './conversation-settings.component.html',
    styleUrls: ['./conversation-settings.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        FormsModule,
        FsFormModule,
        FsDialogModule,
        MatDialogTitle,
        FsSkeletonModule,
        CdkScrollable,
        MatDialogContent,
        MatTabGroup,
        FsTabsModule,
        MatTab,
        MatTabContent,
        MatFormField,
        MatLabel,
        MatInput,
        MatSelect,
        MatOption,
        NgTemplateOutlet,
        ParticipantsListComponent,
        MatDialogActions,
        MatButton,
        MatDialogClose,
    ],
})
export class ConversationSettingsComponent implements OnInit, OnDestroy {

  public conversation: Conversation = null;
  public ConversationStates = ConversationStates;
  public conversationStates = index(ConversationStates, 'name', 'value');
  public tab: string;
  public account: Account;
  public joined: boolean;

  private _conversationService: ConversationService;
  private _destroy$ = new Subject();

  constructor(
    @Inject(MAT_DIALOG_DATA) private _data: {
      conversationService: ConversationService,
      conversation: Conversation,
      tab: string,
      joined: boolean,
      account: Account,
    },
    private _dialogRef: MatDialogRef<ConversationSettingsComponent>,
    private _dialog: MatDialog,
    private _cdRef: ChangeDetectorRef,
    private _message: FsMessage,
  ) {}

  public get conversationService(): ConversationService {
    return this._conversationService;
  }

  public get showLeaveConverstation(): boolean {
    return this._conversationService.leaveConverstation.show;
  }

  public ngOnInit(): void {
    this.tab = this._data.tab;
    this.joined = this._data.joined;
    this.account = this._data.account;
    this.ConversationStates = ConversationStates
      .filter((conversationState) => conversationState.value !== ConversationState.Deleted);
    this._conversationService = this._data.conversationService;
    this.conversation = {
      ...this._data.conversation,
    };
  }

  public save = (): Observable<any> => {
    return of(true)
      .pipe(
        switchMap(() => {
          return this.conversationService.conversationConfig.conversationSave(this.conversation)
            .pipe(
              tap((response) => {
                this.conversation = {
                  ...this.conversation,
                  ...response,
                };
                this._cdRef.markForCheck();
              }),
            );
        }),
      )
      .pipe(
        tap(() => {
          this._dialogRef.close(this.conversation);
          this._message.success('Saved Changes');
        }),
      );
  };

  public get hasAdminRole(): boolean {
    return hasAdminRole(this.conversation);
  }

  public leave(): void {
    this.conversationService.conversationParticipantGet(this.conversation, {
      accountId: this.account.id,
    })
    .pipe(
      filter((conversationParticipant) => !!conversationParticipant),
      switchMap((conversationParticipant) => {
        return this._conversationService.conversationConfig
          .conversationParticipantDelete(this.conversation, conversationParticipant);
      }),
    )
    .subscribe(() => {
      const ref = this._dialog.getDialogById('converstationDialog');
      ref?.close();
      this._dialogRef.close();
    });
  }

  public ngOnDestroy(): void {
    this._destroy$.next(null);
    this._destroy$.complete();
  }

}
