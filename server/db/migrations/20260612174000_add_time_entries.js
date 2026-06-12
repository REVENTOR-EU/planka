/**
 * Migration: Add time_entries table for per-user time tracking.
 */

exports.up = async (knex) => {
  await knex.schema.createTable('time_entry', (table) => {
    table.bigInteger('id').primary().defaultTo(knex.raw('next_id()'));
    table.bigInteger('card_id').notNullable();
    table.bigInteger('user_id').notNullable();
    table.timestamp('started_at', true).notNullable();
    table.timestamp('stopped_at', true);
    table.bigInteger('duration');
    table.timestamp('created_at', true);
    table.timestamp('updated_at', true);

    table.index('card_id');
    table.index('user_id');
    table.index('stopped_at');
  });
};

exports.down = (knex) => knex.schema.dropTable('time_entry');
