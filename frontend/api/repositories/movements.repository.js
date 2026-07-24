export function createMovementsRepository(pool) {
  return {
    async listForMachine(machineId, db = pool) {
      const result = await db.query(
        `
        select
          id,
          machine_id as "machineId",
          date,
          action,
          ancien_statut as "ancienStatut",
          nouveau_statut as "nouveauStatut",
          client_id as "clientId",
          commentaire
        from machine_movements
        where machine_id = $1
        order by date desc
        `,
        [machineId],
      );
      return result.rows;
    },

    async create(data, db = pool) {
      await db.query(
        `
        insert into machine_movements (
          machine_id, action, ancien_statut, nouveau_statut, client_id, commentaire
        ) values ($1, $2, $3, $4, $5, $6)
        `,
        [
          data.machineId,
          data.action,
          data.oldStatus,
          data.newStatus,
          data.clientId,
          data.comment,
        ],
      );
    },
  };
}
