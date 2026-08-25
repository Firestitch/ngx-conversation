import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, inject } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';

import { FsGalleryConfig, FsGalleryItem, MimeType, ThumbnailScale, FsGalleryModule } from '@firestitch/gallery';
import { FsPrompt } from '@firestitch/prompt';

import { Observable, of, Subject, timer } from 'rxjs';
import { delay, filter, finalize, map, shareReplay, switchMap, takeUntil, tap, withLatestFrom } from 'rxjs/operators';

import {
  ConversationItemState, ConversationItemType, ConversationRole, ConversationState,
} from '../../enums';
import { ConversationService } from '../../services';
import {
  Account, Conversation, ConversationItem, ConversationParticipant, ConversationThreadItem,
} from '../../types';
import { ConversationReadParticipantsDialogComponent } from '../conversation-read-participants-dialog';
import { NgClass, NgTemplateOutlet, AsyncPipe } from '@angular/common';
import { ConversationParticipantComponent } from '../conversation-participant/conversation-participant.component';
import { FsDateModule } from '@firestitch/date';
import { FsPopoverModule } from '@firestitch/popover';
import { MatIcon } from '@angular/material/icon';
import { FsMenuModule } from '@firestitch/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { FsLinkModule } from '@firestitch/link';
import { MatIconButton } from '@angular/material/button';
import { FsHtmlRendererModule } from '@firestitch/html-editor';
import { ConversationReadParticipantsPopoverComponent } from '../conversation-read-participants-popover/conversation-read-participants-popover.component';


@Component({
    selector: 'app-conversation-items',
    templateUrl: './conversation-items.component.html',
    styleUrls: ['./conversation-items.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        NgClass,
        ConversationParticipantComponent,
        FsDateModule,
        FsPopoverModule,
        MatIcon,
        FsMenuModule,
        MatTooltip,
        FsLinkModule,
        FsGalleryModule,
        NgTemplateOutlet,
        MatIconButton,
        FsHtmlRendererModule,
        ConversationReadParticipantsPopoverComponent,
        AsyncPipe,
    ],
})
export class ConversationItemsComponent implements OnInit, OnChanges, OnDestroy {
  private _cdRef = inject(ChangeDetectorRef);
  private _prompt = inject(FsPrompt);
  private _dialog = inject(MatDialog);


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
  public conversationItems: ConversationThreadItem[] = [];

  private _destroy$ = new Subject();
  private _read$: Observable<ConversationThreadItem[]>;
  private _readGeneration = 0;

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

    // The fallback for a build with no socket, or one whose socket cannot
    // connect. It keeps running while the socket is up rather than being torn
    // down, so a connection dropping mid-thread costs at most one interval
    // rather than every message after it.
    timer(0, 5000)
      .pipe(
        filter(() => this.autoload),
        withLatestFrom(this.conversationService.connected$),
        filter(([, connected]: [number, boolean]) => !connected),
        takeUntil(this._destroy$),
      )
      .subscribe(() => {
        this.load();
        this._cdRef.markForCheck();
      });
  }

  /**
   * The thread follows whichever conversation it is given.
   *
   * Nothing else refetches on a swap: opening another conversation replaces
   * this input in place, and without this the messages stay on the thread
   * before it — one conversation's header over another's replies. It used to
   * work only because the pane blanked its conversation and set it back a tick
   * later, destroying and rebuilding this component to force the read.
   *
   * Keyed on the id rather than the object. The pane replaces the row it was
   * handed with the fuller conversation the API returns, and that is the same
   * thread — reloading on it would cost a second read of every thread opened.
   */
  public ngOnChanges(changes: SimpleChanges): void {
    const conversation = changes.conversation;

    if (!conversation || conversation.firstChange) {
      return;
    }

    if (conversation.previousValue?.id !== conversation.currentValue?.id) {
      this.reload();
    }
  }

  /**
   * Throw the thread away and read it from the top. Costs the whole
   * conversation, so it is for when what is already held may be wrong — the
   * conversation changed, or an item was edited or removed. New messages
   * arriving want load(), which asks only for what it does not have.
   *
   * The read cursor deliberately survives. It records what this account has
   * been told it read, which refetching the same messages does not change.
   */
  public reload(): void {
    // Anything in flight was asked for against the thread being thrown away.
    // Its cursor is the old head, and on a conversation swap its rows belong to
    // the conversation being left — either way it must not land in the fresh
    // thread, and the caller waiting on it must not be handed it as this one.
    this._readGeneration++;
    this._read$ = null;
    this.conversationItems = [];
    this.load();
  }

  public load(): void { 
    this.load$()
      .subscribe();
  }

  /**
   * Read forward from what the thread already holds — and hand back the read
   * already in flight when there is one, rather than starting a second.
   *
   * A single send asks for this twice: the send's own refresh when the POST
   * resolves, and the socket echo of that same write, which the server
   * broadcasts to every subscriber of the thread including the sender. The
   * cursor is the id of the head message, read when the request is built, so
   * the second read used to be built before the first had landed — both asked
   * for everything after the same head, both came back with the new message,
   * and both prepended it. Sharing the outstanding read leaves one request, and
   * whichever caller asks second waits on it instead of reading from a cursor
   * that is about to move.
   */
  public load$(): Observable<ConversationThreadItem[]> {
    if (!this._read$) {
      this._read$ = this._read()
        .pipe(
          finalize(() => {
            this._read$ = null;
          }),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
    }

    return this._read$;
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
            .conversationConfig.conversationItemDelete(conversationItem);
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

  /**
   * The request itself. The cursor is fixed here, when the request is built —
   * load$() is what keeps two of these from being built against the same one.
   */
  private _read(): Observable<ConversationThreadItem[]> {
    const readGeneration = this._readGeneration;

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

          // Nothing lands in a thread that was thrown away while this was in
          // flight: the cursor is the head of a list that no longer exists,
          // and on a conversation swap these rows belong to the conversation
          // being left. It still emits — the read that reload() started in its
          // place fills the thread, and callers waiting on this one, the first
          // load among them, are not left waiting forever.
          if (readGeneration !== this._readGeneration) {
            return;
          }

          // Only what the thread does not already hold. A read is a range, not
          // a delta — anything racing it, or retried, or arriving from a second
          // participant mid-read, comes back carrying messages already on
          // screen, and prepending those draws them a second time. The ids are
          // also the template's track keys, so a duplicate in the array is a
          // duplicate key.
          const heldIds = new Set(
            this.conversationItems
              .map((conversationItem) => conversationItem.id),
          );

          const newConversationItems = conversationItems
            .filter((conversationItem) => !heldIds.has(conversationItem.id));

          // if participants added/removed trigger a conversation reload
          if (this.conversationItems.length > 0
            && newConversationItems.some((conversationItem) => {
              return [ConversationItemType.ParticipantAdd, ConversationItemType.ParticipantRemoved]
                .indexOf(conversationItem.type) !== -1;
            })
          ) {
            this.conversationChange.emit(this.conversation);
          }
  
          this.conversationItems = [
            ...newConversationItems,
            ...this.conversationItems,
          ];
  
          const lastConversationItem = this.conversationItems[0];

          // Compared by id, not by identity. Every load maps its rows into new
          // objects, so an identity check is never equal and marks the thread
          // read after every single load — including the loads that a read
          // itself caused, because marking read announces the conversation
          // changed. That is a write loop the server keeps feeding.
          if (lastConversationItem && lastConversationItem.id !== this.lastConversationItem?.id) {
            this.conversationService.conversationConfig
              .conversationRead(this.conversation, lastConversationItem)
              .subscribe();
          }
  
          this.lastConversationItem = lastConversationItem;
          this._cdRef.markForCheck();
        }),
      );
  }

}
