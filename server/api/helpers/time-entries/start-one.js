module.exports = {
  inputs: {
    card: {
      type: 'ref',
      required: true,
    },
    project: {
      type: 'ref',
      required: true,
    },
    board: {
      type: 'ref',
      required: true,
    },
    list: {
      type: 'ref',
      required: true,
    },
    actorUser: {
      type: 'ref',
      required: true,
    },
    request: {
      type: 'ref',
    },
  },

  async fn(inputs) {
    const { actorUser } = inputs;

    const runningEntry = await TimeEntry.qm.getRunningByUserId(actorUser.id);
    if (runningEntry) {
      await sails.helpers.timeEntries.stopOne.with({
        timeEntry: runningEntry,
        project: inputs.project,
        board: inputs.board,
        list: inputs.list,
        request: inputs.request,
      });
    }

    const now = new Date();

    const timeEntry = await TimeEntry.qm.createOne({
      cardId: inputs.card.id,
      userId: actorUser.id,
      startedAt: now,
    });

    sails.sockets.broadcast(`board:${inputs.board.id}`, 'timeEntryCreate', {
      item: timeEntry,
    });

    return timeEntry;
  },
};
