module.exports = {
  inputs: {
    timeEntry: {
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
    request: {
      type: 'ref',
    },
  },

  async fn(inputs) {
    const { timeEntry } = inputs;

    const now = new Date();
    const duration = Math.floor((now - new Date(timeEntry.startedAt)) / 1000);

    const updatedTimeEntry = await TimeEntry.qm.updateOne(
      { id: timeEntry.id },
      {
        stoppedAt: now,
        duration,
      },
    );

    sails.sockets.broadcast(`board:${inputs.board.id}`, 'timeEntryUpdate', {
      item: updatedTimeEntry,
    });

    return {
      timeEntry: updatedTimeEntry,
      duration,
    };
  },
};
