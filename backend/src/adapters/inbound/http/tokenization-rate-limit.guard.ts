import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type Route = 'GET' | 'POST';
type Window = { count: number; resetsAt: number };

const WINDOW_MS = 60_000;
const MAX_IP_WINDOWS = 4096;
const LIMITS: Record<Route, { perIp: number; global: number }> = {
  GET: { perIp: 30, global: 300 },
  POST: { perIp: 10, global: 100 },
};

/** Local safety bound only; an edge/distributed limit is required across replicas. */
@Injectable()
export class TokenizationRateLimitGuard implements CanActivate {
  private readonly perIp = new Map<string, Window>();
  private readonly global: Record<Route, Window> = {
    GET: { count: 0, resetsAt: 0 },
    POST: { count: 0, resetsAt: 0 },
  };

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const route: Route = request.method === 'POST' ? 'POST' : 'GET';
    const now = Date.now();
    const limits = LIMITS[route];
    // Deliberately use the TCP peer, not request.ip or untrusted forwarded headers.
    const key = `${route}:${request.socket.remoteAddress ?? 'unknown'}`;
    let global = this.global[route];
    if (now >= global.resetsAt) {
      global = { count: 0, resetsAt: now + WINDOW_MS };
      this.global[route] = global;
    }
    let peer = this.perIp.get(key);
    if (peer && now >= peer.resetsAt) {
      this.perIp.delete(key);
      peer = undefined;
    }

    if (global.count >= limits.global)
      this.reject(response, global.resetsAt, now);
    if (peer && peer.count >= limits.perIp)
      this.reject(response, peer.resetsAt, now);

    if (!peer) {
      if (this.perIp.size >= MAX_IP_WINDOWS) {
        for (const [address, window] of this.perIp) {
          if (now >= window.resetsAt) this.perIp.delete(address);
        }
      }
      if (this.perIp.size >= MAX_IP_WINDOWS) {
        const earliest = Math.min(
          ...Array.from(this.perIp.values(), (window) => window.resetsAt),
        );
        this.reject(response, earliest, now);
      }
      peer = { count: 0, resetsAt: now + WINDOW_MS };
      this.perIp.set(key, peer);
    }
    peer.count++;
    global.count++;
    return true;
  }

  private reject(response: Response, resetsAt: number, now: number): never {
    response.setHeader(
      'Retry-After',
      String(Math.max(1, Math.ceil((resetsAt - now) / 1000))),
    );
    response.setHeader('Cache-Control', 'no-store');
    throw new HttpException('Tokenization rate limit exceeded', 429);
  }
}
