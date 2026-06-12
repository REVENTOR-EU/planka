const { idInput } = require('../../../utils/inputs');

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  TIME_ENTRY_NOT_FOUND: {
    timeEntryNotFound: 'Time entry not found',
  },
};

module.exports = {
  inputs: {
    id: {
      ...idInput,
      required: true,
    },
  },

  exits: {
    notEnoughRights: {
      responseType: 'forbidden',
    },
    timeEntryNotFound: {
      responseType: 'notFound',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const timeEntry = await TimeEntry.qm.getOneById(inputs.id);

    if (!timeEntry) {
      throw Errors.TIME_ENTRY_NOT_FOUND;
    }

    if (timeEntry.userId !== currentUser.id) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }

    if (timeEntry.stoppedAt) {
      throw Errors.TIME_ENTRY_NOT_FOUND;
    }

    const pathToProject = await sails.helpers.cards
      .getPathToProjectById(timeEntry.cardId)
      .intercept('pathNotFound', () => Errors.TIME_ENTRY_NOT_FOUND);

    const { list, board, project } = pathToProject;

    const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
      board.id,
      currentUser.id,
    );

    if (!boardMembership || boardMembership.role !== BoardMembership.Roles.EDITOR) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }

    const result = await sails.helpers.timeEntries.stopOne.with({
      timeEntry,
      project,
      board,
      list,
      request: this.req,
    });

    const card = await Card.qm.getOneById(timeEntry.cardId);
    const prevTotal = card.stopwatch ? card.stopwatch.total : 0;

    const updatedCard = await Card.qm.updateOne(card.id, {
      stopwatch: {
        startedAt: null,
        total: prevTotal + result.duration,
      },
    });

    sails.sockets.broadcast(`board:${board.id}`, 'cardUpdate', {
      item: updatedCard,
    });

    return {
      item: result.timeEntry,
    };
  },
};
