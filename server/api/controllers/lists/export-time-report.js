const { idInput } = require('../../../utils/inputs');

const Errors = {
  LIST_NOT_FOUND: {
    listNotFound: 'List not found',
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
    listNotFound: {
      responseType: 'notFound',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const list = await List.qm.getOneById(inputs.id);

    if (!list) {
      throw Errors.LIST_NOT_FOUND;
    }

    const pathToProject = await sails.helpers.lists
      .getPathToProjectById(inputs.id)
      .intercept('pathNotFound', () => Errors.LIST_NOT_FOUND);

    const { board } = pathToProject;

    const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
      board.id,
      currentUser.id,
    );

    if (!boardMembership) {
      throw Errors.LIST_NOT_FOUND;
    }

    const cards = await Card.qm.getByListId(list.id);

    const cardIds = sails.helpers.utils.mapRecords(cards);
    const timeEntries = cardIds.length > 0 ? await TimeEntry.qm.getCompletedByCardIds(cardIds) : [];

    const userIds = sails.helpers.utils.mapRecords(timeEntries, 'userId', true);
    const users = userIds.length > 0 ? await User.qm.getByIds(userIds) : [];

    const odsBuffer = await sails.helpers.utils.generateOds.with({
      listName: list.name,
      cards,
      timeEntries,
      users,
    });

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `time-report-${list.name || list.type}-${dateStr}.ods`;

    this.res.set({
      'Content-Type': 'application/vnd.oasis.opendocument.spreadsheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': odsBuffer.length,
    });

    this.res.send(odsBuffer);
  },
};
