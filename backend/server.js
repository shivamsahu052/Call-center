import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const dataFile = join(currentDirectory, 'data', 'store.json');
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';
const activeCalls = new Map();

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
};

async function readStore() {
  const contents = await readFile(dataFile, 'utf8');
  return JSON.parse(contents);
}

async function writeStore(store) {
  await mkdir(dirname(dataFile), { recursive: true });
  const temporaryFile = `${dataFile}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  await rename(temporaryFile, dataFile);
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    ...corsHeaders,
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

function sendError(response, status, message) {
  sendJson(response, status, { error: message });
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 100_000) {
      throw new Error('Request body is too large');
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function normalizePhoneNumber(value) {
  return String(value ?? '').replace(/[^\d*#+]/g, '');
}

function publicActiveCall(call) {
  const { dtmfEvents: _dtmfEvents, ...publicCall } = call;
  return publicCall;
}

async function handleBootstrap(response) {
  const store = await readStore();
  const calls = [...store.calls].sort(
    (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
  );

  sendJson(response, 200, {
    contacts: store.contacts,
    calls,
    activeCalls: [...activeCalls.values()].map(publicActiveCall),
  });
}

async function handleStartCall(request, response) {
  const body = await readJson(request);
  const phoneNumber = normalizePhoneNumber(body.phoneNumber);

  if (phoneNumber.replace(/\D/g, '').length < 3) {
    sendError(response, 400, 'A valid phone number is required');
    return;
  }

  const store = await readStore();
  const contact = body.contactId
    ? store.contacts.find((item) => item.id === body.contactId)
    : store.contacts.find(
        (item) => normalizePhoneNumber(item.phoneNumber) === phoneNumber,
      );
  const now = new Date().toISOString();
  const call = {
    id: body.callId || `out-${randomUUID()}`,
    phoneNumber,
    contactName: body.contactName || contact?.name,
    contactId: body.contactId || contact?.id,
    type: 'outgoing',
    status: 'connected',
    startedAt: now,
    connectedAt: now,
    isMuted: false,
    isSpeakerOn: false,
    isOnHold: false,
    isKeypadVisible: false,
    dtmfEvents: [],
  };

  activeCalls.set(call.id, call);
  sendJson(response, 201, publicActiveCall(call));
}

async function handleUpdateControls(request, response, callId) {
  const call = activeCalls.get(callId);
  if (!call) {
    sendError(response, 404, 'Active call not found');
    return;
  }

  const body = await readJson(request);
  const updatedCall = {
    ...call,
    isMuted: typeof body.isMuted === 'boolean' ? body.isMuted : call.isMuted,
    isSpeakerOn:
      typeof body.isSpeakerOn === 'boolean' ? body.isSpeakerOn : call.isSpeakerOn,
    isOnHold: typeof body.isOnHold === 'boolean' ? body.isOnHold : call.isOnHold,
  };
  updatedCall.status = updatedCall.isOnHold ? 'on-hold' : 'connected';

  activeCalls.set(callId, updatedCall);
  sendJson(response, 200, publicActiveCall(updatedCall));
}

async function handleDtmf(request, response, callId) {
  const call = activeCalls.get(callId);
  if (!call) {
    sendError(response, 404, 'Active call not found');
    return;
  }

  const body = await readJson(request);
  const digit = String(body.digit ?? '');
  if (!/^[\d*#]$/.test(digit)) {
    sendError(response, 400, 'DTMF digit must be 0-9, * or #');
    return;
  }

  call.dtmfEvents.push({ digit, sentAt: new Date().toISOString() });
  sendJson(response, 202, { accepted: true });
}

async function handleEndCall(request, response, callId) {
  const call = activeCalls.get(callId);
  if (!call) {
    sendError(response, 404, 'Active call not found');
    return;
  }

  const body = await readJson(request);
  const endedAt = new Date().toISOString();
  const duration = Math.max(
    0,
    Math.floor(
      (new Date(endedAt).getTime() - new Date(call.connectedAt ?? call.startedAt).getTime()) /
        1000,
    ),
  );
  const record = {
    id: call.id,
    phoneNumber: call.phoneNumber,
    contactName: call.contactName,
    contactId: call.contactId,
    type: call.type,
    status: 'ended',
    duration,
    startedAt: call.startedAt,
    endedAt,
    notes: typeof body.notes === 'string' ? body.notes : undefined,
  };

  const store = await readStore();
  store.calls = [record, ...store.calls.filter((item) => item.id !== callId)];
  await writeStore(store);
  activeCalls.delete(callId);
  sendJson(response, 200, record);
}

async function handleUpdateNotes(request, response, callId) {
  const body = await readJson(request);
  const store = await readStore();
  const callIndex = store.calls.findIndex((item) => item.id === callId);

  if (callIndex === -1) {
    sendError(response, 404, 'Call record not found');
    return;
  }

  store.calls[callIndex] = {
    ...store.calls[callIndex],
    notes: typeof body.notes === 'string' ? body.notes : '',
  };
  await writeStore(store);
  sendJson(response, 200, store.calls[callIndex]);
}

const server = createServer(async (request, response) => {
  if (!request.url || !request.method) {
    sendError(response, 400, 'Invalid request');
    return;
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const callMatch = path.match(/^\/api\/calls\/([^/]+)(?:\/(controls|dtmf|end))?$/);

  try {
    if (request.method === 'GET' && path === '/health') {
      sendJson(response, 200, {
        status: 'ok',
        service: 'call-center-dialer-backend',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (request.method === 'GET' && path === '/api/bootstrap') {
      await handleBootstrap(response);
      return;
    }

    if (request.method === 'POST' && path === '/api/calls') {
      await handleStartCall(request, response);
      return;
    }

    if (callMatch) {
      const [, callId, action] = callMatch;
      if (request.method === 'PATCH' && action === 'controls') {
        await handleUpdateControls(request, response, callId);
        return;
      }
      if (request.method === 'POST' && action === 'dtmf') {
        await handleDtmf(request, response, callId);
        return;
      }
      if (request.method === 'POST' && action === 'end') {
        await handleEndCall(request, response, callId);
        return;
      }
      if (request.method === 'PATCH' && !action) {
        await handleUpdateNotes(request, response, callId);
        return;
      }
    }

    sendError(response, 404, 'Route not found');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    console.error(error);
    sendError(response, message.includes('JSON') ? 400 : 500, message);
  }
});

server.listen(port, host, () => {
  console.log(`Dialer backend listening on http://${host}:${port}`);
});
