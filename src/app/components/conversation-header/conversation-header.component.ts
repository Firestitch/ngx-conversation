import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';

import { MatDialog } from '@angular/material/dialog';

import { list } from '@firestitch/common';
import { FilterConfig, ItemType } from '@firestitch/filter';

import { Subject } from 'rxjs';

import { ConversationStates } from '../../consts';
import { ConversationItemState } from '../../enums';
import { hasAdminRole } from '../../helpers';
import { ConversationService } from '../../services';
import { Conversation, ConversationAction } from '../../types';
import { ParticipantsAddComponent } from '../participants-add';


@Component({
  selector: 'app-conversation-header',
  templateUrl: './conversation-header.component.html',
  styleUrls: ['./conversation-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationHeaderComponent implements OnDestroy, OnInit {

  @Input() public conversation: Conversation;
  @Input() public conversationService: ConversationService;

  @Output() public conversationChange = new EventEmitter<Conversation>();
  @Output() public conversationClose = new EventEmitter<Conversation>();
  @Output() public filterChanged = new EventEmitter<{ query: any; sort: any }>();
  @Output() public openSettings = new EventEmitter<string>();

  public ConversationStates = ConversationStates;
  public conversationStates = list(ConversationStates, 'name', 'value');
  public filterConf: FilterConfig;
  public conversationActions = [];

  private _destroy$ = new Subject();

  constructor(
    private _dialog: MatDialog,
  ) { }

  public ngOnInit(): void {
    this.conversationActions = this.conversationService.conversationConfig
      .conversationActions
      .filter((conversationAction) => {
        return !conversationAction.show || conversationAction.show(this.conversation);
      });

    this.filterConf = {
      persist: false,
      inline: false,
      chips: false,
      queryParam: false,
      button: {
        style: 'icon',
        label: '',
      },
      change: (query, sort) => {
        this.filterChanged.emit({ query, sort });
      },
      items: [
        {
          name: 'state',
          type: ItemType.Checkbox,
          label: 'Show Deleted',
          unchecked: ConversationItemState.Active,
          checked: [
            ConversationItemState.Deleted,
            ConversationItemState.Active,
          ]
            .join(','),
        },
      ],
    };
  }

  public settingsClicked(tab: string = null): void {
    if (!this.hasAdminRole) {
      return;
    }

    this.openSettings.emit(tab);
  }

  public get hasAdminRole(): boolean {
    return hasAdminRole(this.conversation);
  }

  public actionClick(action: ConversationAction): void {
    action.click(this.conversation);
  }

  public participantAdd(): void {
    this._dialog.open(ParticipantsAddComponent, {
      data: {
        conversation: this.conversation,
        conversationService: this.conversationService,
      },
    })
      .afterClosed()
      .subscribe(() => {
        this.conversationChange.emit();
      });
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

}
