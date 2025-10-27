import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, TemplateRef, ViewChild, inject } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';

import { format } from '@firestitch/date';
import { ItemType } from '@firestitch/filter';
import { FsListComponent, FsListConfig, PaginationStrategy, FsListColumnDirective, FsListCellDirective, FsListContentDirective } from '@firestitch/list';
import { FsMessage } from '@firestitch/message';

import { Subject, of, timer } from 'rxjs';
import { filter, map, switchMap, takeUntil, tap } from 'rxjs/operators';

import { ConversationRole, ConversationState } from '../../enums';
import { ConversationService } from '../../services';
import { Conversation, ConversationAction, ConversationConfig } from '../../types';
import { ConversationCreateComponent } from '../conversation-create';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { MatTooltip } from '@angular/material/tooltip';
import { MatTabGroup, MatTab, MatTabLabel } from '@angular/material/tabs';
import { FsTabsModule } from '@firestitch/tabs';
import { ConversationsListParticipantsComponent } from '../conversation-list-participants/conversation-list-participants.component';


@Component({
    selector: 'app-conversations-pane',
    templateUrl: './conversations-pane.component.html',
    styleUrls: ['./conversations-pane.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        FsListComponent,
        NgClass,
        FsListColumnDirective,
        FsListCellDirective,
        NgTemplateOutlet,
        MatTooltip,
        FsListContentDirective,
        MatTabGroup,
        FsTabsModule,
        MatTab,
        MatTabLabel,
        ConversationsListParticipantsComponent,
    ],
})
export class ConversationsPaneComponent implements OnInit, OnDestroy {
  private _dialog = inject(MatDialog);
  private _message = inject(FsMessage);
  private _conversationService = inject(ConversationService);
  private _cdRef = inject(ChangeDetectorRef);
  private _el = inject(ElementRef);


  @Input() public conversationHeadingTemplate: TemplateRef<any>;
  @Input() public conversationSettingTemplate: TemplateRef<any>;
  @Input() public conversationsConversationTemplate: TemplateRef<any>;
  @Input() public conversationsConversationNameTemplate: TemplateRef<any>;
  @Input() public account;

  @Output() public conversationOpen = new EventEmitter<Conversation>();
  @Output() public conversationClose = new EventEmitter<boolean>();
  @Output() public conversationStarted = new EventEmitter<Conversation>();

  @ViewChild(FsListComponent)
  public listComponent: FsListComponent;

  @ViewChild('list', { read: ElementRef })
  public listEl: ElementRef;

  public selectedConversation: Conversation;
  public listConfig: FsListConfig;
  public tab: 'account' | 'open' | 'closed' | string;
  public conversationsStats = {
    account: { count: 0, unread: 0 },
    open: { count: 0, unread: 0 },
    closed: { count: 0, unread: 0 },
  };

  private _destroy$ = new Subject<void>();
  private _converstationsReloadInterval;

  public get conversationConfig(): ConversationConfig {
    return this._conversationService.conversationConfig;
  }

  public get conversationService(): ConversationService {
    return this._conversationService;
  }

  public reload(): void {
    this.listComponent.reload();
  }

  public deselect(): void {
    this.selectedConversation = null;
    this.listComponent.getData()
      .forEach((converstation) => {
        this.listComponent.updateData(converstation, (row) => row.id === converstation.id);
      });
  }

  public scrollTop(): void {
    this._el.nativeElement
      .querySelector('.fs-list-table-container')
      .scrollTo(0,0);
  }

  public tabChange(tab): void {
    this.tab = tab;
    this.reload();
    this.scrollTop();
  }

  public initStatsReload(): void {
    timer(0, this._converstationsReloadInterval)
      .pipe(
        takeUntil(this._destroy$),
      )
      .subscribe(() => {
        this.loadStats();
      });
  }

  public initConverstationsReload(): void {
    timer(this._converstationsReloadInterval, this._converstationsReloadInterval)
      .pipe(
        filter(() => !this._conversationService.hasWebSocketConnection() && this.listComponent.list.paging.page === 1),
        takeUntil(this._destroy$),
      )
      .subscribe(() => {
        this.reload();
      });
  }

  public ngOnInit(): void {
    this._converstationsReloadInterval = (this.conversationConfig.converstationsReloadInterval || 30) * 1000;
    this.initStatsReload();
    this.initConverstationsReload();

    const conversationsFilters = this.conversationConfig.conversationsFilters || [];

    if(this.conversationService.tabs.account) {
      this.tab = 'account';
    } else if(this.conversationService.tabs.open) {
      this.tab = 'open';
    } else if(this.conversationService.tabs.closed) {
      this.tab = 'closed';
    }

    this.listConfig = {
      loadMore: true,
      status: false,
      queryParam: false,
      rowClass: (row) => {
        return this.selectedConversation?.id === row.id ? 'selected' : '';
      },
      paging: {
        limit: 30,
        strategy: PaginationStrategy.Offset,
      },
      filters: [
        {
          name: 'keyword',
          type: ItemType.Keyword,
          label: 'Search',
        },
        ...conversationsFilters,
      ],
      noResults: {
        message: 'No conversations found',
      },
      actions: [
        {
          label: 'Start',
          disabled: () => {
            return this.conversationService.startConversation.disabled;
          },
          show: () => {
            return this.conversationService.startConversation.show;
          },
          click: () => {
            this.conversationStart();
          },
          tooltip: this._conversationService.startConversation.tooltip,
        },
      ],
      rowActions: [
        ...(this.conversationConfig.conversationActions || [])
          .map((conversationAction: ConversationAction)=> {
            return {
              ...conversationAction,
              click: (conversation: Conversation) => {
                conversationAction.click(conversation)
                  .subscribe((response) => {
                    this.listComponent
                      .updateData(response, (row) => row.id === response.id);
                  });
              },
            };
          }),
        {
          click: (conversation) => {
            return this.conversationConfig.conversationSave({
              id: conversation.id,
              state: ConversationState.Closed,
            })
              .pipe(
                tap(() => {
                  this.loadStats();
                  if (this.selectedConversation?.id === conversation.id) {
                    this.conversationClose.emit(true);
                  }
                }),
              );
          },
          show: (conversation) => {
            return conversation.accountConversationRoles
              .indexOf(ConversationRole.Admin) !== -1 && conversation.state === ConversationState.Open;
          },
          remove: {
            title: 'Confirm',
            template: 'Are you sure you would like to close this conversation?',
          },
          label: 'Close',
        },
        {
          click: (data) => {
            return this.conversationConfig.conversationDelete(data)
              .pipe(
                tap(() => {
                  if (this.selectedConversation?.id === data.id) {
                    this.conversationClose.emit(true);
                  }
                }),
              );
          },
          show: (conversation) => {
            return conversation.accountConversationRoles.indexOf(ConversationRole.Admin) !== -1;
          },
          remove: {
            title: 'Confirm',
            template: 'Are you sure you would like to delete this conversation?',
          },
          label: 'Delete',
        },
      ],
      sort: { value: 'recentMessage', direction: 'desc' },
      sorts: [
        { name: 'Recent message', value: 'recentMessage', direction: 'desc' },
        { name: 'Activity', value: 'activityDate', direction: 'desc' },
      ],
      fetch: (query) => {
        let order = 'unread,desc';

        if(query.order) {
          order += `;${query.order}`;
        }

        query = {
          ...query,
          lastConversationItems: true,
          lastConversationItemConversationParticipants: true,
          lastConversationItemConversationParticipantAccounts: true,
          lastConversationItemConversationParticipantAccountAvatars: true,
          recentConversationParticipants: true,
          recentConversationParticipantAccounts: true,
          recentConversationParticipantAccountAvatars: true,
          unreads: true,
          accountConversationRoles: true,
          conversationParticipantCounts: true,
          lastConversationItemFiles: true,
          order,
        };

        switch (this.tab) {
          case 'account':
            query.conversationParticipantAccountId = this.account.id;
            break;

          case 'closed':
            query.state = ConversationState.Closed;
            break;

          case 'open':
            query.state = ConversationState.Open;
            break;
        }

        return this.conversationConfig.conversationsGet(query)
          .pipe(
            map((response) => {
              return {
                data: response.conversations
                  .map((conversation) => {
                    return {
                      ...conversation,
                    };
                  }), paging: response.paging,
              };
            }),
            // tap((response) => {
            //   setTimeout(() => {
            //     const converstaion: any = response.data[0];
            //     if(converstaion) {
            //       const el = this.listEl.nativeElement?.querySelector(`tbody tr .converstaion-row[data="converstaion-row-${converstaion.id}"]`);
            //       el?.scrollIntoView({ behavior: 'smooth' });
            //     }
            //   });
            // }),
          );
      },
    };

    // when notified that user has conversation updates then reload stuff
    this._conversationService.onUnreadNotice(this.account.id)
      .subscribe(() => {
        if (this.listComponent) {
          this.reload();
        }
      });
  }

  public conversationParticipantsChange(): void {
    this.reload();
  }

  public openConversation(conversation): void {
    this.selectedConversation = conversation;
    this.conversationOpen.emit(conversation);
  }

  public loadStats(): void {
    const statsFilters: any = {
      account: true,
      open: true,
      closed: true,
    };

    this.conversationConfig.conversationsStats(statsFilters)
      .subscribe((conversationsStats) => {
        this.conversationsStats = conversationsStats;
        this._cdRef.markForCheck();
      });
  }

  public conversationCreate(conversation: Conversation = { id: null }): void {
    this._dialog.open(ConversationCreateComponent, {
      autoFocus: true,
      data: { conversation },
    })
      .afterClosed()
      .pipe(
        filter((response) => !!response),
        takeUntil(this._destroy$),
      )
      .subscribe((response) => {
        this.reload();
        this.conversationOpen.emit(response);
      });
  }

  public conversationStart(conversation: Conversation = {}): void {
    conversation = {
      ...conversation,
      name: format(new Date()),
    };

    of(conversation)
      .pipe(
        switchMap((_conversation) => this.conversationService
          .startConversation.beforeStart(_conversation)),
        switchMap((_conversation) => this.conversationConfig
          .conversationSave(_conversation)),
        switchMap((_conversation) => this.conversationService
          .startConversation.afterStart(_conversation)),
        takeUntil(this._destroy$),
      )
      .subscribe((_conversation) => {
        this._message.success('Saved Changes');
        this.reload();
        this.selectedConversation = _conversation;
        this.conversationStarted.emit(_conversation);
      });
  }

  public ngOnDestroy(): void {
    this._destroy$.next(null);
    this._destroy$.complete();
  }

}
