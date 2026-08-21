import { Injectable } from '@angular/core';

import {
  FsWebSocket, FsWebSocketEvent, FsWebSocketMessage, FsWebSocketRefusedCode,
  isApplicationEvent,
} from '@firestitch/web-socket';

import { Subject } from 'rxjs';

import { accountsData, sessionAccountId } from '../data';


/** Server-side publish cap: how many, over how long, per connection. */
const PUBLISH_LIMIT = 10;
const PUBLISH_WINDOW = 10000;


/**
 * The two halves of a socket in one object, which is the shape `_createTransport()`
 * has to return: `next()` is the browser sending, `deliver()` is the server pushing.
 *
 * A plain `Subject` cannot do this — the base both calls `next()` on it and subscribes
 * to it, so everything sent would come straight back.
 */
class TransportSubject extends Subject<FsWebSocketMessage> {

  constructor(private _onSend: (message: FsWebSocketMessage) => void) {
    super();
  }

  /** The browser sending. */
  public override next(message: FsWebSocketMessage): void {
    this._onSend(message);
  }

  /** The server pushing. Drops on the floor when nothing is subscribed, like a real one. */
  public deliver(message: FsWebSocketMessage): void {
    super.next(message);
  }

}


/**
 * A browser-only socket for the playground, standing in for a real deployment's
 * server.
 *
 * It extends `FsWebSocket` and replaces the transport through the supported seam,
 * nothing more. Everything above the wire is the real implementation, inherited:
 * `watch()` with its topic reference counting and its re-subscribe on every rise of
 * `connected$`, the routing in `on()`, the frame shape, the lazy open and the close
 * when the last listener goes. So the demo exercises the shipping client rather than
 * a second copy of it that can drift.
 *
 * This class only ever plays the server, and it models the behaviours a naive fake
 * would paper over — each of which fails in a way that looks identical to "socket
 * fine, no events":
 *
 *  1. The connection is only dialled when something holds it. A client that never
 *     takes a hold never connects, visibly.
 *  2. Authentication is asynchronous. For `authDelay` after the transport opens the
 *     connection is open and unusable, and anything sent in that window is dropped
 *     without a reply — which is what a real server does with a connection it has
 *     not identified yet.
 *  3. Subscriptions live here, not in the browser, and do not survive a reconnect.
 *  4. Publishing is capped per connection, and the excess is dropped in silence:
 *     answering a flood doubles it.
 *
 * A publish is authorized and stamped here rather than trusted: identity comes from
 * the session, so a browser cannot announce that somebody else is typing.
 */
@Injectable()
export class PlaygroundWebSocket extends FsWebSocket {

  /** Logs every frame in both directions, and every drop, to the console. */
  public debug = false;

  /**
   * How long the server takes to authenticate the handshake. Set to 0 for an
   * instant connection; raise it to widen the window where sends are dropped.
   */
  public authDelay = 600;

  /** Topics the server will refuse, mapped to the code it refuses them with. */
  public refusedTopics = new Map<string, FsWebSocketRefusedCode>();

  private _transport: TransportSubject = null;
  private _authenticated = false;
  private _subscribedTopics = new Set<string>();
  private _publishTimes: number[] = [];

  /** Topics the server currently holds a subscription for, for inspection in the demo. */
  public get subscribedTopics(): string[] {
    return [...this._subscribedTopics];
  }

  /** Whether anything is currently holding the transport open. */
  public get transportOpen(): boolean {
    return !!this._transport;
  }

  /**
   * Re-authenticate an open transport. Does nothing when nothing holds one — there is
   * no connection to bring back until a consumer subscribes.
   */
  public connect(): void {
    if (this._transport) {
      this._authenticate(this._transport);
    }
  }

  /**
   * The connection going away, and with it every server-side subscription. Consumers
   * are expected to re-declare their topics when `connected$` rises again, which is
   * what the inherited `watch()` does.
   */
  public disconnect(): void {
    this._authenticated = false;
    this._subscribedTopics.clear();
    this._setConnected(false);
  }

  /**
   * The server raising an event by itself, rather than relaying a browser's publish.
   * The caller owns the payload, so a simulated participant can speak as itself.
   */
  public broadcast(topic: string, event: string, data?: Record<string, unknown>): void {
    this._deliver(topic, event, data);
  }

  protected override _createTransport(): Subject<FsWebSocketMessage> {
    const transport = new TransportSubject((message) => this._receive(message));

    this._transport = transport;
    this._authenticated = false;
    this._subscribedTopics.clear();
    this._publishTimes = [];

    this._authenticate(transport);

    return transport;
  }

  /**
   * The server identifying the connection, which takes a moment. Until it lands the
   * socket is open and unusable, and says nothing about it.
   */
  private _authenticate(transport: TransportSubject): void {
    setTimeout(() => {
      // A transport that has since been replaced is not ours to connect
      if (this._transport !== transport) {
        return;
      }

      this._authenticated = true;
      transport.deliver({
        event: FsWebSocketEvent.Connected,
        data: { accountId: sessionAccountId },
      });
    }, this.authDelay);
  }

  /** Everything the browser puts on the wire arrives here. */
  private _receive(message: FsWebSocketMessage): void {
    if (!this._authenticated) {
      // Exactly what the server does, and the reason connected$ is worth gating on
      this._log(`dropped ${message.event} — connection not authenticated yet`);

      return;
    }

    this._log(`→ ${message.event}`, message.topic);

    // A client publishes by naming its event: bare words are the protocol's,
    // anything dotted belongs to an application
    if (isApplicationEvent(message.event)) {
      this._publish(message);

      return;
    }

    switch (message.event) {
      case FsWebSocketEvent.Subscribe:
        this._subscribe(message.topic);
        break;

      case FsWebSocketEvent.Unsubscribe:
        this._subscribedTopics.delete(message.topic);
        break;

      case FsWebSocketEvent.Ping:
        this._transport?.deliver({ event: FsWebSocketEvent.Pong });
        break;
    }
  }

  private _subscribe(topic: string): void {
    const refused = this.refusedTopics.get(topic);

    if (refused) {
      // Refusing one topic never costs the connection its others
      this._transport?.deliver({
        event: FsWebSocketEvent.Refused,
        topic,
        data: { code: refused },
      });

      return;
    }

    this._subscribedTopics.add(topic);
    this._transport?.deliver({ event: FsWebSocketEvent.Subscribed, topic });
  }

  private _publish(message: FsWebSocketMessage): void {
    if (!this._subscribedTopics.has(message.topic)) {
      this._transport?.deliver({
        event: FsWebSocketEvent.Refused,
        topic: message.topic,
        data: { code: FsWebSocketRefusedCode.Forbidden },
      });

      return;
    }

    if (!this._withinPublishLimit()) {
      // Silently — answering a flood doubles it
      this._log(`dropped ${message.event} — over ${PUBLISH_LIMIT} per ${PUBLISH_WINDOW}ms`);

      return;
    }

    const account = accountsData
      .find((row) => row.id === sessionAccountId);

    // Identity comes from the session, never from the payload — anything the browser
    // claimed about who it is gets overwritten here
    this._deliver(message.topic, message.event, {
      ...(message.data as Record<string, unknown>),
      accountId: account?.id,
      accountName: account?.name,
    });
  }

  private _withinPublishLimit(): boolean {
    const now = Date.now();
    this._publishTimes = this._publishTimes
      .filter((time) => now - time < PUBLISH_WINDOW);

    if (this._publishTimes.length >= PUBLISH_LIMIT) {
      return false;
    }

    this._publishTimes.push(now);

    return true;
  }

  private _deliver(topic: string, event: string, data?: Record<string, unknown>): void {
    if (!this._transport || !this._authenticated) {
      return;
    }

    if (!this._subscribedTopics.has(topic)) {
      this._log(`not delivering ${event} — nothing subscribed to ${topic}`);

      return;
    }

    this._log(`← ${event} @ ${topic}`, data);

    // Routing at the root, payload in data — and no data at all when the event is
    // pure routing
    this._transport.deliver(data ? { event, topic, data } : { event, topic });
  }

  private _log(message: string, data?: unknown): void {
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log(`[socket] ${message}`, data ?? '');
    }
  }

}
