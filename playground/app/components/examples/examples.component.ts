import { Component } from '@angular/core';
import { environment } from '@env';
import { FsExampleModule } from '@firestitch/example';
import { ConversationsComponent } from '../conversations/conversations.component';


@Component({
    templateUrl: 'examples.component.html',
    standalone: true,
    imports: [FsExampleModule, ConversationsComponent]
})
export class ExamplesComponent {
  public config = environment;
}
