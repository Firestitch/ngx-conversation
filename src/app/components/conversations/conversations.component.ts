import { AfterContentInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ContentChild, EventEmitter, Input, OnDestroy, OnInit, Output, TemplateRef, ViewChild, inject } from '@angular/core';

import { getCurrentDevice } from '@firestitch/device';
import { FsResizeComponent, FsResizePanelComponent } from '@firestitch/resize';
import { Observable, Subject } from 'rxjs';
import { switchMap, take, tap } from 'rxjs/operators';

import { ConversationHeaderDirective, ConversationSettingsDirective, ConversationsConversationDirective, ConversationsConversationNameDirective } from '../../directives';
import { ConversationService } from '../../services';
import { Account, Conversation, ConversationConfig } from '../../types';
import { ConversationPaneComponent } from '../conversation-pane';
import { ConversationsPaneComponent } from '../conversations-pane';
import { NgClass } from '@angular/common';
import { ConversationsPaneComponent as ConversationsPaneComponent_1 } from '../conversations-pane/conversations-pane.component';
import { ConversationPaneComponent as ConversationPaneComponent_1 } from '../conversation-pane/conversation-pane.component';


@Component({
    selector: 'fs-conversations',
    templateUrl: './conversations.component.html',
    styleUrls: ['./conversations.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [ConversationService],
    standalone: true,
    imports: [
        NgClass,
        FsResizeComponent,
        FsResizePanelComponent,
        ConversationsPaneComponent_1,
        ConversationPaneComponent_1,
    ],
})
export class FsConversationsComponent implements OnInit, OnDestroy, AfterContentInit, OnInit {
  private _conversationService = inject(ConversationService);
  private _cdRef = inject(ChangeDetectorRef);


  @ContentChild(ConversationHeaderDirective, { read: TemplateRef })
  public conversationHeadingTemplate: TemplateRef<any>;

  @ContentChild(ConversationSettingsDirective, { read: TemplateRef })
  public conversationSettingTemplate: TemplateRef<any>;

  @ContentChild(ConversationsConversationDirective, { read: TemplateRef })
  public conversationsConversationTemplate: TemplateRef<any>;

  @ContentChild(ConversationsConversationNameDirective, { read: TemplateRef })
  public conversationsConversationNameTemplate: TemplateRef<any>;

  @ViewChild(ConversationPaneComponent)
  public conversationPane: ConversationPaneComponent;

  @ViewChild(ConversationsPaneComponent)
  public conversationsPane: ConversationsPaneComponent;

  @ViewChild('conversationsResizePanel')
  public conversationsResizePanel: FsResizePanelComponent;

  @Input() public config: ConversationConfig;
  @Input() public account: Account;

  @Output() public conversationOpened = new EventEmitter();

  public conversation: Conversation;
  public mobile = false;

  // What the list is given the moment a conversation opens beside it, and
  // whatever it was last dragged to after that, so reopening does not throw the
  // width away. It is handed back to the panel as a declared size rather than
  // kept as an inline one, because closing has to be able to drop it.
  public conversationsPaneWidth = 500;

  private _destroy$ = new Subject<void>();

  public get conversationConfig(): ConversationConfig {
    return this._conversationService.conversationConfig;
  }

  public get conversationService(): ConversationService {
    return this._conversationService;
  }

  public ngOnInit(): void {
    this._conversationService.conversationConfig = this.config;
    this.mobile = getCurrentDevice().mobile;

    this.conversationService.initStartConversation()
      .subscribe(() => this._cdRef.markForCheck());
  }

  public ngAfterContentInit(): void {
    this._conversationService.conversationSettingTemplate = this.conversationSettingTemplate;
    this._conversationService.conversationHeadingTemplate = this.conversationHeadingTemplate;
  }

  public ngOnDestroy(): void {
    this._destroy$.next(null);
    this._destroy$.complete();
  }

  public conversationsPaneResized(sizes: number[]): void {
    this.conversationsPaneWidth = sizes[0] ?? this.conversationsPaneWidth;
  }

  public conversationChange(): void {
    if(this.conversationsPane) {
      this.conversationsPane.loadStats();
      this.conversationsPane.reload();
      this.conversationsPane.scrollTop();
    }
  }

  public conversationClose(reload = false): void {
    this.conversation = null;

    // A drag leaves the width on the panel itself, where it would outlive the
    // conversation it was sized against. Resetting hands the panel back to its
    // declared size — null with nothing open — so the list fills the pane again.
    this.conversationsResizePanel?.reset();
    this.conversationsPane.deselect();

    if (reload) {
      this.conversationsPane.reload();
    }
  }

  public conversationStarted(conversation: Conversation): void {
    this._conversationOpen(conversation)
      .pipe(
        take(1),
        switchMap(() => {
          return this.conversationOpened.asObservable()
            .pipe(
              take(1),
            );
        }),
        switchMap(() => this.conversationService.startConversation.afterOpen(conversation)),
      )
      .subscribe();
  }

  public conversationOpen(conversation: Conversation): void {
    // if (!conversation) {
    //   this.conversation = conversation;
    //   this.conversationsPane.reload();
    //   this._cdRef.markForCheck();

    //   return;
    // }

    if(this.conversation?.id !== conversation.id) {
      this._conversationOpen(conversation)
        .subscribe();
    }
  }

  private _conversationOpen(conversation: Conversation): Observable<any> {
    return this.conversationService.openConversation.beforeOpen(conversation)
      .pipe(
        tap(() => {
          this.conversation = conversation;
          this._cdRef.markForCheck();
        }),
      );
  }

}
