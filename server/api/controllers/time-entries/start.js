const { idInput } = require('../../../utils/inputs');

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  CARD_NOT_FOUND: {
    cardNotFound: 'Card not found',
  },
};

module.exports = {
  inputs: {
    cardId: {
      ...idInput,
      required: true,
    },
  },

  exits: {
    notEnoughRights: {
      responseType: 'forbidden',
    },
    cardNotFound: {
      responseType: 'notFound',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const pathToProject = await sails.helpers.cards
      .getPathToProjectById(inputs.cardId)
      .intercept('pathNotFound', () => Errors.CARD_NOT_FOUND);

    const { card, list, board, project } = pathToProject;

    const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
      board.id,
      currentUser.id,
    );

    if (!boardMembership || boardMembership.role !== BoardMembership.Roles.EDITOR) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }

    const timeEntry = await sails.helpers.timeEntries.startOne.with({
      card,
      project,
      board,
      list,
      actorUser: currentUser,
      request: this.req,
    });

    const updatedCard = await Card.qm.updateOne(card.id, {
      stopwatch: {
        startedAt: timeEntry.startedAt,
        total: card.stopwatch ? card.stopwatch.total : 0,
      },
    });

    sails.sockets.broadcast(`board:${board.id}`, 'cardUpdate', {
      item: updatedCard,
    });

    return {
      item: timeEntry,
    };
  },
};
