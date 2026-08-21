import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild, inject } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { MatInput } from '@angular/material/input';

import { list, FsCommonModule } from '@firestitch/common';
import { currentDeviceMobile } from '@firestitch/device';
import { FsFile, FsFileModule } from '@firestitch/file';
import { FsFormDirective, FsFormModule } from '@firestitch/form';
import { FsMessage } from '@firestitch/message';
import { DisplayUploadStatus } from '@firestitch/upload';

import { forkJoin, Observable, of, Subject, throwError } from 'rxjs';
import { delay, filter, finalize, mapTo, switchMap, takeUntil, tap } from 'rxjs/operators';

import { HttpContext } from '@angular/common/http';

import { ConversationStates } from '../../consts';
import { ConversationItemState, ConversationItemType, ConversationState } from '../../enums';
import { ConversationService } from '../../services';
import { Account, Conversation, ConversationConfig, ConversationItem, ConversationTypingNotice } from '../../types';
import { ConversationItemsComponent } from '../conversation-items';
import { ConversationSettingsComponent } from '../conversation-settings';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { ConversationHeaderComponent } from '../conversation-header/conversation-header.component';
import { ConversationItemsComponent as ConversationItemsComponent_1 } from '../conversation-items/conversation-items.component';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormField } from '@angular/material/form-field';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinner } from '@angular/material/progress-spinner';


@Component({
    selector: 'app-conversation-pane',
    templateUrl: './conversation-pane.component.html',
    styleUrls: ['./conversation-pane.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        FormsModule,
        FsFormModule,
        NgClass,
        ConversationHeaderComponent,
        ConversationItemsComponent_1,
        MatButton,
        MatFormField,
        MatInput,
        CdkTextareaAutosize,
        FsCommonModule,
        MatIconButton,
        MatIcon,
        MatProgressSpinner,
        FsFileModule,
    ],
})
export class ConversationPaneComponent implements OnDestroy, OnChanges, OnInit {
  private _cdRef = inject(ChangeDetectorRef);
  private _message = inject(FsMessage);
  private _conversationService = inject(ConversationService);
  private _dialog = inject(MatDialog);


  @ViewChild('messageInput', { read: MatInput })
  public messageInput: MatInput;

  @ViewChild('conversationContainer', { read: ElementRef })
  public conversationContainerEl: ElementRef;

  @Input() public account: Account;
  @Input() public conversation: Conversation;

  @Output() public conversationClose = new EventEmitter();
  @Output() public conversationOpen = new EventEmitter();
  @Output() public conversationOpened = new EventEmitter();
  @Output() public conversationChange = new EventEmitter();

  @ViewChild(ConversationItemsComponent)
  public conversationItems: ConversationItemsComponent;

  @ViewChild(FsFormDirective)
  public messageForm: FsFormDirective;

  @ViewChild(MatInput, { static: true })
  public input: MatInput;

  public message = '';
  public ConversationState = ConversationState;
  public files: FsFile[] = [];
  public sessionConversationParticipant;
  public ConversationStates = ConversationStates;
  public conversationStates = list(ConversationStates, 'name', 'value');
  public joined = false;
  public inited = false;
  public mobile = false;
  public submitting = false;
  public typing = { state: 'none', name: '', accounts: [] };

  private _destroy$ = new Subject();
  private _conversationLoad$ = new Subject();

  public ngOnInit(): void {
    this.mobile = currentDeviceMobile();
  }

  public get conversationService(): ConversationService {
    return this._conversationService;
  }

  public get conversationConfig(): ConversationConfig {
    return this._conversationService.conversationConfig;
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.conversation) {
      this.loadConversation(this.conversation);
    }
  }

  public saveConversation(conversation): Observable<any> {
    return this._conversationService.conversationConfig.conversationSave(conversation)
      .pipe(
        tap(() => {
          this._message.success('Saved Changes');
          this.conversationChange.emit();
        }),
      );
  }

  public conversationItemCreate(config) {
    this.conversationItems.autoload = false;

    return this._conversationService
      .conversationConfig.conversationItemSave({
        conversationId: this.conversation.id,
        message: config.message,
        type: ConversationItemType.Message,
        state: this.files.length ? ConversationItemState.Draft : ConversationItemState.Active,
      })
      .pipe(
        switchMap((conversationItem) => {
          return forkJoin(
            [
              of(true),
              ...this.files.map((fsFile: FsFile) => {
                return this._conversationService.conversationConfig.conversationItemFilePost(
                  conversationItem,
                  fsFile.file,
                  { context: new HttpContext().set(DisplayUploadStatus, false) },
                );
              }),
            ])
            .pipe(
              mapTo(conversationItem),
            );
        }),
        switchMap((conversationItem: ConversationItem) => {
          return this.files.length ?
            this._conversationService
              .conversationConfig.conversationItemSave({
                id: conversationItem.id,
                conversationId: this.conversation.id,
                state: ConversationItemState.Active,
              }) : of(conversationItem);
        }),
        switchMap(() => {
          return this.conversationItems.load$();
        }),
        tap(() => {
          setTimeout(() => {
            this.conversationScrollToBottom();
          });
        }),
        finalize(() => {
          this.conversationItems.autoload = true;
        }),
      );
  }

  public fileSelect(fsFiles: FsFile[]) {
    this.files = [
      ...this.files,
      ...fsFiles,
    ];

    this.messageForm.dirty();
  }

  public fileRemove(file: FsFile) {
    this.files = this.files.filter((f) => f !== file);
  }

  public messageKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.messageForm.triggerSubmit();
    }
  }

  public messageSend = () => {
    return of(this.message.trim())
      .pipe(
        tap(() => {
          this.submitting = true;
          this._cdRef.markForCheck();
        }),
        switchMap((message) =>
          !this.files.length && message.length === 0 ?
            throwError(false) : of(message)),
        switchMap((message) => this.conversationItemCreate({ message })),
        tap(() => {
          // The server announces the message itself now, on the write that
          // stored it — a browser saying "I sent one" was always a claim it
          // could not back, since the save might not have succeeded. What is
          // still ours to say is that we stopped typing: nothing else ever
          // clears the indicator, and one stuck on is worse than none.
          this.conversationService.typingStop(this.conversation.id);
          this.message = '';
          this.files = [];
          this._cdRef.markForCheck();
          this.conversationChange.emit();
          this.messageInput.focus();
        }),
        finalize(() => {
          this.submitting = false;
          this._cdRef.markForCheck();
        }),
        delay(100),
        tap(() => {
          this.messageInput.focus();
        }),
      );
  };

  public ngOnDestroy(): void {
    this._conversationLoad$.next(null);
    this._conversationLoad$.complete();
    this._destroy$.next(null);
    this._destroy$.complete();
  }

  public filterChanged(event) {
    this.conversationItems.query = event.query;
    this.conversationItems.reload();
  }

  public conversationJoin() {
    this.conversationConfig.conversationParticipantAdd(this.conversation, {
      accountIds: [this.account.id],
    })
      .pipe(
        switchMap(() => this.loadConversation$(this.conversation)),
      )
      .subscribe();
  }

  public conversationScrollToBottom() {
    this.conversationContainerEl.nativeElement.scrollTop = this.conversationContainerEl.nativeElement.scrollHeight;
  }

  public conversationReload() {
    this.loadConversation$(this.conversation)
      .pipe(
        // The thread is re-read as well. Somebody joining or leaving writes a
        // notice into it, and this reload is what announced that change — but
        // the conversation is the same one, so the items do not refetch on
        // their own. They used to only because this method rebuilt them.
        tap(() => this.conversationItems?.reload()),
      )
      .subscribe();
  }

  public loadConversation$(
    conversation: Conversation,
  ): Observable<{ conversation: Conversation; conversationParticipants: any }> {
    return forkJoin({
      conversation: this._conversationService
        .conversationGet(conversation.id, {
          conversationParticipantCounts: true,
          recentConversationParticipants: true,
          recentConversationParticipantAccounts: true,
          recentConversationParticipantAccountAvatars: true,
        }),
      conversationParticipants: this.conversationConfig
        .conversationParticipantsGet(conversation, {
          accountId: this.account.id,
          accounts: true,
          accountAvatars: true,
        }),
    })
      .pipe(
        tap((response) => {
          this.sessionConversationParticipant = response
            .conversationParticipants.conversationParticipants[0];
          this.joined = !!this.sessionConversationParticipant;
          this.conversation = response.conversation;
          this.conversationChange.emit();
          this._cdRef.markForCheck();
        }),
      );
  }

  public loadConversation(conversation: Conversation) {
    this.inited = false;

    // Drop the notice subscriptions from the conversation we are leaving, and
    // withdraw any typing indicator still standing in it — nothing else would.
    if (this.conversation?.id) {
      this.conversationService.typingStop(this.conversation.id);
    }

    this._conversationLoad$.next(null);
    this.typing = { state: 'none', name: '', accounts: [] };
    this._cdRef.markForCheck();

    this.loadConversation$(conversation)
      .pipe(
        tap(() => {
          // Typing reaches every subscriber of the topic including this one —
          // the others are on other nodes, so the server has no connection to
          // skip. Dropping our own account is what stops the sender watching
          // themselves type.
          this.conversationService
            .watchTyping(this.conversation.id)
            .pipe(
              filter((notice: ConversationTypingNotice) => notice.accountId !== this.account.id),
              takeUntil(this._conversationLoad$),
            )
            .subscribe((notice: ConversationTypingNotice) => {
              if (notice.typing) {
                if (!this.typing.accounts.some((el) => el.id === notice.accountId)) {
                  this.typing.accounts
                    .push({ id: notice.accountId, name: notice.accountName });
                }
              } else {
                this.typing.accounts = this.typing.accounts
                  .filter((el) => el.id !== notice.accountId);
              }

              this._updateTypingState();
              this._cdRef.markForCheck();
            });

          // A message arrived, was edited or was removed. The signal says only
          // that the thread changed, so the items are re-read rather than
          // merged — which is also what keeps a reader from being handed
          // content the API would not have served them.
          this.conversationService
            .watchConversationItems(this.conversation.id)
            .pipe(
              takeUntil(this._conversationLoad$),
            )
            .subscribe(() => {
              this.conversationItems?.reload();
            });
        }),
        switchMap(() => this.conversationService.openConversation.afterOpen(this.conversation)),
        finalize(() => {
          this.inited = true;
        }),
      )
      .subscribe({
        next: () => {
          this.conversationOpened.emit(this.conversation);
        },
        error: () => {
          // A conversation that cannot be read has to say so. Unhandled, this
          // reached the console as an unhandled error and left the pane holding
          // the header of the thread being opened with nothing under it, which
          // reads as a conversation whose replies disappeared.
          this._message.error('Failed to load the conversation');
          this._cdRef.markForCheck();
        },
      });
  }

  public typingStart() {
    this.conversationService.typingStart(this.conversation.id);
  }

  public openSettings(options: { tab?: string } = { tab: 'participants' }): void {
    this._dialog.open(ConversationSettingsComponent, {
      autoFocus: false,
      data: {
        conversation: this.conversation,
        conversationService: this.conversationService,
        joined: this.joined,
        account: this.account,
        tab: options?.tab || 'participants',
      },
    })
      .afterClosed()
      .pipe(
        takeUntil(this._destroy$),
      )
      .subscribe((conversation) => {
        this.conversation = {
          ...this.conversation,
          ...conversation,
        };
        this._cdRef.markForCheck();
        this.conversationChange.emit();
      });
  }

  private _updateTypingState() {
    this.typing.accounts = this.typing.accounts
      .filter((account) => {
        return !!account;
      });

    if (this.typing.accounts.length === 0) {
      this.typing.state = 'none';
      this.typing.name = '';
    } else if (this.typing.accounts.length === 1) {
      this.typing.state = 'single';
      this.typing.name = this.typing.accounts[0].name;
    } else {
      this.typing.state = 'multiple';
      this.typing.name = '';
    }

    this._cdRef.markForCheck();
  }

}
