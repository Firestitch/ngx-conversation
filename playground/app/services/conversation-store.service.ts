import { Injectable, inject } from '@angular/core';

import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

import {
  ACCOUNT_CONVERSATIONS_EVENT, CONVERSATION_EVENT_ITEM, CONVERSATION_EVENT_TYPING,
  accountConversationsTopic, conversationTopic,
} from 'src/app/consts';
import {
  ConversationItemState, ConversationItemType,
  ConversationParticipantType, ConversationRole, ConversationState,
} from 'src/app/enums';
import {
  Account, Conversation, ConversationItem, ConversationParticipant,
} from 'src/app/types';

import {
  accountsData,
  ConversationItemFileRecord,
  ConversationItemRecord,
  ConversationParticipantRecord,
  ConversationRecord,
  conversationItemsData,
  conversationParticipantsData,
  conversationsData,
  sessionAccountId,
} from '../data';

import { PlaygroundWebSocket } from './playground-web-socket.service';


/** Simulated round trip, in ms. Keeps loading states visible. */
const LATENCY = 150;

/** How long a simulated participant waits before answering a message. */
const REPLY_DELAY = 4000;

/** How long before that the participant starts "typing". */
const TYPING_DELAY = 800;


const REPLIES = [
  'Got it — I will take a look this afternoon.',
  'That works for me.',
  'Can you share the link? I cannot find it in the drive.',
  'Good point, I had not considered that.',
  'Let me check with the team and come back to you.',
  'Done. Pushed the change a minute ago.',
];


/**
 * An in-memory stand-in for the conversation API.
 *
 * Every method here is a plain function over arrays that answers with an Observable,
 * which is all `ConversationConfig` ever asks for. Swapping this for a real HTTP
 * backend is a matter of pointing the config at a different set of functions.
 */
@Injectable({
  providedIn: 'root',
})
export class ConversationStoreService {

  /** Set to false to stop simulated participants from answering your messages. */
  public simulateReplies = true;

  /**
   * Grants the demo account the admin role on every conversation it participates in,
   * so the admin-only actions (settings, close, delete, add/remove participants) are
   * always reachable. Set to false to fall back to the roles in the seed data.
   */
  public sessionAdmin = true;

  public readonly sessionAccountId = sessionAccountId;

  private _socket = inject(PlaygroundWebSocket);

  private _accounts: Account[] = accountsData;
  private _conversations: ConversationRecord[] = conversationsData
    .map((row) => ({ ...row }));
  private _participants: ConversationParticipantRecord[] = conversationParticipantsData
    .map((row) => ({ ...row }));
  private _items: ConversationItemRecord[] = conversationItemsData
    .map((row) => ({ ...row, conversationItemFiles: [...row.conversationItemFiles] }));

  private _replyIndex = 0;

  public conversationsGet(query: any = {}): Observable<{ conversations: Conversation[]; paging: any }> {
    let rows = this._conversations
      .filter((row) => row.state !== ConversationState.Deleted);

    if (query.conversationId) {
      rows = rows.filter((row) => row.id === Number(query.conversationId));
    }

    if (query.state) {
      rows = rows.filter((row) => row.state === query.state);
    }

    if (query.conversationParticipantAccountId) {
      const accountId = Number(query.conversationParticipantAccountId);
      rows = rows.filter((row) => !!this._participant(row.id, accountId));
    }

    if (query.keyword) {
      rows = rows.filter((row) => this._matchesKeyword(row, query.keyword));
    }

    rows = this._sortConversations(rows, query.order);

    const paged = this._paginate(rows, query);

    return this._respond({
      conversations: paged.rows.map((row) => this._mapConversation(row)),
      paging: paged.paging,
    });
  }

  public conversationsStats(query: any = {}): Observable<any> {
    const rows = this._conversations
      .filter((row) => row.state !== ConversationState.Deleted);

    return this._respond({
      account: this._stats(rows.filter((row) => !!this._sessionParticipant(row.id))),
      open: this._stats(rows.filter((row) => row.state === ConversationState.Open)),
      closed: this._stats(rows.filter((row) => row.state === ConversationState.Closed)),
    });
  }

  public conversationSave(conversation: Conversation): Observable<Conversation> {
    if (conversation.id) {
      const row = this._conversation(conversation.id);

      if (conversation.name !== undefined) {
        row.name = conversation.name;
      }

      if (conversation.state !== undefined) {
        row.state = conversation.state;
      }

      return this._respond(this._mapConversation(row));
    }

    const id = this._nextId(this._conversations);
    const row: ConversationRecord = {
      id,
      state: ConversationState.Open,
      name: conversation.name || null,
      guid: `conversation-${id}`,
      createDate: new Date().toISOString(),
      activityDate: new Date().toISOString(),
      creatorConversationParticipantId: null,
    };

    this._conversations.push(row);

    const participant = this._addParticipant(row.id, this.sessionAccountId, true);
    row.creatorConversationParticipantId = participant.id;

    this._addItem(row.id, participant.id, ConversationItemType.Start, null);

    return this._respond(this._mapConversation(row));
  }

  public conversationDelete(conversation: Conversation): Observable<Conversation> {
    const row = this._conversation(conversation.id);
    row.state = ConversationState.Deleted;

    return this._respond(this._mapConversation(row));
  }

  public conversationRead(
    conversation: Conversation,
    conversationItem: ConversationItem,
  ): Observable<Conversation> {
    const participant = this._sessionParticipant(conversation.id);

    if (participant && conversationItem) {
      participant.readConversationItemId = Math.max(
        participant.readConversationItemId || 0,
        conversationItem.id,
      );
    }

    return this._respond(this._mapConversation(this._conversation(conversation.id)));
  }

  public conversationItemsGet(
    conversation: Conversation,
    query: any = {},
  ): Observable<{ conversationItems: ConversationItem[]; paging: any }> {
    let rows = this._items
      .filter((row) => row.conversationId === conversation.id);

    if (query.conversationItemId) {
      rows = rows.filter((row) => row.id === Number(query.conversationItemId));
    }

    if (query.maxConversationItemId) {
      rows = rows.filter((row) => row.id > Number(query.maxConversationItemId));
    }

    const states = String(query.state || '')
      .split(',')
      .filter((state) => !!state);

    rows = states.length ?
      rows.filter((row) => states.indexOf(row.state) !== -1) :
      rows.filter((row) => row.state !== ConversationItemState.Deleted);

    rows = [...rows]
      .sort((a, b) => b.id - a.id);

    const paged = this._paginate(rows, query);

    return this._respond({
      conversationItems: paged.rows.map((row) => this._mapItem(row, query)),
      paging: paged.paging,
    });
  }

  public conversationItemSave(conversationItem: ConversationItem): Observable<ConversationItem> {
    if (conversationItem.id) {
      const row = this._items
        .find((item) => item.id === conversationItem.id);

      if (conversationItem.message !== undefined) {
        row.message = conversationItem.message;
      }

      if (conversationItem.state !== undefined) {
        row.state = conversationItem.state;
      }

      return this._respond(this._mapItem(row, {}));
    }

    const participant = this._sessionParticipant(conversationItem.conversationId);
    const row = this._addItem(
      conversationItem.conversationId,
      participant?.id,
      conversationItem.type || ConversationItemType.Message,
      conversationItem.message,
      [],
      conversationItem.state,
    );

    this._scheduleReply(conversationItem.conversationId);

    return this._respond(this._mapItem(row, {}));
  }

  public conversationItemDelete(conversationItem: ConversationItem): Observable<ConversationItem> {
    const row = this._items
      .find((item) => item.id === conversationItem.id);

    row.state = ConversationItemState.Deleted;

    return this._respond(this._mapItem(row, {}));
  }

  public conversationItemFilePost(conversationItem: ConversationItem, file: Blob): Observable<any> {
    const row = this._items
      .find((item) => item.id === conversationItem.id);

    const filename = (file as File).name || 'attachment';
    const url = URL.createObjectURL(file);
    const id = this._nextFileId();

    const conversationItemFile: ConversationItemFileRecord = {
      id,
      conversationItemId: row.id,
      fileId: id,
      file: {
        id,
        filename,
        extension: filename.split('.').pop(),
        size: file.size,
        preview: { small: url, large: url },
      },
    };

    row.conversationItemFiles = [...row.conversationItemFiles, conversationItemFile];

    return this._respond(conversationItemFile);
  }

  public conversationItemFileDownload(
    conversationItem: ConversationItem,
    conversationItemFileId: number,
  ): void {
    const conversationItemFile = this._items
      .find((item) => item.id === conversationItem.id)
      ?.conversationItemFiles
      .find((file) => file.id === conversationItemFileId);

    if (!conversationItemFile) {
      return;
    }

    const link = document.createElement('a');
    link.href = conversationItemFile.file.preview.large;
    link.download = conversationItemFile.file.filename;
    link.click();
  }

  public conversationParticipantsGet(
    conversation: Conversation,
    query: any = {},
  ): Observable<{ conversationParticipants: ConversationParticipant[]; paging: any }> {
    let rows = this._activeParticipants(conversation.id);

    if (query.accountId) {
      rows = rows.filter((row) => row.accountId === Number(query.accountId));
    }

    if (query.notAccountId) {
      rows = rows.filter((row) => row.accountId !== Number(query.notAccountId));
    }

    if (query.notConversationParticipantId) {
      rows = rows.filter((row) => row.id !== Number(query.notConversationParticipantId));
    }

    if (query.maxReadConversationItemId) {
      rows = rows.filter((row) => {
        return (row.readConversationItemId || 0) >= Number(query.maxReadConversationItemId);
      });
    }

    const paged = this._paginate(rows, query);

    return this._respond({
      conversationParticipants: paged.rows.map((row) => this._mapParticipant(row)),
      paging: paged.paging,
    });
  }

  public conversationParticipantSave(
    conversation: Conversation,
    conversationParticipant: ConversationParticipant,
  ): Observable<ConversationParticipant> {
    const row = this._participants
      .find((participant) => participant.id === conversationParticipant.id);

    if (conversationParticipant.state !== undefined) {
      row.state = conversationParticipant.state;
    }

    return this._respond(this._mapParticipant(row));
  }

  public conversationParticipantSession(
    conversation: Conversation,
  ): Observable<ConversationParticipant> {
    const row = this._sessionParticipant(conversation.id);

    return this._respond(row ? this._mapParticipant(row) : null);
  }

  public conversationParticipantAdd(conversation: Conversation, data: any): Observable<any> {
    const accountIds: number[] = data.accountIds || [];
    const conversationParticipants = accountIds
      .map((accountId) => this._addParticipant(conversation.id, accountId, false));

    if (conversationParticipants.length) {
      const actor = this._sessionParticipant(conversation.id) || conversationParticipants[0];

      this._addItem(
        conversation.id,
        actor.id,
        ConversationItemType.ParticipantAdd,
        null,
        accountIds,
      );
    }

    return this._respond({
      conversationParticipants: conversationParticipants
        .map((row) => this._mapParticipant(row)),
    });
  }

  public conversationParticipantDelete(
    conversation: Conversation,
    conversationParticipant: ConversationParticipant,
  ): Observable<ConversationParticipant> {
    const rows = this._removeParticipants(conversation.id, [conversationParticipant.id]);

    return this._respond(rows.length ? this._mapParticipant(rows[0]) : null);
  }

  public conversationParticipantBulk(conversation: Conversation, data: any): Observable<any> {
    if (data.action === 'remove') {
      this._removeParticipants(conversation.id, data.conversationParticipantIds || []);
    }

    return this._respond({});
  }

  public accountsGet(
    conversation: Conversation,
    query: any = {},
  ): Observable<{ accounts: Account[]; paging: any }> {
    const participantAccountIds = this._activeParticipants(conversation.id)
      .map((participant) => participant.accountId);

    let rows = this._accounts
      .filter((account) => participantAccountIds.indexOf(account.id) === -1);

    if (query.keyword) {
      const keyword = String(query.keyword).toLowerCase();

      rows = rows.filter((account) => {
        return `${account.name} ${account.email}`.toLowerCase().indexOf(keyword) !== -1;
      });
    }

    const paged = this._paginate(rows, query);

    return this._respond({ accounts: paged.rows, paging: paged.paging });
  }

  private _respond<T>(value: T): Observable<T> {
    return of(value)
      .pipe(
        delay(LATENCY),
      );
  }

  private _conversation(conversationId: number): ConversationRecord {
    return this._conversations
      .find((conversation) => conversation.id === conversationId);
  }

  private _activeParticipants(conversationId: number): ConversationParticipantRecord[] {
    return this._participants
      .filter((participant) => {
        return participant.conversationId === conversationId && participant.state === 'active';
      });
  }

  private _participant(conversationId: number, accountId: number): ConversationParticipantRecord {
    return this._activeParticipants(conversationId)
      .find((participant) => participant.accountId === accountId);
  }

  private _sessionParticipant(conversationId: number): ConversationParticipantRecord {
    return this._participant(conversationId, this.sessionAccountId);
  }

  private _account(accountId: number): Account {
    return this._accounts
      .find((account) => account.id === accountId);
  }

  private _activeItems(conversationId: number): ConversationItemRecord[] {
    return this._items
      .filter((item) => {
        return item.conversationId === conversationId &&
          item.state !== ConversationItemState.Deleted;
      });
  }

  private _lastItem(conversationId: number): ConversationItemRecord {
    return this._activeItems(conversationId)
      .reduce((last, item) => (!last || item.id > last.id ? item : last), null);
  }

  private _unread(conversationId: number): number {
    const participant = this._sessionParticipant(conversationId);

    if (!participant) {
      return 0;
    }

    return this._activeItems(conversationId)
      .filter((item) => {
        return item.id > (participant.readConversationItemId || 0) &&
          item.conversationParticipantId !== participant.id;
      })
      .length;
  }

  private _stats(rows: ConversationRecord[]): { count: number; unread: number } {
    return {
      count: rows.length,
      unread: rows
        .reduce((unread, row) => unread + this._unread(row.id), 0),
    };
  }

  private _matchesKeyword(row: ConversationRecord, keyword: string): boolean {
    const needle = String(keyword).toLowerCase();
    const haystack = [
      row.name || '',
      ...this._activeParticipants(row.id)
        .map((participant) => this._account(participant.accountId)?.name || ''),
      ...this._activeItems(row.id)
        .map((item) => item.message || ''),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.indexOf(needle) !== -1;
  }

  private _sortConversations(rows: ConversationRecord[], order: string): ConversationRecord[] {
    const orders = String(order || 'recentMessage,desc')
      .split(';')
      .filter((item) => !!item)
      .map((item) => {
        const [name, direction] = item.split(',');

        return { name, descending: direction !== 'asc' };
      });

    return [...rows]
      .sort((a, b) => {
        for (const { name, descending } of orders) {
          const compared = this._compareConversations(a, b, name);

          if (compared !== 0) {
            return descending ? -compared : compared;
          }
        }

        return 0;
      });
  }

  private _compareConversations(
    a: ConversationRecord,
    b: ConversationRecord,
    name: string,
  ): number {
    switch (name) {
      case 'unread':
        return this._unread(a.id) - this._unread(b.id);

      case 'activityDate':
        return Date.parse(a.activityDate) - Date.parse(b.activityDate);

      case 'recentMessage':
      default: {
        const aDate = this._lastItem(a.id)?.createDate || a.createDate;
        const bDate = this._lastItem(b.id)?.createDate || b.createDate;

        return Date.parse(aDate) - Date.parse(bDate);
      }
    }
  }

  private _paginate<T>(rows: T[], query: any = {}): { rows: T[]; paging: any } {
    const limit = Number(query.limit) || rows.length;
    const offset = Number(query.offset) || 0;

    return {
      rows: rows.slice(offset, offset + limit),
      paging: {
        records: rows.length,
        limit,
        offset,
        page: Math.floor(offset / (limit || 1)) + 1,
      },
    };
  }

  private _nextId(rows: { id: number }[]): number {
    return rows
      .reduce((id, row) => Math.max(id, row.id), 0) + 1;
  }

  private _nextFileId(): number {
    return this._items
      .reduce((id, item) => {
        return item.conversationItemFiles
          .reduce((fileId, file) => Math.max(fileId, file.id), id);
      }, 0) + 1;
  }

  private _addParticipant(
    conversationId: number,
    accountId: number,
    admin: boolean,
  ): ConversationParticipantRecord {
    const existing = this._participants
      .find((participant) => {
        return participant.conversationId === conversationId &&
          participant.accountId === accountId;
      });

    if (existing) {
      existing.state = 'active';

      return existing;
    }

    const id = this._nextId(this._participants);
    const row: ConversationParticipantRecord = {
      id,
      conversationId,
      accountId,
      admin,
      state: 'active',
      type: ConversationParticipantType.Account,
      createDate: new Date().toISOString(),
      activityDate: new Date().toISOString(),
      readConversationItemId: this._lastItem(conversationId)?.id || 0,
      guid: `conversation-participant-${id}`,
    };

    this._participants.push(row);

    return row;
  }

  private _removeParticipants(
    conversationId: number,
    conversationParticipantIds: number[],
  ): ConversationParticipantRecord[] {
    const rows = this._participants
      .filter((participant) => conversationParticipantIds.indexOf(participant.id) !== -1);

    rows.forEach((row) => row.state = 'deleted');

    if (rows.length) {
      const actor = this._sessionParticipant(conversationId) || rows[0];

      this._addItem(
        conversationId,
        actor.id,
        ConversationItemType.ParticipantRemoved,
        null,
        rows.map((row) => row.accountId),
      );
    }

    return rows;
  }

  private _addItem(
    conversationId: number,
    conversationParticipantId: number,
    type: ConversationItemType,
    message: string,
    addRemoveAccountIds: number[] = [],
    state: ConversationItemState = ConversationItemState.Active,
  ): ConversationItemRecord {
    const id = this._nextId(this._items);
    const row: ConversationItemRecord = {
      id,
      conversationId,
      conversationParticipantId,
      type,
      state,
      addRemoveAccountIds,
      message: message || null,
      createDate: new Date().toISOString(),
      guid: `conversation-item-${id}`,
      conversationItemFiles: [],
    };

    this._items.push(row);

    const conversation = this._conversation(conversationId);

    if (conversation) {
      conversation.activityDate = row.createDate;
    }

    const author = this._participants
      .find((participant) => participant.id === conversationParticipantId);

    if (author) {
      author.readConversationItemId = id;
      author.activityDate = row.createDate;
    }

    return row;
  }

  /**
   * Answers a message from one of the other participants so the demo shows incoming
   * traffic — the typing indicator, unread badges and list re-ordering.
   *
   * The broadcasts are what a server would push. With the socket connected the
   * components stop polling and run entirely off them; with it disconnected the
   * broadcasts are dropped and the 5s poll picks the message up instead.
   */
  private _scheduleReply(conversationId: number): void {
    if (!this.simulateReplies) {
      return;
    }

    const responder = this._activeParticipants(conversationId)
      .find((participant) => participant.accountId !== this.sessionAccountId);

    if (!responder) {
      return;
    }

    const account = this._account(responder.accountId);
    const message = REPLIES[this._replyIndex % REPLIES.length];
    this._replyIndex++;

    const typing = (isTyping: boolean) => {
      this._socket.broadcast(
        conversationTopic(conversationId),
        CONVERSATION_EVENT_TYPING,
        { typing: isTyping, accountId: account.id, accountName: account.name },
      );
    };

    setTimeout(() => typing(true), TYPING_DELAY);

    setTimeout(() => {
      typing(false);

      this._addItem(
        conversationId,
        responder.id,
        ConversationItemType.Message,
        message,
      );

      // Pure routing, no payload — both are signals to re-read through the
      // endpoint that decides what this reader is allowed to see
      this._socket.broadcast(conversationTopic(conversationId), CONVERSATION_EVENT_ITEM);
      this._socket.broadcast(
        accountConversationsTopic(this.sessionAccountId),
        ACCOUNT_CONVERSATIONS_EVENT,
      );
    }, REPLY_DELAY);
  }

  private _mapConversation(row: ConversationRecord): Conversation {
    const participants = this._activeParticipants(row.id);
    const lastItem = this._lastItem(row.id);
    const recent = [...participants]
      .sort((a, b) => Date.parse(b.activityDate) - Date.parse(a.activityDate))
      .slice(0, 3);

    return {
      id: row.id,
      state: row.state,
      name: row.name,
      guid: row.guid,
      createDate: new Date(row.createDate),
      activityDate: new Date(row.activityDate),
      creatorConversationParticipantId: row.creatorConversationParticipantId,
      conversationParticipants: participants
        .map((participant) => this._mapParticipant(participant)),
      recentConversationParticipants: recent
        .map((participant) => this._mapParticipant(participant)),
      conversationParticipantCount: participants.length,
      lastConversationItem: lastItem ? this._mapItem(lastItem, {}) : null,
      lastConversationItemId: lastItem?.id,
      unread: this._unread(row.id),
      accountConversationRoles: this._roles(this._sessionParticipant(row.id)),
    };
  }

  private _roles(participant: ConversationParticipantRecord): ConversationRole[] {
    if (!participant) {
      return [];
    }

    return this.sessionAdmin || participant.admin ?
      [ConversationRole.Admin, ConversationRole.Member] :
      [ConversationRole.Member];
  }

  private _mapParticipant(row: ConversationParticipantRecord): ConversationParticipant {
    const account = this._account(row.accountId);

    return {
      id: row.id,
      conversationId: row.conversationId,
      accountId: row.accountId,
      state: row.state,
      type: row.type,
      guid: row.guid,
      name: account?.name,
      email: account?.email,
      createDate: new Date(row.createDate),
      activityDate: new Date(row.activityDate),
      readConversationItemId: row.readConversationItemId,
      account,
    };
  }

  private _mapItem(row: ConversationItemRecord, query: any = {}): ConversationItem {
    const participant = this._participants
      .find((participant_) => participant_.id === row.conversationParticipantId);

    const addRemoveAccount = row.addRemoveAccountIds.length === 1 ?
      this._account(row.addRemoveAccountIds[0]) : null;

    return {
      id: row.id,
      conversationId: row.conversationId,
      conversationParticipantId: row.conversationParticipantId,
      type: row.type,
      state: row.state,
      message: row.message,
      guid: row.guid,
      createDate: new Date(row.createDate),
      conversationParticipant: participant ? this._mapParticipant(participant) : null,
      conversationItemFiles: [...row.conversationItemFiles],
      conversationParticipantsAddedCount: row.type === ConversationItemType.ParticipantAdd ?
        row.addRemoveAccountIds.length : 0,
      conversationParticipantsRemovedCount: row.type === ConversationItemType.ParticipantRemoved ?
        row.addRemoveAccountIds.length : 0,
      conversationParticipantsReadCount: this._readCount(row, query),
      lastConversationItemParticipantAddRemove: addRemoveAccount ?
        { account: addRemoveAccount } : null,
      lastConversationItemFile: row.conversationItemFiles[0]?.file || null,
    };
  }

  private _readCount(row: ConversationItemRecord, query: any = {}): number {
    return this._activeParticipants(row.conversationId)
      .filter((participant) => {
        if (query.conversationParticipantsReadCountNotCreator &&
          participant.id === row.conversationParticipantId) {
          return false;
        }

        if (query.conversationParticipantsReadCountNotAccountId &&
          participant.accountId === Number(query.conversationParticipantsReadCountNotAccountId)) {
          return false;
        }

        return (participant.readConversationItemId || 0) >= row.id;
      })
      .length;
  }

}
