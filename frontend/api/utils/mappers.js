export function mapClientRow(row) {
  if (!row) return null;

  const fullAddress = [row.address, row.postal_code, row.city]
    .filter(Boolean)
    .join(", ");

  return {
    id: row.id,
    nom: row.name,
    name: row.name,
    adresse: fullAddress || null,
    address: row.address || null,
    postalCode: row.postal_code || null,
    city: row.city || null,
    telephone: row.phone || null,
    phone: row.phone || null,
    email: row.email || null,
    commentaire: null,
    pennylaneCustomerId: row.pennylane_id || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

export function machineSelectSql(alias = "m") {
  return `
    ${alias}.id as "uuid",
    ${alias}.code as "id",
    ${alias}.code as "idCode",
    ${alias}.code,
    ${alias}.qr_code as "qrCode",
    ${alias}.qr_code as "qrCodeUrl",
    ${alias}.marque,
    ${alias}.modele,
    ${alias}.numero_serie as "numeroSerie",
    ${alias}.fournisseur,
    ${alias}.date_achat as "dateAchat",
    ${alias}.facture_achat as "factureAchat",
    ${alias}.prix_achat as "prixAchat",
    ${alias}.statut,
    ${alias}.client_id as "clientId",
    ${alias}.lieu,
    ${alias}.type_mise_disposition as "typeMiseDisposition",
    ${alias}.date_mise_disposition as "dateMiseDisposition",
    ${alias}.commentaire,
    ${alias}.date_maj as "dateMaj",
    ${alias}.maintenance_start_date as "maintenanceStartDate",
    ${alias}.maintenance_reason as "maintenanceReason",
    ${alias}.maintenance_action as "maintenanceAction",
    ${alias}.maintenance_expected_return_date as "maintenanceExpectedReturnDate",
    ${alias}.pennylane_product_id as "pennylaneProductId",
    ${alias}.pennylane_customer_id as "pennylaneCustomerId",
    ${alias}.pennylane_purchase_invoice_id as "pennylanePurchaseInvoiceId",
    ${alias}.pennylane_sales_invoice_id as "pennylaneSalesInvoiceId"
  `;
}
