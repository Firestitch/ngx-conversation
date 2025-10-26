import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';

import { MatDialog } from '@angular/material/dialog';

import { FsListActionSelected, FsListComponent, FsListConfig, FsListColumnDirective, FsListCellDirective } from '@firestitch/list';
import { FsPrompt } from '@firestitch/prompt';
import { SelectionActionType } from '@firestitch/selection';

import { Subject, of } from 'rxjs';
import { filter, map, switchMap, tap } from 'rxjs/operators';

import { FsMessage } from '@firestitch/message';
import { ConversationService } from '../../services';
import { Conversation, ConversationParticipant } from '../../types';
import { ParticipantsAddComponent } from '../participants-add';
import { FsBadgeModule } from '@firestitch/badge';


@Component({
    selector: 'app-participants-list',
    templateUrl: './participants-list.component.html',
    styleUrls: ['./participants-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        FsListComponent,
        FsListColumnDirective,
        FsListCellDirective,
        FsBadgeModule,
    ],
})
export class ParticipantsListComponent implements OnInit, OnDestroy {

  @Input() public conversation: Conversation = null;
  @Input() public conversationService: ConversationService;

  public conversationParticipants: ConversationParticipant[] = [];

  public listConfig: FsListConfig = null;

  @ViewChild(FsListComponent)
  private _list: FsListComponent = null;

  private _destroy$ = new Subject<void>();

  constructor(
    private _dialog: MatDialog,
    private _prompt: FsPrompt,
    private _message: FsMessage,
  ) { }

  public reload(): void {
    this._list.reload();
  }

  public ngOnInit(): void {
    this.listConfig = {
      paging: false,
      reload: false,
      actions: [
        {
          click: () => {
            this._dialog.open(ParticipantsAddComponent, {
              data: {
                conversationParticipants: this.conversationParticipants,
                conversation: this.conversation,
                conversationService: this.conversationService,
              },
            })
              .afterClosed()
              .pipe(
                filter((response) => !!response),
              )
              .subscribe(() => {
                this.reload();
              });
          },
          label: 'Add',
        },
      ],
      selection: {
        actions: [
          {
            name: 'remove',
            label: 'Remove',
            type: SelectionActionType.Action,
          },
        ],
        actionSelected: (actionSelected: FsListActionSelected) => {
          return of(true)
            .pipe(
              switchMap(() => actionSelected.action.name === 'remove' ?
                this._prompt.confirm({
                  title: 'Remove Participants',
                  template: 'Are you sure you want to remove these participants from this conversation?',
                }) : of(true)),
              switchMap(() => {
                const data = {
                  action: actionSelected.action.name,
                  conversationParticipantIds: actionSelected.selected
                    .map((conversationParticipant) => conversationParticipant.id),
                };

                return this.conversationService.conversationConfig
                  .conversationParticipantBulk(this.conversation, data)
                  .pipe(tap(() => {
                    this.conversationService.sendMessageNotice(this.conversation.id);
                  }));

              }),
              tap(() => {
                this.reload();
              }),
            );
        },
        selectAll: false,
      },
      rowActions: [
        {
          click: (conversationParticipant) => {
            return this.conversationService.conversationConfig
              .conversationParticipantDelete(this.conversation, conversationParticipant)
              .pipe(tap(() => {
                this.conversationService.sendMessageNotice(this.conversation.id);
                this._list.list.actions.updateDisabledState();
                this._updateSelectionVisibility(this._list.getData());
              }));
          },
          show: () => {
            return this._list.getData().length > 1;
          },
          remove: true,
          label: 'Remove',
        },
      ],
      fetch: (query) => {
        query = {
          ...query,
          accounts: true,
          accountAvatars: true,
        };

        return this.conversationService.conversationConfig
          .conversationParticipantsGet(this.conversation, query)
          .pipe(
            map((response) => {
              return {
                data: response.conversationParticipants
                  .map((conversationParticipant) => {
                    return {
                      ...conversationParticipant,
                      account: this.conversationService.mapAccount(conversationParticipant.account),
                    };
                  }),
                paging: response.paging,
              };
            }),
            tap((response) => {
              this._updateSelectionVisibility(response.data);
            }),
          );
      },
    };
  }

  public ngOnDestroy(): void {
    this._destroy$.next(null);
    this._destroy$.complete();
  }

  private _updateSelectionVisibility(data): void {
    if (data?.length > 1) {
      this._list.enableSelection();
    } else {
      this._list.disableSelection();
    }
  }

}
