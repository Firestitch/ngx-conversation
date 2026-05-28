import { NgModule } from '@angular/core';

import { FsConversationsComponent } from './components/conversations';
import {
  ConversationHeaderDirective,
  ConversationSettingsDirective,
  ConversationsConversationDirective,
  ConversationsConversationNameDirective,
} from './directives';


@NgModule({
  imports: [
    FsConversationsComponent,
    ConversationSettingsDirective,
    ConversationsConversationDirective,
    ConversationHeaderDirective,
    ConversationsConversationNameDirective,
  ],
  exports: [
    FsConversationsComponent,
    ConversationSettingsDirective,
    ConversationsConversationDirective,
    ConversationHeaderDirective,
    ConversationsConversationNameDirective,
  ],
})
export class FsConversationModule { }
