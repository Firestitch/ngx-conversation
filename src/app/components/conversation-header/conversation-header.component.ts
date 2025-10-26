import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';

import { MatDialog } from '@angular/material/dialog';

import { list } from '@firestitch/common';
import { ButtonStyle, FilterConfig, ItemType, FilterComponent } from '@firestitch/filter';

import { Subject } from 'rxjs';

import { ConversationStates } from '../../consts';
import { ConversationItemState } from '../../enums';
import { hasAdminRole } from '../../helpers';
import { ConversationService } from '../../services';
import { Conversation, ConversationAction } from '../../types';
import { ParticipantsAddComponent } from '../participants-add';
import { NgTemplateOutlet } from '@angular/common';
import { MatIconAnchor, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { ConversationsListParticipantsComponent } from '../conversation-list-participants/conversation-list-participants.component';
import { FsMenuModule } from '@firestitch/menu';


@Component({
    selector: 'app-conversation-header',
    templateUrl: './conversation-header.component.html',
    styleUrls: ['./conversation-header.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        NgTemplateOutlet,
        MatIconAnchor,
        MatIcon,
        ConversationsListParticipantsComponent,
        FilterComponent,
        MatIconButton,
        FsMenuModule,
    ],
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
    private _cdRef: ChangeDetectorRef,
  ) { }

  public ngOnInit(): void {
    this.initConversationActions();
    this.filterConf = {
      persist: false,
      chips: false,
      queryParam: false,
      button: {
        style: ButtonStyle.Icon,
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

  public initConversationActions(): void {
    this.conversationActions = this.conversationService.conversationConfig
      .conversationActions
      .filter((conversationAction) => {
        return !conversationAction.show || conversationAction.show(this.conversation);
      });
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
    action.click(this.conversation)
      .subscribe((conversation) => {
        // CC-T2691 (Conversation participants blinking with wrong data)
        // Save query return not all required nested objects
        // Full object reload at the level above so no sense to do it here
        // this.conversation = {
        //   ...this.conversation,
        //   ...conversation,
        // };

        this.conversationChange.emit({
          ...this.conversation,
          ...conversation,
        });
        this.initConversationActions();
        this._cdRef.markForCheck();
      });
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
    this._destroy$.next(null);
    this._destroy$.complete();
  }

}
