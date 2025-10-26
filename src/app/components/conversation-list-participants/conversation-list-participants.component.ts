import {
  ChangeDetectionStrategy,
  Component,
  Input,
  TemplateRef,
} from '@angular/core';

import { Conversation } from '../../types';
import { NgStyle, NgClass, NgTemplateOutlet } from '@angular/common';
import { MatTooltip } from '@angular/material/tooltip';
import { ConversationParticipantComponent } from '../conversation-participant/conversation-participant.component';
import { FsDateModule } from '@firestitch/date';
import { ConversationBadgeNamePipe } from '../../pipes/conversation-badge-name.pipe';
import { ConversationNamePipe } from '../../pipes/conversation-name.pipe';


@Component({
    selector: 'app-conversation-list-participants',
    templateUrl: './conversation-list-participants.component.html',
    styleUrls: ['./conversation-list-participants.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        NgStyle,
        NgClass,
        NgTemplateOutlet,
        MatTooltip,
        ConversationParticipantComponent,
        FsDateModule,
        ConversationBadgeNamePipe,
        ConversationNamePipe,
    ],
})
export class ConversationsListParticipantsComponent {

  @Input()
  public conversation: Conversation;

  @Input()
  public conversationsConversationNameTemplate: TemplateRef<any>;

  @Input()
  public hideLastConversationItemInfo: boolean;

  @Input()
  public size: number;

  constructor() { }


}
