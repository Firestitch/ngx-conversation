import {
  Component,
  ChangeDetectionStrategy,
  Input,
  Optional,
  OnInit,
} from '@angular/core';

import { ConversationParticipantType } from '../../enums';
import { ConversationService } from '../../services';


@Component({
  selector: 'app-conversation-participant',
  templateUrl: './conversation-participant.component.html',
  styleUrls: ['./conversation-participant.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationParticipantComponent implements OnInit {

  @Input() public conversationParticipant;
  @Input() public showName = false;
  @Input() public showBadge = false;
  @Input() public showTooltip = false;
  @Input() public size = 28;
  @Input() public service: ConversationService;

  public name;
  public account;

  // Service depends of context. It is provided on root conversations component level
  // So we are loosing injectable context within dialogs and need to provide service manually.
  public get conversationService(): ConversationService {
    return this._conversationService || this.service;
  }
  
  constructor(
    @Optional() private _conversationService: ConversationService,
  ) { }

  public ngOnInit(): void {
    if (this.conversationParticipant?.type === ConversationParticipantType.Account) {
      this.name = `${this.conversationParticipant.account?.firstName} ${this.conversationParticipant.account?.lastName}`;
      this.account = this.conversationService.mapAccount(this.conversationParticipant.account);
    }
  }

}
