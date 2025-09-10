import {
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';

import { MatDialog } from '@angular/material/dialog';

import {
  FsGalleryConfig, FsGalleryItem,
  MimeType, ThumbnailScale,
} from '@firestitch/gallery';
import { FsPrompt } from '@firestitch/prompt';

import { Observable, of, Subject, timer } from 'rxjs';
import { delay, filter, map, switchMap, takeUntil, tap } from 'rxjs/operators';

import {
  ConversationItemState, ConversationItemType, ConversationRole, ConversationState,
} from '../../enums';
import { ConversationService } from '../../services';
import { Account, Conversation, ConversationItem, ConversationParticipant } from '../../types';
import { ConversationReadParticipantsDialogComponent } from '../conversation-read-participants-dialog';


@Component({
  selector: 'app-conversation-items',
  templateUrl: './conversation-items.component.html',
  styleUrls: ['./conversation-items.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationItemsComponent implements OnInit, OnDestroy {

  @Input() public conversation: Conversation;
  @Input() public account: Account;
  @Input() public query = {};
  @Input() public sessionConversationParticipant: ConversationParticipant;
  @Input() public conversationService: ConversationService;

  @Output() public conversationChange = new EventEmitter();
  @Output() public conversationInitialLoad = new EventEmitter();

  public autoload = true;
  public initialized = false;
  public MimeType = MimeType;
  public conversationParticipants: ConversationParticipant[] = [];
  public ConversationItemType = ConversationItemType;
  public lastConversationItem: ConversationItem;
  public ConversationItemState = ConversationItemState;
  public canShowReadParticipants: Observable<boolean>;
  public conversationItems: (ConversationItem & {
    canDelete?: boolean;
    galleryConfig?: FsGalleryConfig;
  })[] = [];

  private _destroy$ = new Subject();

  constructor(
    private _cdRef: ChangeDetectorRef,
    private _prompt: FsPrompt,
    private _dialog: MatDialog,
  ) { }

  public ngOnInit(): void {
    this.canShowReadParticipants = this.conversationService.conversationConfig.readConversation.show();

    this.load$()
      .pipe(
        delay(0),
      )
      .subscribe(() => {
        this.initialized = true;
        this._cdRef.markForCheck();
        this.conversationInitialLoad.emit();
      });

    timer(0, 5000)
      .pipe(
        filter(() => this.autoload),
        takeUntil(this._destroy$),
      )
      .subscribe(() => {
        if (!this.conversationService.hasWebSocketConnection()) {
          this.load();
          this._cdRef.markForCheck();
        }
      });
  }

  public reload(): void {
    this.conversationItems = [];
    this.lastConversationItem = null;
    this.load();
  }

  public load(): void { 
    this.load$()
      .subscribe();
  }

  public load$(): Observable<any> {
    this.autoload = false;
    const maxConversationItemId = this.conversationItems[0]?.id;

    return this.conversationService.conversationConfig
      .conversationItemsGet(this.conversation, {
        ...this.query,
        conversationParticipants: true,
        conversationParticipantAccounts: true,
        conversationParticipantAccountAvatars: true,
        lastConversationItemParticipantAddRemoves: true,
        lastConversationItemParticipantAddRemoveAccounts: true,
        lastConversationItemParticipantAddRemoveAccountAvatars: true,
        lastConversationItemConversationParticipants: true,
        conversationParticipantsAddedCounts: true,
        conversationParticipantsRemovedCounts: true,
        conversationParticipantsReadCounts: true,
        conversationParticipantsReadCountNotCreator: true,
        conversationItemFiles: true,
        maxConversationItemId,
        order: 'conversation_item_id,desc',
      })
      .pipe(
        map((response) => {
          return response.conversationItems
            .map((conversationItem) => {
              const galleryConfig: FsGalleryConfig = {
                info: false,
                thumbnail: {
                  heightScale: 0.7,
                  width: 200,
                  scale: ThumbnailScale.None,
                },
                zoom: false,
                fetch: (): Observable<FsGalleryItem[]> => {
                  return of(conversationItem.conversationItemFiles
                    .map((conversationItemFile) => {
                      return this.conversationService
                        .mapGalleryItem(conversationItem, conversationItemFile);
                    }));
                },
              };

              return {
                ...conversationItem,
                canDelete: this.canDelete(conversationItem),
                galleryConfig,
              };
            });
        }),
        tap((conversationItems) => {
          this.autoload = true;

          // if participants added/removed trigger a conversation reload
          if (this.conversationItems.length > 0
            && conversationItems.some((conversationItem) => {
              return [ConversationItemType.ParticipantAdd, ConversationItemType.ParticipantRemoved]
                .indexOf(conversationItem.type) !== -1;
            })
          ) {
            this.conversationChange.emit(this.conversation);
          }
  
          this.conversationItems = [
            ...conversationItems,
            ...this.conversationItems,
          ];
  
          const lastConversationItem = this.conversationItems[0];
          if (lastConversationItem && lastConversationItem !== this.lastConversationItem) {
            this.conversationService.conversationConfig
              .conversationRead(this.conversation, lastConversationItem)
              .subscribe();
          }
  
          this.lastConversationItem = lastConversationItem;
          this._cdRef.markForCheck();
        }),
      );
  }

  public openReadParticipants(conversationItem) {
    this._dialog.open(ConversationReadParticipantsDialogComponent, {
      data: {
        conversation: this.conversation,
        conversationItem,
        conversationService: this.conversationService,
        account: this.account,
      },
    });
  }

  public canDelete(conversationItem) {
    if (conversationItem.state !== ConversationItemState.Active) {
      return false;
    }

    return conversationItem.conversationParticipant?.accountId === this.account.id ||
      this.conversation.accountConversationRoles.indexOf(ConversationRole.Admin) !== -1;
  }

  public trackByconversationItem(index, conversationItem) {
    return conversationItem.id;
  }

  public conversationItemDelete(conversationItem): void {
    this._prompt.confirm({
      title: 'Confirm',
      template: 'Are you sure that you want to delete the message?',
    })
      .pipe(
        switchMap(() => {
          return this.conversationService
            .conversationConfig.conversationItemDelete(conversationItem)
            .pipe(
              tap(() => {
                this.conversationService.sendMessageNotice(this.conversation.id, this.account.id);
              }),
            );
        }),
        takeUntil(this._destroy$),
      )
      .subscribe(() => {
        conversationItem.state = ConversationState.Deleted;
        this.reload();
        this.conversationChange.emit();
        this._cdRef.markForCheck();
      });
  }

  public fileDownload(conversationItem, fileItem): void {
    this.conversationService.conversationConfig
      .conversationItemFileDownload(conversationItem, fileItem.id);
  }

  public filesDownload(conversationItem: ConversationItem): void {
    conversationItem.conversationItemFiles
      .forEach((conversationItemFile) => {
        this.conversationService.conversationConfig.conversationItemFileDownload(
          conversationItem,
          conversationItemFile.id,
        );
      });
  }

  public ngOnDestroy(): void {
    this._destroy$.next(null);
    this._destroy$.complete();
  }

  public getActiveConversationParticipant(): Account {
    return this.conversation.conversationParticipants
      .find((conversationParticipant) => {
        return conversationParticipant.accountId === this.account.id;
      });
  }

}
