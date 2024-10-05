import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';

import { FsPopoverRef } from '@firestitch/popover';

import { forkJoin, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ConversationService } from '../../services';
import { Account, Conversation, ConversationItem, ConversationParticipant } from '../../types';


@Component({
  selector: 'app-conversation-read-participants-popover',
  templateUrl: './conversation-read-participants-popover.component.html',
  styleUrls: ['./conversation-read-participants-popover.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationReadParticipantsPopoverComponent implements OnInit, OnDestroy {

  @Input() public conversation: Conversation;
  @Input() public conversationItem: ConversationItem;
  @Input() public conversationService: ConversationService;
  @Input() public account: Account;
  @Input() public popover: FsPopoverRef;

  public conversationParticipants: ConversationParticipant[];
  public readCount;

  private _destroy$ = new Subject();

  constructor(
    private _cdRef: ChangeDetectorRef,
  ) {}

  public ngOnInit(): void {
    forkJoin({
      readCount: this.conversationService.conversationConfig
        .conversationItemsGet(this.conversation, {
          conversationItemId: this.conversationItem.id,
          conversationParticipantsReadCounts: true,
          conversationParticipantsReadCountNotAccountId: this.account.id,
          conversationParticipantsReadCountNotCreator: true,
        }),
      conversationParticipants: this.conversationService.conversationConfig
        .conversationParticipantsGet(this.conversation, {
          maxReadConversationItemId: this.conversationItem.id,
          limit: 5,
          notAccountId: this.account.id,
          notConversationParticipantId: this.conversationItem.conversationParticipantId,
          accounts: true,
          accountAvatars: true,
        }),
    })
      .pipe(
        takeUntil(this._destroy$),
      )
      .subscribe((response) => {
        const conversationItem = response.readCount.conversationItems[0];
        this.readCount = conversationItem?.conversationParticipantsReadCount;
        this.conversationParticipants = response.conversationParticipants.conversationParticipants;
        this._cdRef.markForCheck();
        this.popover.show();
      });
  }

  public ngOnDestroy(): void {
    this._destroy$.next(null);
    this._destroy$.complete();
  }

}
