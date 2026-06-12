import socket from './socket';

const transformTimeEntry = (timeEntry) => ({
  ...timeEntry,
  ...(timeEntry.startedAt && {
    startedAt: new Date(timeEntry.startedAt),
  }),
  ...(timeEntry.stoppedAt && {
    stoppedAt: new Date(timeEntry.stoppedAt),
  }),
  ...(timeEntry.createdAt && {
    createdAt: new Date(timeEntry.createdAt),
  }),
});

const startTimeEntry = (cardId, headers) =>
  socket.post(`/cards/${cardId}/time-entries/start`, undefined, headers).then((body) => ({
    ...body,
    item: transformTimeEntry(body.item),
  }));

const stopTimeEntry = (timeEntryId, headers) =>
  socket.post(`/time-entries/${timeEntryId}/stop`, undefined, headers).then((body) => ({
    ...body,
    item: transformTimeEntry(body.item),
  }));

const getTimeEntries = (cardId, headers) =>
  socket.get(`/cards/${cardId}/time-entries`, undefined, headers).then((body) => ({
    ...body,
    items: body.items.map(transformTimeEntry),
  }));

const makeHandleTimeEntryCreate = (next) => (body) => {
  next({
    ...body,
    item: transformTimeEntry(body.item),
  });
};

const makeHandleTimeEntryUpdate = makeHandleTimeEntryCreate;

export { transformTimeEntry };

export default {
  startTimeEntry,
  stopTimeEntry,
  getTimeEntries,
  makeHandleTimeEntryCreate,
  makeHandleTimeEntryUpdate,
};
