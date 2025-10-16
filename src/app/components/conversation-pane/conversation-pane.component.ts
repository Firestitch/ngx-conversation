import {
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy, OnInit, Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { MatInput } from '@angular/material/input';

import { list } from '@firestitch/common';
import { currentDeviceMobile } from '@firestitch/device';
import { FsFile } from '@firestitch/file';
import { FsFormDirective } from '@firestitch/form';
import { FsMessage } from '@firestitch/message';
import { DisplayUploadStatus } from '@firestitch/upload';

import { forkJoin, Observable, of, Subject, throwError } from 'rxjs';
import { delay, filter, finalize, mapTo, switchMap, takeUntil, tap } from 'rxjs/operators';

import { HttpContext } from '@angular/common/http';

import { ConversationStates } from '../../consts';
import { ConversationItemState, ConversationItemType, ConversationState } from '../../enums';
import { ConversationService } from '../../services';
import { Account, Conversation, ConversationConfig, ConversationItem } from '../../types';
import { ConversationItemsComponent } from '../conversation-items';
import { ConversationSettingsComponent } from '../conversation-settings';


@Component({
  selector: 'app-conversation-pane',
  templateUrl: './conversation-pane.component.html',
  styleUrls: ['./conversation-pane.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationPaneComponent implements OnDestroy, OnChanges, OnInit {

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

  constructor(
    private _cdRef: ChangeDetectorRef,
    private _message: FsMessage,
    private _conversationService: ConversationService,
    private _dialog: MatDialog,
  ) { }

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
                  { context: new HttpContext().set(DisplayUploadStatus, true) },
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
          this.conversationItems.autoload = false;
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
          this.conversationService.sendMessageNotice(this.conversation.id, this.account.id);
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
        tap(() => {
          this.conversation = null;
          this._cdRef.markForCheck();
        }),
        delay(10),
        tap((response) => {
          this.joined = response.conversationParticipants.conversationParticipants.length > 0;
          this.conversation = response.conversation;
          this.conversationChange.emit();
          this._cdRef.markForCheck();
        }),
      );
  }

  public loadConversation(conversation: Conversation) {
    this.inited = false;
    this._cdRef.markForCheck();

    this.loadConversation$(conversation)
      .pipe(
        tap(() => {
          // handle typing updates
          this.conversationService
            .onTypingNotice(this.conversation.id)
            .pipe(
              filter((response) => !!response),
              takeUntil(this._destroy$),
            )
            .subscribe((message) => {
              if (message.data.isTyping) {
                if (!this.typing.accounts.some((el) => el.id === message.data.accountId)) {
                  this.typing.accounts
                    .push({ id: message.data.accountId, name: message.data.accountName });
                }
              } else {
                this.typing.accounts = this.typing.accounts.filter((el) => el.id !== message.data.accountId);
              }
              this._updateTypingState();
            });

          // handle new messages
          this.conversationService
            .onMessageNotice(this.conversation.id)
            .pipe(
              takeUntil(this._destroy$),
            )
            .subscribe(() => {
              this.conversationItems.reload();
            });
        }),
        switchMap(() => this.conversationService.openConversation.afterOpen(this.conversation)),
        finalize(() => {
          this.inited = true;
        }),
      )
      .subscribe(() => {
        this.conversationOpened.emit(this.conversation);
      });
  }

  public typingStart() {
    this.conversationService.sendTypingStartNotice(this.conversation.id, this.account.id);
  }

  public openSettings(options: { tab?: string } = { tab: 'settings' }): void {
    this._dialog.open(ConversationSettingsComponent, {
      autoFocus: false,
      data: {
        conversation: this.conversation,
        conversationService: this.conversationService,
        joined: this.joined,
        account: this.account,
        tab: options?.tab || 'settings',
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
