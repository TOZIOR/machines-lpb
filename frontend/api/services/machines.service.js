import { AppError } from "../utils/errors.js";
import { toSqlDate } from "../utils/dates.js";

function nextMachineCode(lastCode, year) {
  const lastNumber = lastCode ? Number(lastCode.split("-").pop()) : 0;
  const nextNumber = Number.isNaN(lastNumber) ? 1 : lastNumber + 1;
  return `MC-${year}-${String(nextNumber).padStart(3, "0")}`;
}

export function createMachinesService({
  pool,
  machinesRepository,
  clientsRepository,
  movementsRepository,
  appBaseUrl,
}) {
  return {
    listMachines() {
      return machinesRepository.list();
    },

    async getMachineMovements(identifier) {
      const machine = await machinesRepository.findRawByCodeOrUuid(identifier);
      if (!machine) return [];
      return movementsRepository.listForMachine(machine.id);
    },

    async getPublicMachine(code) {
      const machine = await machinesRepository.findPublicByCode(code);
      if (!machine) {
        throw new AppError("Aucune machine trouvée pour ce QR code.", 404, "MACHINE_NOT_FOUND");
      }
      return machine;
    },

    async createMachine(body = {}) {
      const { marque, modele, numeroSerie } = body;
      if (!marque?.trim() || !modele?.trim() || !numeroSerie?.trim()) {
        throw new AppError(
          "La marque, le modèle et le numéro de série sont obligatoires.",
          400,
          "INVALID_MACHINE",
        );
      }

      const db = await pool.connect();
      try {
        await db.query("begin");
        const year = new Date().getFullYear();
        const lastCode = await machinesRepository.getLastCodeForYear(year, db);
        const code = nextMachineCode(lastCode, year);

        const machine = await machinesRepository.create(
          {
            code,
            qrCode: `${appBaseUrl}/machine/${code}`,
            brand: marque.trim(),
            model: modele.trim(),
            serialNumber: numeroSerie.trim(),
            supplier: body.fournisseur || null,
            purchaseDate: toSqlDate(body.dateAchat),
            purchaseInvoice: body.factureAchat || null,
            purchasePrice:
              body.prixAchat !== undefined && body.prixAchat !== ""
                ? Number(body.prixAchat)
                : null,
            location: body.lieu || null,
            comment: body.commentaire || null,
            pennylaneProductId: body.pennylaneProductId || null,
            pennylanePurchaseInvoiceId: body.pennylanePurchaseInvoiceId || null,
            pennylaneSalesInvoiceId: body.pennylaneSalesInvoiceId || null,
          },
          db,
        );

        await movementsRepository.create(
          {
            machineId: machine.uuid,
            action: "Création",
            oldStatus: "-",
            newStatus: "En stock",
            clientId: null,
            comment: "Entrée en stock après achat",
          },
          db,
        );

        await db.query("commit");
        return machine;
      } catch (error) {
        await db.query("rollback");
        throw error;
      } finally {
        db.release();
      }
    },

    async updateMachine(identifier, body = {}) {
      const db = await pool.connect();
      try {
        await db.query("begin");
        const current = await machinesRepository.findRawByCodeOrUuid(identifier, db);
        if (!current) {
          throw new AppError("Machine introuvable.", 404, "MACHINE_NOT_FOUND");
        }

        const status = body.statut ?? current.statut;
        let clientId = body.clientId ?? current.client_id ?? null;
        let pennylaneCustomerId =
          body.pennylaneCustomerId ?? current.pennylane_customer_id ?? null;

        let crmClient = null;
        if (clientId) {
          crmClient = await clientsRepository.findById(clientId, db);
          if (!crmClient) {
            throw new AppError("Le client CRM sélectionné est introuvable.", 400, "CLIENT_NOT_FOUND");
          }
          pennylaneCustomerId = crmClient.pennylaneCustomerId || pennylaneCustomerId;
        } else if (pennylaneCustomerId) {
          crmClient = await clientsRepository.findByPennylaneId(pennylaneCustomerId, db);
          clientId = crmClient?.id || null;
        }

        if (status === "En prêt" && !clientId) {
          throw new AppError(
            "Un client doit être sélectionné lorsque le statut est En prêt.",
            400,
            "CLIENT_REQUIRED_FOR_LOAN",
          );
        }

        const update = {
          status,
          clientId,
          pennylaneCustomerId,
          location: body.lieu ?? current.lieu,
          comment: body.commentaire ?? current.commentaire,
          maintenanceStartDate:
            toSqlDate(body.maintenanceStartDate) || current.maintenance_start_date,
          maintenanceReason: body.maintenanceReason ?? current.maintenance_reason,
          maintenanceAction: body.maintenanceAction ?? current.maintenance_action,
          maintenanceExpectedReturnDate:
            toSqlDate(body.maintenanceExpectedReturnDate) ||
            current.maintenance_expected_return_date,
        };

        const updated = await machinesRepository.update(current.id, update, db);
        const changes = [];

        if (current.statut !== update.status) {
          changes.push(`Statut : ${current.statut} → ${update.status}`);
        }
        if ((current.lieu || "") !== (update.location || "")) {
          changes.push(`Lieu : ${current.lieu || "-"} → ${update.location || "-"}`);
        }
        if ((current.client_id || "") !== (update.clientId || "")) {
          const oldClient = current.client_id
            ? await clientsRepository.findById(current.client_id, db)
            : null;
          const newClient = update.clientId
            ? await clientsRepository.findById(update.clientId, db)
            : null;
          changes.push(`Client : ${oldClient?.name || "Sans client"} → ${newClient?.name || "Sans client"}`);
        }
        if (update.comment && update.comment !== current.commentaire) {
          changes.push(`Commentaire : ${update.comment}`);
        }
        if ((current.maintenance_reason || "") !== (update.maintenanceReason || "")) {
          changes.push(`Maintenance - motif : ${update.maintenanceReason || "-"}`);
        }
        if ((current.maintenance_action || "") !== (update.maintenanceAction || "")) {
          changes.push(`Maintenance - action : ${update.maintenanceAction || "-"}`);
        }
        if (
          String(current.maintenance_expected_return_date || "") !==
          String(update.maintenanceExpectedReturnDate || "")
        ) {
          changes.push(`Maintenance - retour prévu : ${update.maintenanceExpectedReturnDate || "-"}`);
        }

        await movementsRepository.create(
          {
            machineId: current.id,
            action: body.action || "Mise à jour",
            oldStatus: current.statut,
            newStatus: update.status,
            clientId: update.clientId,
            comment: changes.length ? changes.join(" | ") : "Aucune modification",
          },
          db,
        );

        await db.query("commit");
        return updated;
      } catch (error) {
        await db.query("rollback");
        throw error;
      } finally {
        db.release();
      }
    },

    listByPennylaneCustomerId(pennylaneCustomerId) {
      return machinesRepository.listByPennylaneCustomerId(pennylaneCustomerId);
    },

    async getCrmClientSummary(pennylaneCustomerId) {
      const machines = await machinesRepository.listByPennylaneCustomerId(pennylaneCustomerId);
      const byStatus = machines.reduce((acc, machine) => {
        acc[machine.statut] = (acc[machine.statut] || 0) + 1;
        return acc;
      }, {});
      return { pennylaneCustomerId, total: machines.length, byStatus, machines };
    },
  };
}
