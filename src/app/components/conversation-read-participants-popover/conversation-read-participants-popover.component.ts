import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit, inject } from '@angular/core';

import { FsPopoverRef } from '@firestitch/popover';

import { forkJoin, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ConversationService } from '../../services';
import { Account, Conversation, ConversationItem, ConversationParticipant } from '../../types';
import { ConversationParticipantComponent } from '../conversation-participant/conversation-participant.component';


@Component({
    selector: 'app-conversation-read-participants-popover',
    templateUrl: './conversation-read-participants-popover.component.html',
    styleUrls: ['./conversation-read-participants-popover.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [ConversationParticipantComponent],
})
export class ConversationReadParticipantsPopoverComponent implements OnInit, OnDestroy {
  private _cdRef = inject(ChangeDetectorRef);


  @Input() public conversation: Conversation;
  @Input() public conversationItem: ConversationItem;
  @Input() public conversationService: ConversationService;
  @Input() public account: Account;
  @Input() public popover: FsPopoverRef;

  public conversationParticipants: ConversationParticipant[];
  public readCount;

  private _destroy$ = new Subject();

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
